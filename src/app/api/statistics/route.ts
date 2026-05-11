// POST /api/statistics — wavelog wire-compatible QSO statistics.
// Body: { "key": "nextlog_..." }
// Returns 200 with { Today, total_qsos, month_qsos, year_qsos } counts for
// the API key's owner. Some third-party clients (GridTracker, dashboards)
// pre-flight this endpoint when validating an API key.

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

  // Station scoping: if the key targets a single station, restrict counts to
  // that station's QSOs; otherwise count across all of the user's stations.
  const stationClause = auth.stationId !== null ? ' AND station_id = $2' : '';
  const baseParams: (number | null)[] = auth.stationId !== null ? [auth.userId, auth.stationId] : [auth.userId];

  const sql = `
    SELECT
      COUNT(*) FILTER (WHERE datetime >= date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')) AS today,
      COUNT(*) FILTER (WHERE datetime >= date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')) AS month_qsos,
      COUNT(*) FILTER (WHERE datetime >= date_trunc('year', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')) AS year_qsos,
      COUNT(*) AS total_qsos
    FROM contacts
    WHERE user_id = $1${stationClause}
  `;

  const result = await query(sql, baseParams);
  const row = result.rows[0];

  return addCorsHeaders(
    NextResponse.json(
      {
        Today: Number(row.today),
        total_qsos: Number(row.total_qsos),
        month_qsos: Number(row.month_qsos),
        year_qsos: Number(row.year_qsos),
      },
      { status: 200 },
    ),
  );
}
