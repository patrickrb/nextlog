import { NextRequest, NextResponse } from 'next/server';
import { Station } from '@/models/Station';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    
    // Check if station belongs to user
    const station = await Station.findByUserIdAndId(parseInt(user.userId), parseInt(id));
    if (!station) {
      return NextResponse.json(
        { error: 'Station not found' },
        { status: 404 }
      );
    }

    // Get station statistics
    const stats = await Station.getStationStats(parseInt(user.userId), parseInt(id));

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching station stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}