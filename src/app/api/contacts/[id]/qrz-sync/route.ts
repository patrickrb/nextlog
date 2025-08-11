import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { User } from '@/models/User';
import { Contact } from '@/models/Contact';
import { uploadQSOToQRZ, contactToQRZFormat } from '@/lib/qrz';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const token = request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
    const contactId = parseInt(resolvedParams.id);

    if (isNaN(contactId)) {
      return NextResponse.json({ error: 'Invalid contact ID' }, { status: 400 });
    }

    // Get the contact
    const contact = await Contact.findById(contactId);
    if (!contact || contact.user_id !== decoded.userId) {
      return NextResponse.json({ error: 'Contact not found or access denied' }, { status: 404 });
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

    // Convert contact to QRZ format
    const qrzData = contactToQRZFormat(contact);

    // Upload to QRZ
    const uploadResult = await uploadQSOToQRZ(qrzData, user.qrz_username, decryptedPassword);

    if (uploadResult.success) {
      // Update contact sync status
      const updatedContact = await Contact.updateQrzSyncStatus(contactId, 'synced', uploadResult.logbook_id);
      
      return NextResponse.json({
        success: true,
        contact: updatedContact,
        logbook_id: uploadResult.logbook_id,
        message: 'Successfully synced to QRZ'
      });
    } else if (uploadResult.already_exists) {
      // Mark as already exists
      const updatedContact = await Contact.updateQrzSyncStatus(contactId, 'already_exists', undefined, uploadResult.error);
      
      return NextResponse.json({
        success: true,
        contact: updatedContact,
        skipped: true,
        message: 'QSO already exists in QRZ logbook'
      });
    } else {
      // Mark as error
      await Contact.updateQrzSyncStatus(contactId, 'error', undefined, uploadResult.error);
      
      return NextResponse.json({ 
        success: false,
        error: uploadResult.error 
      }, { status: 400 });
    }

  } catch (error) {
    console.error('QRZ sync error:', error);
    
    // Try to mark as error if we have the contact ID
    try {
      const resolvedParams = await params;
      const contactId = parseInt(resolvedParams.id);
      if (!isNaN(contactId)) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await Contact.updateQrzSyncStatus(contactId, 'error', undefined, errorMessage);
      }
    } catch {
      // Ignore errors in error handling
    }
    
    return NextResponse.json({ 
      success: false,
      error: 'Failed to sync with QRZ' 
    }, { status: 500 });
  }
}