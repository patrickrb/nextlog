import { NextRequest, NextResponse } from 'next/server';
import { Station } from '@/models/Station';
import { verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // Set as default
    const success = await Station.setDefault(parseInt(user.userId), parseInt(id));

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to set default station' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Default station updated successfully' });
  } catch (error) {
    console.error('Error setting default station:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}