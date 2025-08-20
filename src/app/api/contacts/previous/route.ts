import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { Contact } from '@/models/Contact';

export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const callsign = searchParams.get('callsign');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!callsign) {
      return NextResponse.json({ error: 'Callsign parameter is required' }, { status: 400 });
    }

    const userId = typeof user.userId === 'string' ? parseInt(user.userId, 10) : user.userId;
    
    const contacts = await Contact.findByCallsignAndUserId(userId, callsign, limit);
    
    // Format the contacts for the response
    const formattedContacts = contacts.map(contact => ({
      id: contact.id,
      datetime: contact.datetime,
      band: contact.band,
      mode: contact.mode,
      frequency: typeof contact.frequency === 'string' ? parseFloat(contact.frequency) : contact.frequency,
      rst_sent: contact.rst_sent,
      rst_received: contact.rst_received,
      name: contact.name,
      qth: contact.qth,
      notes: contact.notes
    }));

    return NextResponse.json({ 
      contacts: formattedContacts,
      count: formattedContacts.length
    });

  } catch (error) {
    console.error('Error fetching previous contacts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}