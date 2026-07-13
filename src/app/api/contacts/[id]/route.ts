import { NextRequest, NextResponse, after } from 'next/server';
import { Contact } from '@/models/Contact';
import { verifyToken } from '@/lib/auth';
import { autoSyncContactToQRZ } from '@/lib/qrz-auto-sync';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const contact = await Contact.findById(parseInt(id));

    if (!contact || contact.user_id !== Number(user.userId)) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(contact);
  } catch (error) {
    console.error('Error fetching contact:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const { id } = await params;
    
    const existingContact = await Contact.findById(parseInt(id));
    if (!existingContact || existingContact.user_id !== Number(user.userId)) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    const contact = await Contact.update(parseInt(id), data);

    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    // Core QSO fields changed: flag already-uploaded copies for re-upload
    // ('Y' → 'M', wavelog's modified marker) and auto-sync after the response.
    // Compare payload values against the stored row — the edit form sends the
    // core fields on every PUT, so mere presence (or truthiness) would flag
    // unmodified QSOs and miss updates that clear a field.
    const strChanged = (key: 'callsign' | 'mode' | 'band') =>
      key in data && String(data[key] ?? '') !== String(existingContact[key] ?? '');
    const freqChanged =
      'frequency' in data &&
      Number(data.frequency ?? 0) !== Number(existingContact.frequency ?? 0);
    const datetimeChanged =
      'datetime' in data &&
      new Date(data.datetime).getTime() !== new Date(existingContact.datetime).getTime();
    if (strChanged('callsign') || strChanged('mode') || strChanged('band') || freqChanged || datetimeChanged) {
      await Contact.flagForReupload(parseInt(id));
      const userId = parseInt(user.userId, 10);
      after(() => autoSyncContactToQRZ(parseInt(id), userId));
    }

    return NextResponse.json(contact);
  } catch (error) {
    console.error('Error updating contact:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const existingContact = await Contact.findById(parseInt(id));
    if (!existingContact || existingContact.user_id !== Number(user.userId)) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    const deleted = await Contact.delete(parseInt(id));

    if (!deleted) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Contact deleted successfully' });
  } catch (error) {
    console.error('Error deleting contact:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}