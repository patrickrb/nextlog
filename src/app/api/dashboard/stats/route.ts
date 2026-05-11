import { NextRequest, NextResponse } from 'next/server';

import { Contact } from '@/models/Contact';
import { verifyToken } from '@/lib/auth';

/**
 * Aggregates the four headline numbers shown in the dashboard stat grid in
 * a single round-trip: total QSOs, distinct DXCC entities, confirmed QSLs,
 * and contacts in the last 30 days.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = typeof user.userId === 'string' ? parseInt(user.userId, 10) : user.userId;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [total, dxcc, confirmed, last30] = await Promise.all([
      Contact.countByUserId(userId),
      Contact.countDxccByUserId(userId),
      Contact.countConfirmedByUserId(userId),
      Contact.countByUserIdSince(userId, thirtyDaysAgo),
    ]);

    return NextResponse.json({ total, dxcc, confirmed, last30 });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
