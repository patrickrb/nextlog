import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { User } from '@/models/User';
import { Contact } from '@/models/Contact';
import { Station } from '@/models/Station';
import { syncContactToQrz } from '@/lib/qrz-sync-service';

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

    // Verify user exists
    const user = await User.findById(decoded.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!contact.station_id) {
      return NextResponse.json({
        error: 'Contact has no associated station'
      }, { status: 400 });
    }

    // The QRZ Logbook API only accepts the station's pre-issued API key —
    // user-level username/password credentials are for XML lookups only.
    const station = await Station.findByUserIdAndId(decoded.userId, contact.station_id);
    if (!station) {
      return NextResponse.json({ error: 'Station not found for this contact' }, { status: 404 });
    }

    const outcome = await syncContactToQrz(contact, station);

    if (outcome.status === 'failed') {
      return NextResponse.json({
        success: false,
        error: outcome.error
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      contact: outcome.contact ?? contact,
      ...(outcome.status === 'skipped' ? { skipped: true } : {}),
      message: outcome.message
    });

  } catch (error) {
    console.error('QRZ sync error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to sync with QRZ'
    }, { status: 500 });
  }
}
