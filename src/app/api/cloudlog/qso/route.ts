// Cloudlog-compatible QSO API endpoints
// GET: Retrieve QSOs with filtering
// POST: Create new QSO
// PUT: Update existing QSO
// DELETE: Delete QSO

import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey, canWrite, canAccessStation } from '@/lib/api-auth';
import { query } from '@/lib/db';

// Helper function to add rate limit headers
function addRateLimitHeaders(response: NextResponse, remaining: number, limit: number) {
  const resetTime = new Date();
  resetTime.setHours(resetTime.getHours() + 1, 0, 0, 0);
  
  response.headers.set('X-RateLimit-Limit', limit.toString());
  response.headers.set('X-RateLimit-Remaining', remaining.toString());
  response.headers.set('X-RateLimit-Reset', Math.floor(resetTime.getTime() / 1000).toString());
  
  return response;
}

// Helper function to convert database row to Cloudlog-compatible QSO format
function formatQsoForCloudlog(row: Record<string, unknown>) {
  return {
    id: row.id,
    callsign: row.callsign,
    band: row.band,
    mode: row.mode,
    rst_sent: row.rst_sent,
    rst_rcvd: row.rst_rcvd,
    qso_date: row.datetime ? new Date(row.datetime as string | number | Date).toISOString().split('T')[0] : null,
    time_on: row.datetime ? new Date(row.datetime as string | number | Date).toISOString().split('T')[1].replace('Z', '') : null,
    freq: row.frequency_mhz,
    station_callsign: row.station_callsign,
    my_gridsquare: row.my_gridsquare,
    gridsquare: row.gridsquare,
    country: row.country,
    state: row.state,
    county: row.county,
    comment: row.comment,
    qsl_sent: row.qsl_sent || 'N',
    qsl_rcvd: row.qsl_rcvd || 'N',
    lotw_qsl_sent: row.lotw_qsl_sent || 'N',
    lotw_qsl_rcvd: row.lotw_qsl_rcvd || 'N',
    eqsl_qsl_sent: row.eqsl_qsl_sent || 'N',
    eqsl_qsl_rcvd: row.eqsl_qsl_rcvd || 'N',
    contest_id: row.contest_id,
    name: row.name,
    email: row.email,
    address: row.address,
    dxcc: row.dxcc,
    cq_zone: row.cq_zone,
    itu_zone: row.itu_zone,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// GET /api/cloudlog/qso - Retrieve QSOs
export async function GET(request: NextRequest) {
  const authResult = await verifyApiKey(request);
  
  if (!authResult.success) {
    return NextResponse.json({
      success: false,
      error: authResult.error
    }, { status: authResult.statusCode || 500 });
  }

  const auth = authResult.auth!;
  const url = new URL(request.url);
  
  try {
    // Parse query parameters for filtering
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 1000);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const callsign = url.searchParams.get('callsign');
    const band = url.searchParams.get('band');
    const mode = url.searchParams.get('mode');
    const dateFrom = url.searchParams.get('date_from');
    const dateTo = url.searchParams.get('date_to');
    const stationId = url.searchParams.get('station_id');
    const confirmedOnly = url.searchParams.get('confirmed') === 'true';

    // Build the query
    let queryText = `
      SELECT 
        c.*,
        s.callsign as station_callsign,
        s.grid_locator as my_gridsquare
      FROM contacts c
      LEFT JOIN stations s ON c.station_id = s.id
      WHERE c.user_id = $1
    `;
    const queryParams: unknown[] = [auth.userId];
    let paramIndex = 2;

    // Apply station filter if specified and authorized
    if (stationId) {
      const stationIdNum = parseInt(stationId);
      if (await canAccessStation(auth, stationIdNum)) {
        queryText += ` AND c.station_id = $${paramIndex}`;
        queryParams.push(stationIdNum);
        paramIndex++;
      } else {
        return NextResponse.json({
          success: false,
          error: 'Access denied to specified station'
        }, { status: 403 });
      }
    } else if (auth.stationId) {
      // If API key is tied to specific station, filter by that
      queryText += ` AND c.station_id = $${paramIndex}`;
      queryParams.push(auth.stationId);
      paramIndex++;
    }

    // Apply other filters
    if (callsign) {
      queryText += ` AND UPPER(c.callsign) = UPPER($${paramIndex})`;
      queryParams.push(callsign);
      paramIndex++;
    }

    if (band) {
      queryText += ` AND UPPER(c.band) = UPPER($${paramIndex})`;
      queryParams.push(band);
      paramIndex++;
    }

    if (mode) {
      queryText += ` AND UPPER(c.mode) = UPPER($${paramIndex})`;
      queryParams.push(mode);
      paramIndex++;
    }

    if (dateFrom) {
      queryText += ` AND c.datetime >= $${paramIndex}`;
      queryParams.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      queryText += ` AND c.datetime <= $${paramIndex}`;
      queryParams.push(dateTo + ' 23:59:59');
      paramIndex++;
    }

    if (confirmedOnly) {
      queryText += ` AND (c.lotw_qsl_rcvd = 'Y' OR c.qsl_rcvd = 'Y' OR c.eqsl_qsl_rcvd = 'Y')`;
    }

    // Add ordering and pagination
    queryText += ` ORDER BY c.datetime DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const result = await query(queryText, queryParams);

    // Get total count for pagination
    let countQuery = queryText.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total FROM');
    countQuery = countQuery.replace(/ORDER BY.*$/, '');
    countQuery = countQuery.replace(/LIMIT.*$/, '');
    
    const countResult = await query(countQuery, queryParams.slice(0, -2)); // Remove limit and offset params
    const totalCount = parseInt(countResult.rows[0].total);

    const response = NextResponse.json({
      success: true,
      qsos: result.rows.map(formatQsoForCloudlog),
      pagination: {
        limit,
        offset,
        total: totalCount,
        has_more: offset + result.rows.length < totalCount
      }
    });

    return addRateLimitHeaders(response, 999, auth.rateLimitPerHour); // TODO: Get actual remaining from rate limiter

  } catch (error) {
    console.error('QSO retrieval error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// POST /api/cloudlog/qso - Create new QSO
export async function POST(request: NextRequest) {
  const authResult = await verifyApiKey(request);
  
  if (!authResult.success) {
    return NextResponse.json({
      success: false,
      error: authResult.error
    }, { status: authResult.statusCode || 500 });
  }

  const auth = authResult.auth!;

  if (!canWrite(auth)) {
    return NextResponse.json({
      success: false,
      error: 'API key does not have write permissions'
    }, { status: 403 });
  }

  try {
    const body = await request.json();

    // Validate required fields
    const requiredFields = ['callsign', 'band', 'mode'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({
          success: false,
          error: `Missing required field: ${field}`
        }, { status: 400 });
      }
    }

    // Determine station ID
    let stationId = auth.stationId;
    if (!stationId) {
      if (body.station_id) {
        const requestedStationId = parseInt(body.station_id);
        if (await canAccessStation(auth, requestedStationId)) {
          stationId = requestedStationId;
        } else {
          return NextResponse.json({
            success: false,
            error: 'Access denied to specified station'
          }, { status: 403 });
        }
      } else {
        // Get user's default station
        const defaultStationResult = await query(
          'SELECT id FROM stations WHERE user_id = $1 AND is_default = true LIMIT 1',
          [auth.userId]
        );
        if (defaultStationResult.rows.length > 0) {
          stationId = defaultStationResult.rows[0].id;
        }
      }
    }

    if (!stationId) {
      return NextResponse.json({
        success: false,
        error: 'No station specified and no default station found'
      }, { status: 400 });
    }

    // Build datetime from qso_date and time_on
    let datetime = new Date();
    if (body.qso_date) {
      if (body.time_on) {
        datetime = new Date(`${body.qso_date}T${body.time_on}Z`);
      } else {
        datetime = new Date(`${body.qso_date}T00:00:00Z`);
      }
    }

    // Insert the QSO
    const insertResult = await query(`
      INSERT INTO contacts (
        user_id, station_id, callsign, band, mode, rst_sent, rst_rcvd,
        datetime, frequency_mhz, gridsquare, country, state, county,
        comment, name, email, address, dxcc, cq_zone, itu_zone,
        contest_id, qsl_sent, qsl_rcvd, lotw_qsl_sent, lotw_qsl_rcvd,
        eqsl_qsl_sent, eqsl_qsl_rcvd
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
      ) RETURNING id, created_at
    `, [
      auth.userId,
      stationId,
      body.callsign.toUpperCase(),
      body.band.toUpperCase(),
      body.mode.toUpperCase(),
      body.rst_sent || '599',
      body.rst_rcvd || '599',
      datetime,
      body.freq ? parseFloat(body.freq) : null,
      body.gridsquare || null,
      body.country || null,
      body.state || null,
      body.county || null,
      body.comment || null,
      body.name || null,
      body.email || null,
      body.address || null,
      body.dxcc ? parseInt(body.dxcc) : null,
      body.cq_zone ? parseInt(body.cq_zone) : null,
      body.itu_zone ? parseInt(body.itu_zone) : null,
      body.contest_id || null,
      body.qsl_sent || 'N',
      body.qsl_rcvd || 'N',
      body.lotw_qsl_sent || 'N',
      body.lotw_qsl_rcvd || 'N',
      body.eqsl_qsl_sent || 'N',
      body.eqsl_qsl_rcvd || 'N'
    ]);

    const response = NextResponse.json({
      success: true,
      message: 'QSO created successfully',
      qso_id: insertResult.rows[0].id,
      created_at: insertResult.rows[0].created_at
    });

    return addRateLimitHeaders(response, 999, auth.rateLimitPerHour);

  } catch (error) {
    console.error('QSO creation error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// PUT /api/cloudlog/qso - Update existing QSO
export async function PUT(request: NextRequest) {
  const authResult = await verifyApiKey(request);
  
  if (!authResult.success) {
    return NextResponse.json({
      success: false,
      error: authResult.error
    }, { status: authResult.statusCode || 500 });
  }

  const auth = authResult.auth!;

  if (!canWrite(auth)) {
    return NextResponse.json({
      success: false,
      error: 'API key does not have write permissions'
    }, { status: 403 });
  }

  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({
        success: false,
        error: 'QSO ID is required for updates'
      }, { status: 400 });
    }

    const qsoId = parseInt(body.id);

    // Verify user owns this QSO and can access the station
    const qsoResult = await query(
      'SELECT user_id, station_id FROM contacts WHERE id = $1',
      [qsoId]
    );

    if (qsoResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'QSO not found'
      }, { status: 404 });
    }

    const qso = qsoResult.rows[0];
    if (qso.user_id !== auth.userId) {
      return NextResponse.json({
        success: false,
        error: 'Access denied'
      }, { status: 403 });
    }

    if (auth.stationId && qso.station_id !== auth.stationId) {
      return NextResponse.json({
        success: false,
        error: 'Access denied to QSO from different station'
      }, { status: 403 });
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const updateValues: unknown[] = [];
    let paramIndex = 1;

    const allowedFields = [
      'callsign', 'band', 'mode', 'rst_sent', 'rst_rcvd', 'frequency_mhz',
      'gridsquare', 'country', 'state', 'county', 'comment', 'name', 'email',
      'address', 'dxcc', 'cq_zone', 'itu_zone', 'contest_id', 'qsl_sent',
      'qsl_rcvd', 'lotw_qsl_sent', 'lotw_qsl_rcvd', 'eqsl_qsl_sent', 'eqsl_qsl_rcvd'
    ];

    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updateFields.push(`${key} = $${paramIndex}`);
        updateValues.push(value);
        paramIndex++;
      }
    }

    // Handle datetime update from qso_date and time_on
    if (body.qso_date || body.time_on) {
      const currentQso = await query('SELECT datetime FROM contacts WHERE id = $1', [qsoId]);
      const currentDatetime = new Date(currentQso.rows[0].datetime);
      
      let newDatetime = currentDatetime;
      if (body.qso_date) {
        const datePart = body.qso_date;
        const timePart = body.time_on || currentDatetime.toISOString().split('T')[1];
        newDatetime = new Date(`${datePart}T${timePart}`);
      } else if (body.time_on) {
        const datePart = currentDatetime.toISOString().split('T')[0];
        newDatetime = new Date(`${datePart}T${body.time_on}`);
      }
      
      updateFields.push(`datetime = $${paramIndex}`);
      updateValues.push(newDatetime);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid fields to update'
      }, { status: 400 });
    }

    // Add updated_at
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    // Add WHERE clause
    updateValues.push(qsoId);
    const whereParam = paramIndex;

    const updateQuery = `
      UPDATE contacts 
      SET ${updateFields.join(', ')}
      WHERE id = $${whereParam}
      RETURNING id, updated_at
    `;

    const updateResult = await query(updateQuery, updateValues);

    const response = NextResponse.json({
      success: true,
      message: 'QSO updated successfully',
      qso_id: updateResult.rows[0].id,
      updated_at: updateResult.rows[0].updated_at
    });

    return addRateLimitHeaders(response, 999, auth.rateLimitPerHour);

  } catch (error) {
    console.error('QSO update error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// DELETE /api/cloudlog/qso - Delete QSO
export async function DELETE(request: NextRequest) {
  const authResult = await verifyApiKey(request);
  
  if (!authResult.success) {
    return NextResponse.json({
      success: false,
      error: authResult.error
    }, { status: authResult.statusCode || 500 });
  }

  const auth = authResult.auth!;

  if (!canWrite(auth)) {
    return NextResponse.json({
      success: false,
      error: 'API key does not have write permissions'
    }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const qsoIdParam = url.searchParams.get('id');

    if (!qsoIdParam) {
      return NextResponse.json({
        success: false,
        error: 'QSO ID is required'
      }, { status: 400 });
    }

    const qsoId = parseInt(qsoIdParam);

    // Verify user owns this QSO
    const qsoResult = await query(
      'SELECT user_id, station_id, callsign FROM contacts WHERE id = $1',
      [qsoId]
    );

    if (qsoResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'QSO not found'
      }, { status: 404 });
    }

    const qso = qsoResult.rows[0];
    if (qso.user_id !== auth.userId) {
      return NextResponse.json({
        success: false,
        error: 'Access denied'
      }, { status: 403 });
    }

    if (auth.stationId && qso.station_id !== auth.stationId) {
      return NextResponse.json({
        success: false,
        error: 'Access denied to QSO from different station'
      }, { status: 403 });
    }

    // Delete the QSO
    await query('DELETE FROM contacts WHERE id = $1', [qsoId]);

    const response = NextResponse.json({
      success: true,
      message: `QSO with ${qso.callsign} deleted successfully`
    });

    return addRateLimitHeaders(response, 999, auth.rateLimitPerHour);

  } catch (error) {
    console.error('QSO deletion error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}