// POST /api/qso — wavelog/cloudlog wire-compatible QSO logging endpoint.
//
// Accepts the exact shape that WSJT-X, JTDX, JS8Call, fldigi, N1MM+, Log4OM
// and other third-party ham radio software send to wavelog:
//   { key, type: "adif", string: "<ADIF text>", station_profile_id }
//
// Returns wavelog's response shape:
//   201 { status: "created", type, string: "", adif_count, adif_errors, messages }
//   400 { status: "abort",   type, string: "", adif_count, adif_errors, messages }
//   401 { status: "failed",  reason }
//   200 { status: "failed",  reason: "wrong JSON" }   (matches wavelog quirk)

import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKeyValue, canAccessStation, canWrite } from '@/lib/api-auth';
import { parseAdifRecords, insertAdifRecord } from '@/lib/adif';
import { addCorsHeaders, createCorsPreflightResponse } from '@/lib/cors';

export async function OPTIONS() {
  return createCorsPreflightResponse();
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    // Wavelog returns HTTP 200 for malformed JSON; match that quirk so clients
    // that special-case status==failed/reason==wrong JSON behave identically.
    return addCorsHeaders(
      NextResponse.json({ status: 'failed', reason: 'wrong JSON' }, { status: 200 }),
    );
  }

  const key = typeof body.key === 'string' ? body.key : '';
  const authResult = await verifyApiKeyValue(key);
  if (!authResult.success || !authResult.auth) {
    return addCorsHeaders(
      NextResponse.json(
        { status: 'failed', reason: 'missing or wrong api key' },
        { status: 401 },
      ),
    );
  }
  const auth = authResult.auth;

  if (!canWrite(auth)) {
    return addCorsHeaders(
      NextResponse.json(
        { status: 'failed', reason: 'API key has no write permission' },
        { status: 401 },
      ),
    );
  }

  const stationProfileId =
    typeof body.station_profile_id === 'number'
      ? body.station_profile_id
      : typeof body.station_profile_id === 'string'
        ? parseInt(body.station_profile_id, 10)
        : NaN;

  if (!Number.isInteger(stationProfileId) || stationProfileId <= 0) {
    return addCorsHeaders(
      NextResponse.json(
        { status: 'failed', reason: 'station id does not belong to the API key owner.' },
        { status: 401 },
      ),
    );
  }
  if (!(await canAccessStation(auth, stationProfileId))) {
    return addCorsHeaders(
      NextResponse.json(
        { status: 'failed', reason: 'station id does not belong to the API key owner.' },
        { status: 401 },
      ),
    );
  }

  const type = typeof body.type === 'string' ? body.type : '';
  const adifString = typeof body.string === 'string' ? body.string : '';

  if (type !== 'adif' || adifString.length === 0) {
    return addCorsHeaders(
      NextResponse.json(
        { status: 'failed', reason: 'unsupported type or empty string' },
        { status: 400 },
      ),
    );
  }

  const records = parseAdifRecords(adifString);
  const messages: string[] = [];
  let adifCount = 0;
  let adifErrors = 0;

  for (const record of records) {
    if (!record.fields.call || record.fields.call.trim() === '') {
      continue;
    }
    adifCount++;
    try {
      const outcome = await insertAdifRecord(record, auth.userId, stationProfileId);
      if (outcome.error) {
        adifErrors++;
        messages.push(outcome.error);
      }
      // skipped (duplicate) is not an error — counts toward adif_count, not adif_errors.
    } catch (error) {
      adifErrors++;
      const msg = error instanceof Error ? error.message : 'Unknown insert error';
      console.error('QSO insert error:', msg);
      messages.push(msg);
    }
  }

  if (adifErrors === 0) {
    return addCorsHeaders(
      NextResponse.json(
        {
          status: 'created',
          type: 'adif',
          string: '',
          adif_count: adifCount,
          adif_errors: 0,
          messages: messages.length > 0 ? messages : [''],
        },
        { status: 201 },
      ),
    );
  }

  return addCorsHeaders(
    NextResponse.json(
      {
        status: 'abort',
        type: 'adif',
        string: '',
        adif_count: adifCount,
        adif_errors: adifErrors,
        messages,
      },
      { status: 400 },
    ),
  );
}
