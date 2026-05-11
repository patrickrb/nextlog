// POST /api/station_info — wavelog wire-compatible station profile listing.
// Body: { "key": "nextlog_..." }
// See /api/station_info/[key] for GridTracker's path-segment-auth variant.

import { NextRequest } from 'next/server';
import { stationInfoResponse } from '@/lib/station-info';
import { createCorsPreflightResponse } from '@/lib/cors';

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
  return stationInfoResponse(key);
}
