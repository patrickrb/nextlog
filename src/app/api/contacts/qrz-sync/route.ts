import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { User } from '@/models/User';
import { Contact } from '@/models/Contact';
import { uploadQSOToQRZ, contactToQRZFormat } from '@/lib/qrz';

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

    // Get user's QRZ credentials
    const user = await User.findById(decoded.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.qrz_username || !user.qrz_password) {
      return NextResponse.json({ 
        error: 'QRZ credentials not configured. Please add your QRZ username and password in your profile settings.' 
      }, { status: 400 });
    }

    // Decrypt the password if it's encrypted
    const decryptedPassword = User.getDecryptedQrzPassword(user);
    if (!decryptedPassword) {
      return NextResponse.json({ 
        error: 'Failed to decrypt QRZ password. Please update your credentials in profile settings.' 
      }, { status: 400 });
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

        // Skip if already synced
        if (contact.qrz_sync_status === 'synced' || contact.qrz_sync_status === 'already_exists') {
          results.push({
            contactId,
            success: true,
            skipped: true,
            status: contact.qrz_sync_status,
            message: contact.qrz_sync_status === 'synced' ? 'Already synced' : 'Already exists in QRZ'
          });
          continue;
        }

        // Convert contact to QRZ format
        const qrzData = contactToQRZFormat(contact);

        // Upload to QRZ
        const uploadResult = await uploadQSOToQRZ(qrzData, user.qrz_username, decryptedPassword);

        if (uploadResult.success) {
          // Update contact sync status
          await Contact.updateQrzSyncStatus(contactId, 'synced', uploadResult.logbook_id);
          
          results.push({
            contactId,
            success: true,
            logbook_id: uploadResult.logbook_id,
            message: 'Successfully synced to QRZ'
          });
        } else if (uploadResult.already_exists) {
          // Mark as already exists
          await Contact.updateQrzSyncStatus(contactId, 'already_exists', undefined, uploadResult.error);
          
          results.push({
            contactId,
            success: true,
            skipped: true,
            status: 'already_exists',
            message: 'QSO already exists in QRZ logbook'
          });
        } else {
          // Mark as error
          await Contact.updateQrzSyncStatus(contactId, 'error', undefined, uploadResult.error);
          
          results.push({
            contactId,
            success: false,
            error: uploadResult.error
          });
        }

      } catch (error) {
        // Mark as error
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await Contact.updateQrzSyncStatus(contactId, 'error', undefined, errorMessage);
        
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

    return NextResponse.json({
      results,
      summary: {
        total: contactIds.length,
        successful,
        failed,
        skipped
      }
    });

  } catch (error) {
    console.error('QRZ sync error:', error);
    return NextResponse.json({ 
      error: 'Failed to sync with QRZ' 
    }, { status: 500 });
  }
}