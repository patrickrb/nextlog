import { NextRequest, NextResponse } from 'next/server';
import { Contact } from '@/models/Contact';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;
    const since = searchParams.get('since');
    const countOnly = searchParams.get('count_only') === 'true';

    const userId = typeof user.userId === 'string' ? parseInt(user.userId, 10) : user.userId;
    
    // Handle count-only request for recent contacts
    if (countOnly && since) {
      const count = await Contact.countByUserIdSince(userId, since);
      return NextResponse.json({ count });
    }

    const contacts = await Contact.findByUserId(userId, limit, offset);
    const total = await Contact.countByUserId(userId);

    return NextResponse.json({
      contacts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    
    const contact = await Contact.create({
      ...data,
      user_id: user.userId
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    console.error('Error creating contact:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}