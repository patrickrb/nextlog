import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { User } from '@/models/User';
import { Contact } from '@/models/Contact';
import { lookupCallsign } from '@/lib/qrz';


export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
    
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

    // Get decrypted password
    const decryptedPassword = User.getDecryptedQrzPassword(user);
    if (!decryptedPassword) {
      return NextResponse.json({ 
        error: 'Failed to decrypt QRZ password. Please update your credentials in profile settings.' 
      }, { status: 400 });
    }

    // Get all contacts for this user that don't have location data
    const contacts = await Contact.findByUserId(decoded.userId);
    const contactsWithoutLocation = contacts.filter(contact => 
      !contact.latitude && !contact.longitude && !contact.grid_locator
    );


    let updated = 0;
    let failed = 0;

    // Process contacts in batches to avoid overwhelming QRZ
    for (const contact of contactsWithoutLocation) {
      try {
        
        const qrzResult = await lookupCallsign(contact.callsign, user.qrz_username, decryptedPassword);
        
        if (qrzResult.found && (qrzResult.latitude || qrzResult.grid_locator)) {
          // Update the contact with available location data
          await Contact.update(contact.id, {
            grid_locator: qrzResult.grid_locator,
            latitude: qrzResult.latitude,
            longitude: qrzResult.longitude
          });
          
          
          updated++;
        } else {
          failed++;
        }
        
        // Add a small delay to be respectful to QRZ's servers
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch {
        failed++;
      }
    }

    return NextResponse.json({
      message: `Location population complete. Updated: ${updated}, Failed: ${failed}`,
      updated,
      failed,
      total: contactsWithoutLocation.length
    });

  } catch {
    return NextResponse.json({ error: 'Failed to populate location data' }, { status: 500 });
  }
}