import { NextRequest, NextResponse } from 'next/server';
import { Station } from '@/models/Station';
import { verifyToken } from '@/lib/auth';
import { encryptString } from '@/lib/lotw';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const station = await Station.findByUserIdAndId(parseInt(user.userId), parseInt(id));

    if (!station) {
      return NextResponse.json(
        { error: 'Station not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(station);
  } catch (error) {
    console.error('Error fetching station:', error);
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

    const { id } = await params;
    const data = await request.json();

    // Check if station belongs to user
    const existingStation = await Station.findByUserIdAndId(parseInt(user.userId), parseInt(id));
    if (!existingStation) {
      return NextResponse.json(
        { error: 'Station not found' },
        { status: 404 }
      );
    }

    // Validate callsign format if provided
    if (data.callsign) {
      const callsignRegex = /^[A-Z0-9]{3,10}$/;
      if (!callsignRegex.test(data.callsign.toUpperCase())) {
        return NextResponse.json(
          { error: 'Invalid callsign format' },
          { status: 400 }
        );
      }
      data.callsign = data.callsign.toUpperCase();
    }

    // Validate grid locator if provided
    if (data.grid_locator) {
      const gridRegex = /^[A-R]{2}[0-9]{2}([A-X]{2})?$/;
      if (!gridRegex.test(data.grid_locator.toUpperCase())) {
        return NextResponse.json(
          { error: 'Invalid grid locator format' },
          { status: 400 }
        );
      }
      data.grid_locator = data.grid_locator.toUpperCase();
    }

    // Validate power if provided
    if (data.power_watts && (data.power_watts < 1 || data.power_watts > 100000)) {
      return NextResponse.json(
        { error: 'Power must be between 1 and 100000 watts' },
        { status: 400 }
      );
    }

    // Validate zones if provided
    if (data.itu_zone && (data.itu_zone < 1 || data.itu_zone > 90)) {
      return NextResponse.json(
        { error: 'ITU zone must be between 1 and 90' },
        { status: 400 }
      );
    }

    if (data.cq_zone && (data.cq_zone < 1 || data.cq_zone > 40)) {
      return NextResponse.json(
        { error: 'CQ zone must be between 1 and 40' },
        { status: 400 }
      );
    }

    // Encrypt LoTW password if provided
    if (data.lotw_password) {
      data.lotw_password = encryptString(data.lotw_password);
    }

    const station = await Station.update(parseInt(id), data);

    if (!station) {
      return NextResponse.json(
        { error: 'Station not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(station);
  } catch (error) {
    console.error('Error updating station:', error);
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
    
    // Check if station belongs to user
    const existingStation = await Station.findByUserIdAndId(parseInt(user.userId), parseInt(id));
    if (!existingStation) {
      return NextResponse.json(
        { error: 'Station not found' },
        { status: 404 }
      );
    }

    // Don't allow deletion of default station if it's the only station
    if (existingStation.is_default) {
      const userStations = await Station.findByUserId(parseInt(user.userId));
      if (userStations.length === 1) {
        return NextResponse.json(
          { error: 'Cannot delete the only station' },
          { status: 400 }
        );
      }
    }

    const deleted = await Station.delete(parseInt(id));

    if (!deleted) {
      return NextResponse.json(
        { error: 'Station not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Station deleted successfully' });
  } catch (error) {
    console.error('Error deleting station:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}