// POST /api/station_info — wavelog wire-compatible station profile listing.
// Body: { "key": "nextlog_..." }
// Returns 200 with an array of station profiles in wavelog's shape. Respects
// per-key station scoping (api_keys.station_id): a key scoped to a single
// station only sees that station.

import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKeyValue } from '@/lib/api-auth';
import { addCorsHeaders, createCorsPreflightResponse } from '@/lib/cors';
import { query } from '@/lib/db';

export async function OPTIONS() {
  return createCorsPreflightResponse();
}

export async function POST(request: NextRequest) {
  let key = '';
  try {
    const body = await request.json();
    if (typeof body?.key === 'string') key = body.key;
  } catch {
    // fall through to auth failure
  }

  const authResult = await verifyApiKeyValue(key);
  if (!authResult.success || !authResult.auth) {
    return addCorsHeaders(
      NextResponse.json(
        { status: 'failed', reason: 'missing or invalid api key' },
        { status: 401 },
      ),
    );
  }
  const auth = authResult.auth;

  const sql = auth.stationId !== null
    ? 'SELECT id, station_name, grid_locator, callsign, is_active FROM stations WHERE user_id = $1 AND id = $2 ORDER BY id'
    : 'SELECT id, station_name, grid_locator, callsign, is_active FROM stations WHERE user_id = $1 ORDER BY id';
  const params = auth.stationId !== null ? [auth.userId, auth.stationId] : [auth.userId];

  const result = await query(sql, params);

  // Wavelog returns a plain JSON array (not wrapped in {success,...}), with
  // station_active as 1/0 (not boolean) and a station_uuid string. Nextlog
  // doesn't have a uuid column — return the id as a string so clients that
  // key off it still get a stable value.
  const stations = result.rows.map((row: Record<string, unknown>) => ({
    station_id: row.id,
    station_profile_name: row.station_name,
    station_gridsquare: row.grid_locator ?? '',
    station_callsign: row.callsign,
    station_active: row.is_active ? 1 : 0,
    station_uuid: String(row.id),
  }));

  return addCorsHeaders(NextResponse.json(stations, { status: 200 }));
}
