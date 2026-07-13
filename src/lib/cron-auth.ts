// Strict cron authentication.
//
// Vercel attaches `Authorization: Bearer ${CRON_SECRET}` to cron invocations
// automatically when the CRON_SECRET env var is set on the project.
// Self-hosted operators pass the same header from their external scheduler
// (see README "Scheduled sync"). There is no trusted-host fallback: host and
// user-agent headers are caller-controlled and must never grant auth.

import { NextRequest } from 'next/server';

export function hasValidCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}
