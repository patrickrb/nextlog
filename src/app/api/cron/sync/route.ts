// Unified sync cron. Called hourly (vercel.json) or by an external scheduler
// with the CRON_SECRET Bearer token. Runs, in order:
//
//   1. QRZ upload sweep      — pending QSOs to each station's QRZ logbook
//   2. LoTW upload           — pending QSOs signed + uploaded per station
//   3. QRZ confirmation download
//   4. LoTW confirmation download
//
// Uploads run before downloads so freshly logged QSOs can confirm in the same
// cycle, and QRZ/LoTW legs are serialized so the cross-service re-upload
// flags ('M') never race. Every leg is incremental and idempotent, so any
// cadence is safe.

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hasValidCronSecret } from '@/lib/cron-auth';
import {
  uploadPendingForStation,
  downloadConfirmationsForStation,
} from '@/lib/qrz-sync-service';
import { StationData } from '@/models/Station';

// Per-station cap per run; the next hourly run picks up the remainder.
const QRZ_UPLOAD_CAP = 250;

interface StationLegResult {
  station_id: number;
  callsign: string;
  status: 'success' | 'error' | 'skipped';
  [key: string]: unknown;
}

// Stations eligible for QRZ sync: active, keyed, owner opted into auto-sync.
async function getQrzStations(): Promise<Array<StationData & { user_id: number }>> {
  const result = await query(`
    SELECT s.*
    FROM stations s
    JOIN users u ON s.user_id = u.id
    WHERE s.is_active = true
      AND s.qrz_api_key IS NOT NULL
      AND u.qrz_auto_sync = true
  `);
  return result.rows;
}

// Stations eligible for LoTW sync (same selection the dedicated LoTW cron
// routes used). requireCert: uploads need an active signing certificate;
// downloads only need username/password credentials.
async function getLotwStations(requireCert: boolean): Promise<Array<{ id: number; callsign: string; user_id: number }>> {
  const certJoin = requireCert
    ? 'LEFT JOIN lotw_credentials lc ON s.id = lc.station_id AND lc.is_active = true'
    : '';
  const certFilter = requireCert ? 'AND lc.id IS NOT NULL' : '';
  const result = await query(`
    SELECT DISTINCT s.id, s.callsign, s.user_id
    FROM stations s
    ${certJoin}
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.is_active = true
      AND (
        (s.lotw_username IS NOT NULL AND s.lotw_password IS NOT NULL)
        OR (u.third_party_services->>'lotw' IS NOT NULL)
      )
      ${certFilter}
  `);
  return result.rows;
}

// Skip a LoTW leg when a run for the station completed or is still processing
// within the last hour (prevents overlap when the cron cadence is dense).
async function ranRecently(logTable: 'lotw_upload_logs' | 'lotw_download_logs', stationId: number): Promise<boolean> {
  const result = await query(
    `SELECT id FROM ${logTable}
     WHERE station_id = $1
       AND started_at > NOW() - INTERVAL '1 hour'
       AND status IN ('processing', 'completed')
     LIMIT 1`,
    [stationId]
  );
  return result.rows.length > 0;
}

// Invoke the LoTW upload/download API routes internally. They own the
// lotw_upload_logs / lotw_download_logs bookkeeping; cron mode is authorized
// by the CRON_SECRET Bearer header.
async function callLotwRoute(
  path: '/api/lotw/upload' | '/api/lotw/download',
  body: Record<string, unknown>
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Cron-Job': 'true',
      'Authorization': `Bearer ${process.env.CRON_SECRET}`,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  return { ok: response.ok, data };
}

export async function GET(request: NextRequest) {
  try {
    // Auth gates first: fail closed when CRON_SECRET is unset and reject bad
    // tokens before any other checks, so unauthenticated callers can't probe
    // deployment configuration (and the cheapest check runs first).
    if (!process.env.CRON_SECRET) {
      console.error('CRON_SECRET is not configured; refusing cron request');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    if (!hasValidCronSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'ENCRYPTION_SECRET'];
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingEnvVars.length > 0) {
      console.error('Missing required environment variables:', missingEnvVars);
      return NextResponse.json({
        error: 'Server configuration error',
        details: `Missing environment variables: ${missingEnvVars.join(', ')}`
      }, { status: 500 });
    }

    const qrzUpload: StationLegResult[] = [];
    const lotwUpload: StationLegResult[] = [];
    const qrzDownload: StationLegResult[] = [];
    const lotwDownload: StationLegResult[] = [];

    const qrzStations = await getQrzStations();

    // 1. QRZ upload sweep
    for (const station of qrzStations) {
      try {
        const sweep = await uploadPendingForStation(station.user_id, station, QRZ_UPLOAD_CAP);
        qrzUpload.push({
          station_id: station.id,
          callsign: station.callsign,
          status: sweep.failed > 0 ? 'error' : 'success',
          processed: sweep.processed,
          sent: sweep.sent,
          confirmed: sweep.confirmed,
          failed: sweep.failed,
          error: sweep.first_error ?? null,
        });
      } catch (error) {
        console.error(`QRZ upload sweep failed for station ${station.callsign}:`, error);
        qrzUpload.push({
          station_id: station.id,
          callsign: station.callsign,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // 2. LoTW upload
    for (const station of await getLotwStations(true)) {
      try {
        if (await ranRecently('lotw_upload_logs', station.id)) {
          lotwUpload.push({ station_id: station.id, callsign: station.callsign, status: 'skipped', reason: 'uploaded_recently' });
          continue;
        }
        const { ok, data } = await callLotwRoute('/api/lotw/upload', {
          station_id: station.id,
          upload_method: 'automatic',
        });
        if (!ok) {
          console.error(`LoTW upload failed for station ${station.callsign}:`, data.error ?? data.error_message);
        }
        lotwUpload.push({
          station_id: station.id,
          callsign: station.callsign,
          status: ok ? 'success' : 'error',
          qso_count: data.qso_count ?? 0,
          error: ok ? null : (data.error ?? data.error_message ?? 'Unknown error'),
        });
      } catch (error) {
        console.error(`Error processing LoTW upload for station ${station.callsign}:`, error);
        lotwUpload.push({
          station_id: station.id,
          callsign: station.callsign,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // 3. QRZ confirmation download (incremental via qrz_last_qsl_rcvd_date)
    for (const station of qrzStations) {
      try {
        const download = await downloadConfirmationsForStation(station.user_id, station);
        qrzDownload.push({
          station_id: station.id,
          callsign: station.callsign,
          status: download.success ? 'success' : 'error',
          qsos_downloaded: download.qsos_downloaded,
          confirmations_found: download.confirmations_found,
          error: download.success ? null : (download.error ?? 'Unknown error'),
        });
      } catch (error) {
        console.error(`QRZ download failed for station ${station.callsign}:`, error);
        qrzDownload.push({
          station_id: station.id,
          callsign: station.callsign,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // 4. LoTW confirmation download
    for (const station of await getLotwStations(false)) {
      try {
        if (await ranRecently('lotw_download_logs', station.id)) {
          lotwDownload.push({ station_id: station.id, callsign: station.callsign, status: 'skipped', reason: 'downloaded_recently' });
          continue;
        }
        const { ok, data } = await callLotwRoute('/api/lotw/download', {
          station_id: station.id,
          download_method: 'automatic',
        });
        if (!ok) {
          console.error(`LoTW download failed for station ${station.callsign}:`, data.error ?? data.error_message);
        }
        lotwDownload.push({
          station_id: station.id,
          callsign: station.callsign,
          status: ok ? 'success' : 'error',
          confirmations_found: data.confirmations_found ?? 0,
          confirmations_matched: data.confirmations_matched ?? 0,
          error: ok ? null : (data.error ?? data.error_message ?? 'Unknown error'),
        });
      } catch (error) {
        console.error(`Error processing LoTW download for station ${station.callsign}:`, error);
        lotwDownload.push({
          station_id: station.id,
          callsign: station.callsign,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      qrz_upload: qrzUpload,
      lotw_upload: lotwUpload,
      qrz_download: qrzDownload,
      lotw_download: lotwDownload,
    });

  } catch (error) {
    console.error('Sync cron error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
