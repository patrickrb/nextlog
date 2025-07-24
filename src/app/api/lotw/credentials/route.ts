// LoTW Credentials Management API endpoint

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { encryptString, validateLoTWCredentials } from '@/lib/lotw';
import { ThirdPartyServices } from '@/types/lotw';

export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { username, password, station_id } = body;

    if (!username || !password) {
      return NextResponse.json({ 
        error: 'Username and password are required' 
      }, { status: 400 });
    }

    // Validate credentials with LoTW
    const isValid = await validateLoTWCredentials(username, password);
    if (!isValid) {
      return NextResponse.json({ 
        error: 'Invalid LoTW credentials. Please check your username and password.' 
      }, { status: 400 });
    }

    const encryptedPassword = encryptString(password);

    if (station_id) {
      // Store credentials for specific station
      const stationResult = await query(
        'SELECT id FROM stations WHERE id = $1 AND user_id = $2',
        [parseInt(station_id), parseInt(user.userId)]
      );

      if (stationResult.rows.length === 0) {
        return NextResponse.json({ 
          error: 'Station not found or access denied' 
        }, { status: 404 });
      }

      await query(
        'UPDATE stations SET lotw_username = $1, lotw_password = $2 WHERE id = $3',
        [username, encryptedPassword, parseInt(station_id)]
      );

      return NextResponse.json({ 
        success: true,
        message: 'LoTW credentials updated for station'
      });

    } else {
      // Store credentials in user's third_party_services
      const userResult = await query(
        'SELECT third_party_services FROM users WHERE id = $1',
        [parseInt(user.userId)]
      );

      const thirdPartyServices: ThirdPartyServices = userResult.rows[0]?.third_party_services || {};
      
      thirdPartyServices.lotw = {
        username,
        password: encryptedPassword
      };

      await query(
        'UPDATE users SET third_party_services = $1 WHERE id = $2',
        [JSON.stringify(thirdPartyServices), parseInt(user.userId)]
      );

      return NextResponse.json({ 
        success: true,
        message: 'LoTW credentials updated for user account'
      });
    }

  } catch (error) {
    console.error('LoTW credentials update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const stationId = searchParams.get('station_id');

    if (stationId) {
      // Get credentials for specific station
      const stationResult = await query(
        'SELECT id, callsign, lotw_username FROM stations WHERE id = $1 AND user_id = $2',
        [parseInt(stationId), parseInt(user.userId)]
      );

      if (stationResult.rows.length === 0) {
        return NextResponse.json({ 
          error: 'Station not found or access denied' 
        }, { status: 404 });
      }

      const station = stationResult.rows[0];

      return NextResponse.json({
        station_id: station.id,
        callsign: station.callsign,
        lotw_username: station.lotw_username || null,
        has_password: !!(station.lotw_password)
      });

    } else {
      // Get user-level credentials
      const userResult = await query(
        'SELECT third_party_services FROM users WHERE id = $1',
        [parseInt(user.userId)]
      );

      const thirdPartyServices: ThirdPartyServices = userResult.rows[0]?.third_party_services || {};
      const lotwCreds = thirdPartyServices.lotw;

      return NextResponse.json({
        lotw_username: lotwCreds?.username || null,
        has_password: !!(lotwCreds?.password)
      });
    }

  } catch (error) {
    console.error('LoTW credentials retrieval error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const stationId = searchParams.get('station_id');

    if (stationId) {
      // Remove credentials from specific station
      const stationResult = await query(
        'SELECT id FROM stations WHERE id = $1 AND user_id = $2',
        [parseInt(stationId), parseInt(user.userId)]
      );

      if (stationResult.rows.length === 0) {
        return NextResponse.json({ 
          error: 'Station not found or access denied' 
        }, { status: 404 });
      }

      await query(
        'UPDATE stations SET lotw_username = NULL, lotw_password = NULL WHERE id = $1',
        [parseInt(stationId)]
      );

      return NextResponse.json({ 
        success: true,
        message: 'LoTW credentials removed from station'
      });

    } else {
      // Remove credentials from user's third_party_services
      const userResult = await query(
        'SELECT third_party_services FROM users WHERE id = $1',
        [parseInt(user.userId)]
      );

      const thirdPartyServices: ThirdPartyServices = userResult.rows[0]?.third_party_services || {};
      
      delete thirdPartyServices.lotw;

      await query(
        'UPDATE users SET third_party_services = $1 WHERE id = $2',
        [JSON.stringify(thirdPartyServices), parseInt(user.userId)]
      );

      return NextResponse.json({ 
        success: true,
        message: 'LoTW credentials removed from user account'
      });
    }

  } catch (error) {
    console.error('LoTW credentials deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Test LoTW credentials
export async function PUT(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ 
        error: 'Username and password are required for testing' 
      }, { status: 400 });
    }

    // Test credentials with LoTW
    const isValid = await validateLoTWCredentials(username, password);

    return NextResponse.json({ 
      valid: isValid,
      message: isValid ? 'LoTW credentials are valid' : 'LoTW credentials are invalid'
    });

  } catch (error) {
    console.error('LoTW credentials test error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}