// /api/auth/<key> — wavelog wire-compatible API key validation.
// Returns XML, matching wavelog's <auth>...</auth> shape. The HTTP status is
// 200 regardless of whether the key is valid (matching wavelog's quirk —
// clients distinguish via the body, not the status).
//
// Accepts both GET and POST: wavelog runs on CodeIgniter, whose controllers
// answer any HTTP method by default, and several clients (GridTracker, in
// particular) POST to this URL even though the key is in the path. Honor
// both verbs so those clients work.

import { NextRequest } from 'next/server';
import { verifyApiKeyValue } from '@/lib/api-auth';

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';

function xmlResponse(body: string) {
  return new Response(`${XML_HEADER}\n${body}\n`, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function invalidKeyResponse() {
  return xmlResponse('<auth>\n  <message>Key Invalid - either not found or disabled</message>\n</auth>');
}

async function handle(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const authResult = await verifyApiKeyValue(key);
  if (!authResult.success || !authResult.auth) {
    return invalidKeyResponse();
  }

  const rights = authResult.auth.isReadOnly ? 'r' : 'rw';
  return xmlResponse(`<auth>\n  <status>Valid</status>\n  <rights>${rights}</rights>\n</auth>`);
}

export const GET = handle;
export const POST = handle;

export function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'Access-Control-Max-Age': '86400',
    },
  });
}
