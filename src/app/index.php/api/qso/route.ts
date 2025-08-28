// Cloudlog compatibility endpoint for SmartSDR and other software
// Handles the /index.php/api/qso path that traditional Cloudlog uses

import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey, canWrite, canAccessStation } from '@/lib/api-auth';
import { query } from '@/lib/db';
import { addCorsHeaders, createCorsPreflightResponse } from '@/lib/cors';

// Simple ADIF parser for SmartSDR format
function parseAdif(adifString: string): Record<string, string> {
  const fields: Record<string, string> = {};
  
  // ADIF format: <FIELD:LENGTH>VALUE
  const adifRegex = /<([A-Z_]+):(\d+)>([^<]*)/g;
  let match;
  
  while ((match = adifRegex.exec(adifString)) !== null) {
    const [, fieldName, length, value] = match;
    const expectedLength = parseInt(length);
    const actualValue = value.substring(0, expectedLength);
    fields[fieldName] = actualValue;
  }
  
  return fields;
}

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

// OPTIONS /index.php/api/qso - Handle CORS preflight requests
export async function OPTIONS() {
  return createCorsPreflightResponse();
}

// GET /index.php/api/qso - Retrieve QSOs
export async function GET(request: NextRequest) {
  const authResult = await verifyApiKey(request);
  
  if (!authResult.success) {
    const response = NextResponse.json({
      success: false,
      error: authResult.error
    }, { status: authResult.statusCode || 500 });
    return addCorsHeaders(response);
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
        const response = NextResponse.json({
          success: false,
          error: 'Access denied to specified station'
        }, { status: 403 });
        return addCorsHeaders(response);
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

    return addCorsHeaders(addRateLimitHeaders(response, 999, auth.rateLimitPerHour));

  } catch (error) {
    console.error('QSO retrieval error:', error);
    const response = NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
    return addCorsHeaders(response);
  }
}

// POST /index.php/api/qso - Create new QSO
export async function POST(request: NextRequest) {
  const authResult = await verifyApiKey(request);
  
  if (!authResult.success) {
    const response = NextResponse.json({
      success: false,
      error: authResult.error
    }, { status: authResult.statusCode || 500 });
    return addCorsHeaders(response);
  }

  const auth = authResult.auth!;

  if (!canWrite(auth)) {
    const response = NextResponse.json({
      success: false,
      error: 'API key does not have write permissions'
    }, { status: 403 });
    return addCorsHeaders(response);
  }

  try {
    const body = await request.json();
    
    // Check if this is SmartSDR ADIF format
    if (body.type === 'adif' && body.string) {
      // Parse ADIF string into fields
      const adifData = parseAdif(body.string);
      
      // Convert ADIF fields to our expected format
      const parsedBody = {
        callsign: adifData.CALL || adifData.call,
        band: adifData.BAND || adifData.band,
        mode: adifData.MODE || adifData.mode,
        rst_sent: adifData.RST_SENT || adifData.rst_sent,
        rst_rcvd: adifData.RST_RCVD || adifData.rst_rcvd,
        freq: adifData.FREQ || adifData.freq,
        qso_date: adifData.QSO_DATE || adifData.qso_date,
        time_on: adifData.TIME_ON || adifData.time_on,
        gridsquare: adifData.GRIDSQUARE || adifData.gridsquare,
        name: adifData.NAME || adifData.name,
        country: adifData.COUNTRY || adifData.country,
        state: adifData.STATE || adifData.state,
        dxcc: adifData.DXCC || adifData.dxcc,
        cq_zone: adifData.CQZ || adifData.cq_zone || adifData.CQ_ZONE,
        itu_zone: adifData.ITUZ || adifData.itu_zone || adifData.ITU_ZONE,
        station_id: body.station_profile_id
      };
      
      // Replace body with parsed data
      Object.assign(body, parsedBody);
    }

    // Validate required fields for direct field format
    const requiredFields = ['callsign', 'band', 'mode'];
    for (const field of requiredFields) {
      if (!body[field]) {
        const response = NextResponse.json({
          success: false,
          error: `Missing required field: ${field}`
        }, { status: 400 });
        return addCorsHeaders(response);
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
          const response = NextResponse.json({
            success: false,
            error: 'Access denied to specified station'
          }, { status: 403 });
          return addCorsHeaders(response);
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
      const response = NextResponse.json({
        success: false,
        error: 'No station specified and no default station found'
      }, { status: 400 });
      return addCorsHeaders(response);
    }

    // Build datetime from qso_date and time_on
    let datetime = new Date();
    if (body.qso_date) {
      // Handle ADIF date format (YYYYMMDD) and time format (HHMMSS)
      let dateStr = body.qso_date;
      let timeStr = body.time_on || '000000';
      
      // Convert ADIF date format YYYYMMDD to YYYY-MM-DD
      if (dateStr && dateStr.length === 8) {
        dateStr = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
      }
      
      // Convert ADIF time format HHMMSS to HH:MM:SS
      if (timeStr && timeStr.length === 6) {
        timeStr = `${timeStr.substring(0, 2)}:${timeStr.substring(2, 4)}:${timeStr.substring(4, 6)}`;
      }
      
      datetime = new Date(`${dateStr}T${timeStr}Z`);
    }

    // Insert the QSO
    const insertResult = await query(`
      INSERT INTO contacts (
        user_id, station_id, callsign, band, mode, rst_sent, rst_received,
        datetime, frequency, grid_locator, country, state, cnty,
        notes, name, dxcc, cqz, ituz,
        qsl_sent, qsl_rcvd, lotw_qsl_sent, lotw_qsl_rcvd,
        eqsl_qsl_sent, eqsl_qsl_rcvd, operator
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
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
      body.comment || body.notes || null,
      body.name || null,
      body.dxcc ? parseInt(body.dxcc) : null,
      body.cq_zone ? parseInt(body.cq_zone) : null,
      body.itu_zone ? parseInt(body.itu_zone) : null,
      body.qsl_sent || 'N',
      body.qsl_rcvd || 'N',
      body.lotw_qsl_sent || 'N',
      body.lotw_qsl_rcvd || 'N',
      body.eqsl_qsl_sent || 'N',
      body.eqsl_qsl_rcvd || 'N',
      body.operator || null
    ]);

    const response = NextResponse.json({
      success: true,
      message: 'QSO created successfully',
      qso_id: insertResult.rows[0].id,
      created_at: insertResult.rows[0].created_at
    });

    return addCorsHeaders(addRateLimitHeaders(response, 999, auth.rateLimitPerHour));

  } catch (error) {
    console.error('QSO creation error:', error);
    const response = NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
    return addCorsHeaders(response);
  }
}

// PUT and DELETE methods would go here...