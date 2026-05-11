// POST /api/station_info/<key> — wavelog wire-compatible variant where the
// API key is passed as a path segment. GridTracker uses this form when
// fetching the station profile list after a successful auth.

import { NextRequest } from 'next/server';
import { stationInfoResponse } from '@/lib/station-info';
import { createCorsPreflightResponse } from '@/lib/cors';

export async function OPTIONS() {
  return createCorsPreflightResponse();
}

async function handle(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  return stationInfoResponse(key);
}

export const GET = handle;
export const POST = handle;
