// POST /api/version — wavelog wire-compatible version probe.
// Body: { "key": "nextlog_..." }
// Returns 200 { status: "ok", version: "<wavelog-compat-version>" } or 401 on bad key.
//
// The version string is what GridTracker / Log4OM-style clients compare
// against to decide which features are available. We report a recent
// wavelog version so clients enable the full feature set they'd use with
// real wavelog.

import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKeyValue } from '@/lib/api-auth';
import { addCorsHeaders, createCorsPreflightResponse } from '@/lib/cors';

const WAVELOG_COMPAT_VERSION = '2.7.0';

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

  return addCorsHeaders(
    NextResponse.json({ status: 'ok', version: WAVELOG_COMPAT_VERSION }, { status: 200 }),
  );
}
