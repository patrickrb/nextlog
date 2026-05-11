// POST /api/check_auth — wavelog wire-compatible JSON variant of /api/auth/<key>.
// Body: { "key": "nextlog_..." }
// Returns 200 { status: "valid", rights: "rw"|"r" } or 401 { status, reason }.

import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKeyValue } from '@/lib/api-auth';
import { addCorsHeaders, createCorsPreflightResponse } from '@/lib/cors';

export async function OPTIONS() {
  return createCorsPreflightResponse();
}

export async function POST(request: NextRequest) {
  let key = '';
  try {
    const body = await request.json();
    if (typeof body?.key === 'string') key = body.key;
  } catch {
    // fall through to invalid-key response
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
    NextResponse.json(
      { status: 'valid', rights: authResult.auth.isReadOnly ? 'r' : 'rw' },
      { status: 200 },
    ),
  );
}
