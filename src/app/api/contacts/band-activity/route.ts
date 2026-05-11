import { NextRequest, NextResponse } from 'next/server';

import { Contact } from '@/models/Contact';
import { verifyToken } from '@/lib/auth';

const RANGE_MS: Record<string, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = typeof user.userId === 'string' ? parseInt(user.userId, 10) : user.userId;

    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') ?? '24h';
    const ms = RANGE_MS[range];

    const since = ms
      ? new Date(Date.now() - ms).toISOString()
      : new Date(0).toISOString();

    const activity = await Contact.getBandActivity(userId, since);
    return NextResponse.json({ range, activity });
  } catch (error) {
    console.error('Error fetching band activity:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
