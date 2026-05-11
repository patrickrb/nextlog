import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { User } from '@/models/User';
import { Contact } from '@/models/Contact';
import { Station } from '@/models/Station';
import { uploadQSOToQRZWithApiKey, contactToQRZFormat } from '@/lib/qrz';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
    const body = await request.json();
    const { contactIds } = body;

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json({ error: 'Contact IDs are required' }, { status: 400 });
    }

    // Verify user exists
    const user = await User.findById(decoded.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const results = [];

    // Process each contact
    for (const contactId of contactIds) {
      try {
        // Get the contact
        const contact = await Contact.findById(contactId);
        if (!contact || contact.user_id !== decoded.userId) {
          results.push({
            contactId,
            success: false,
            error: 'Contact not found or access denied'
          });
          continue;
        }

        // Skip if already sent to QRZ
        if (contact.qrz_qsl_sent === 'Y') {
          results.push({
            contactId,
            success: true,
            skipped: true,
            message: 'Already sent to QRZ'
          });
          continue;
        }

        // If we've received confirmation from QRZ, mark as sent too (it exists in QRZ)
        if (contact.qrz_qsl_rcvd === 'Y') {
          await Contact.updateQrzQsl(contactId, 'Y');
          results.push({
            contactId,
            success: true,
            skipped: true,
            message: 'Already confirmed by QRZ (marked as sent)'
          });
          continue;
        }

        // Get the station for this contact to get QRZ API key
        if (!contact.station_id) {
          results.push({
            contactId,
            success: false,
            error: 'Contact has no associated station'
          });
          continue;
        }

        const station = await Station.findByUserIdAndId(decoded.userId, contact.station_id);
        if (!station) {
          results.push({
            contactId,
            success: false,
            error: 'Station not found for this contact'
          });
          continue;
        }

        if (!station.qrz_api_key) {
          results.push({
            contactId,
            success: false,
            error: 'No QRZ API key configured for this station. Please add your QRZ API key in station settings.'
          });
          continue;
        }

        // Convert contact to QRZ format and upload
        const qrzData = contactToQRZFormat(contact);
        const uploadResult = await uploadQSOToQRZWithApiKey(qrzData, station.qrz_api_key);

        if (uploadResult.success) {
          if (uploadResult.already_exists) {
            // Mark as both sent AND received since it exists in QRZ (it's confirmed!)
            await Contact.updateQrzQsl(contactId, 'Y', 'Y');
            results.push({
              contactId,
              success: true,
              already_existed: true,
              message: 'QSO already exists in QRZ logbook (marked as sent and confirmed)'
            });
          } else {
            // Mark as sent to QRZ (but not yet confirmed)
            await Contact.updateQrzQsl(contactId, 'Y');
            results.push({
              contactId,
              success: true,
              message: 'Successfully sent to QRZ'
            });
          }
        } else {
          // Mark as request failed
          await Contact.updateQrzQsl(contactId, 'R');
          results.push({
            contactId,
            success: false,
            error: uploadResult.error
          });
        }

      } catch (error) {
        // Mark as error
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await Contact.updateQrzQsl(contactId, 'R');
        results.push({
          contactId,
          success: false,
          error: errorMessage
        });
      }
    }

    // Calculate summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const skipped = results.filter(r => r.skipped).length;
    const alreadyExisted = results.filter(r => r.already_existed).length;

    return NextResponse.json({
      results,
      summary: {
        total: contactIds.length,
        successful,
        failed,
        skipped,
        already_existed: alreadyExisted
      }
    });

  } catch (error) {
    console.error('QRZ sync error:', error);
    return NextResponse.json({
      error: 'Failed to sync with QRZ'
    }, { status: 500 });
  }
}
