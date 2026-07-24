import { NextRequest, NextResponse } from 'next/server';
import { Station } from '@/models/Station';
import { verifyToken } from '@/lib/auth';
import { gridLocatorError } from '@/lib/grid';

export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stations = await Station.findByUserId(parseInt(user.userId));
    
    return NextResponse.json({ stations });
  } catch (error) {
    console.error('Error fetching stations:', error);
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
    
    // Validate required fields
    if (!data.callsign || !data.station_name) {
      return NextResponse.json(
        { error: 'Callsign and station name are required' },
        { status: 400 }
      );
    }

    // Validate callsign format (basic validation)
    const callsignRegex = /^[A-Z0-9]{3,10}$/;
    if (!callsignRegex.test(data.callsign.toUpperCase())) {
      return NextResponse.json(
        { error: 'Invalid callsign format' },
        { status: 400 }
      );
    }

    // Validate grid locator if provided. Uses the canonical validator so an
    // 8-char extended locator (the on-air grid a VHF/microwave op transmits from,
    // and the origin of the logging-form distance readout) saves rather than 400s.
    if (data.grid_locator) {
      const gridError = gridLocatorError(data.grid_locator);
      if (gridError) {
        return NextResponse.json({ error: gridError }, { status: 400 });
      }
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

    const station = await Station.create(parseInt(user.userId), {
      ...data,
      callsign: data.callsign.toUpperCase(),
      grid_locator: data.grid_locator ? data.grid_locator.toUpperCase() : undefined,
    });

    return NextResponse.json(station, { status: 201 });
  } catch (error) {
    console.error('Error creating station:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}