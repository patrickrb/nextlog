// LoTW Upload API endpoint

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { performLotwUpload } from '@/lib/lotw-sync';
import { LotwUploadRequest } from '@/types/lotw';

export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: LotwUploadRequest = await request.json();
    const { station_id, date_from, date_to, upload_method = 'manual' } = body;

    if (!station_id) {
      return NextResponse.json({
        error: 'station_id is required'
      }, { status: 400 });
    }

    const result = await performLotwUpload({
      stationId: station_id,
      requesterUserId: parseInt(user.userId),
      dateFrom: date_from,
      dateTo: date_to,
      uploadMethod: upload_method,
    });

    return NextResponse.json(result.body, { status: result.status });

  } catch (error) {
    console.error('LoTW upload error:', error);
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
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query for upload logs
    let logQuery = `
      SELECT lul.*, s.callsign as station_callsign
      FROM lotw_upload_logs lul
      JOIN stations s ON lul.station_id = s.id
      WHERE lul.user_id = $1
    `;
    const queryParams: (string | number)[] = [parseInt(user.userId)];
    let paramIndex = 2;

    if (stationId) {
      logQuery += ` AND lul.station_id = $${paramIndex}`;
      queryParams.push(parseInt(stationId));
      paramIndex++;
    }

    logQuery += ` ORDER BY lul.started_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const logsResult = await query(logQuery, queryParams);

    return NextResponse.json({
      upload_logs: logsResult.rows,
      pagination: {
        limit,
        offset,
        total: logsResult.rows.length
      }
    });

  } catch (error) {
    console.error('Upload logs retrieval error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
