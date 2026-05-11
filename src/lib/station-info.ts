// Shared response builder for wavelog-compatible station_info lookups.
// Used by both /api/station_info (key in JSON body) and
// /api/station_info/[key] (key as path segment — GridTracker's form).

import { NextResponse } from 'next/server';
import { verifyApiKeyValue } from '@/lib/api-auth';
import { addCorsHeaders } from '@/lib/cors';
import { query } from '@/lib/db';

export async function stationInfoResponse(key: string) {
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
