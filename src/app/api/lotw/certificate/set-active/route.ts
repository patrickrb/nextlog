// Set Active LoTW Certificate API endpoint

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { station_id, certificate_id } = body;

    if (!station_id || !certificate_id) {
      return NextResponse.json({
        error: 'Missing required fields: station_id, certificate_id'
      }, { status: 400 });
    }

    // Verify station belongs to user
    const stationResult = await query(
      'SELECT id FROM stations WHERE id = $1 AND user_id = $2',
      [parseInt(station_id), parseInt(user.userId)]
    );

    if (stationResult.rows.length === 0) {
      return NextResponse.json({
        error: 'Station not found or access denied'
      }, { status: 404 });
    }

    // Verify certificate belongs to this station
    const certResult = await query(
      'SELECT id FROM lotw_credentials WHERE id = $1 AND station_id = $2',
      [parseInt(certificate_id), parseInt(station_id)]
    );

    if (certResult.rows.length === 0) {
      return NextResponse.json({
        error: 'Certificate not found for this station'
      }, { status: 404 });
    }

    // Deactivate all certificates for this station
    await query(
      'UPDATE lotw_credentials SET is_active = false WHERE station_id = $1',
      [parseInt(station_id)]
    );

    // Activate the selected certificate
    await query(
      'UPDATE lotw_credentials SET is_active = true WHERE id = $1',
      [parseInt(certificate_id)]
    );

    return NextResponse.json({
      success: true,
      message: 'Active certificate updated successfully'
    });

  } catch (error) {
    console.error('Set active certificate error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}
