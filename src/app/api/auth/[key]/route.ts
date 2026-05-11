// GET /api/auth/<key> — wavelog wire-compatible API key validation.
// Returns XML, matching wavelog's <auth>...</auth> shape. The HTTP status is
// 200 regardless of whether the key is valid (matching wavelog's quirk —
// clients distinguish via the body, not the status).

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

export async function GET(
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
