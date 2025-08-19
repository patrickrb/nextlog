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

    console.log(`Starting QRZ upload for ${contactIds.length} contacts`);
    
    // Process each contact
    for (const contactId of contactIds) {
      try {
        console.log(`Processing contact ID: ${contactId}`);
        
        // Get the contact
        const contact = await Contact.findById(contactId);
        if (!contact || contact.user_id !== decoded.userId) {
          console.log(`Contact ${contactId}: Not found or access denied`);
          results.push({
            contactId,
            success: false,
            error: 'Contact not found or access denied'
          });
          continue;
        }

        console.log(`Contact ${contactId}: Found contact for ${contact.callsign} on ${contact.datetime}`);
      

        // Skip if already sent to QRZ
        if (contact.qrz_qsl_sent === 'Y') {
          console.log(`Contact ${contactId}: Already sent to QRZ, skipping`);
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
          console.log(`Contact ${contactId}: Already confirmed by QRZ - marking as sent in our database`);
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
          console.log(`Contact ${contactId}: No station_id associated`);
          results.push({
            contactId,
            success: false,
            error: 'Contact has no associated station'
          });
          continue;
        }

        console.log(`Contact ${contactId}: Looking up station ID ${contact.station_id}`);
        const station = await Station.findByUserIdAndId(decoded.userId, contact.station_id);
        if (!station) {
          console.log(`Contact ${contactId}: Station ${contact.station_id} not found`);
          results.push({
            contactId,
            success: false,
            error: 'Station not found for this contact'
          });
          continue;
        }

        console.log(`Contact ${contactId}: Found station ${station.callsign} (${station.station_name})`);
        
        if (!station.qrz_api_key) {
          console.log(`Contact ${contactId}: Station ${station.callsign} has no QRZ API key`);
          results.push({
            contactId,
            success: false,
            error: 'No QRZ API key configured for this station. Please add your QRZ API key in station settings.'
          });
          continue;
        }

        console.log(`Contact ${contactId}: Station has QRZ API key, proceeding with sync`);
      

        // Convert contact to QRZ format
        console.log(`Contact ${contactId}: Converting to QRZ format`);
        const qrzData = contactToQRZFormat(contact);
        console.log(`Contact ${contactId}: QRZ data:`, { 
          call: qrzData.call, 
          qso_date: qrzData.qso_date, 
          time_on: qrzData.time_on, 
          band: qrzData.band, 
          mode: qrzData.mode 
        });

        // Upload to QRZ using API key
        console.log(`Contact ${contactId}: Uploading to QRZ with API key`);
        const uploadResult = await uploadQSOToQRZWithApiKey(qrzData, station.qrz_api_key);
        console.log(`Contact ${contactId}: QRZ upload result:`, uploadResult);

        if (uploadResult.success) {
          if (uploadResult.already_exists) {
            console.log(`Contact ${contactId}: QSO already exists in QRZ - marking as both sent and received in our database`);
            // Mark as both sent AND received since it exists in QRZ (it's confirmed!)
            const updateResult = await Contact.updateQrzQsl(contactId, 'Y', 'Y');
            console.log(`Contact ${contactId}: Database update result:`, updateResult ? 'success' : 'failed');
            
            results.push({
              contactId,
              success: true,
              already_existed: true,
              message: 'QSO already exists in QRZ logbook (marked as sent and confirmed)'
            });
          } else {
            console.log(`Contact ${contactId}: QRZ upload successful - marking as sent in our database`);
            // Mark as sent to QRZ (but not yet confirmed)
            const updateResult = await Contact.updateQrzQsl(contactId, 'Y');
            console.log(`Contact ${contactId}: Database update result:`, updateResult ? 'success' : 'failed');
            
            results.push({
              contactId,
              success: true,
              message: 'Successfully sent to QRZ'
            });
          }
        } else {
          console.log(`Contact ${contactId}: QRZ upload failed: ${uploadResult.error}`);
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
        console.log(`Contact ${contactId}: Exception occurred: ${errorMessage}`);
        await Contact.updateQrzQsl(contactId, 'R');
        
        results.push({
          contactId,
          success: false,
          error: errorMessage
        });
      }
    }

    console.log(`QRZ upload completed. Processing summary:`);
    console.log(`- Total contacts: ${contactIds.length}`);
    console.log(`- Successfully sent: ${results.filter(r => r.success).length}`);
    console.log(`- Failed: ${results.filter(r => !r.success).length}`);
    console.log(`- Skipped: ${results.filter(r => r.skipped).length}`);
    console.log(`- Already existed: ${results.filter(r => r.already_existed).length}`);

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