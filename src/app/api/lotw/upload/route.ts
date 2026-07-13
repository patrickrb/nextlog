// LoTW Upload API endpoint

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { hasValidCronSecret } from '@/lib/cron-auth';
import { query } from '@/lib/db';
import {
  buildSignedTq8,
  generateAdifHash,
  normalizeCallsign,
  decryptString,
  readCertMetadata,
  isQsoWithinCertDateRange,
} from '@/lib/lotw';
import {
  LotwUploadRequest,
  LotwUploadResponse,
  ContactWithLoTW,
  LotwQso,
  LotwStationProfile,
} from '@/types/lotw';

// LoTW (TQSL ≥ 2.7.3) rejects these prop_modes. Wavelog flags such QSOs as 'I'
// (ignore) so they are skipped on every future upload pass.
const LOTW_UNSUPPORTED_PROP_MODES = new Set(['INTERNET', 'RPT']);

const LOTW_UPLOAD_URL = 'https://lotw.arrl.org/lotw/upload';
const LOTW_UPLOAD_ACCEPTED_REGEX = /<!--\s*\.UPL\.\s*accepted\s*-->/i;

export async function POST(request: NextRequest) {
  try {
    // Cron mode requires the valid CRON_SECRET Bearer token — the X-Cron-Job
    // header is only a mode discriminator and grants nothing by itself
    // (it is spoofable by any caller).
    const cronHeaderPresent = request.headers.get('X-Cron-Job') === 'true';
    const isCronJob = cronHeaderPresent && hasValidCronSecret(request);
    if (cronHeaderPresent && !isCronJob) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    let user = null;

    if (isCronJob) {
      // For cron jobs, we'll get the user from the station_id
      user = null; // Will be set later
    } else {
      user = await verifyToken(request);
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body: LotwUploadRequest = await request.json();
    const { station_id, date_from, date_to, upload_method = 'manual' } = body;

    if (!station_id) {
      return NextResponse.json({ 
        error: 'station_id is required' 
      }, { status: 400 });
    }

    // Verify station exists and get user info
    // Expanded station select — buildSignedTq8 needs the full LotwStationProfile
    // (DXCC entity, gridsquare, ITU/CQ zones, state/county) to build a valid .tq8.
    const stationCols = `id, callsign, user_id, dxcc_entity_code, grid_locator,
                         itu_zone, cq_zone, state_province, county`;
    let stationResult;
    if (isCronJob) {
      stationResult = await query(
        `SELECT ${stationCols} FROM stations WHERE id = $1`,
        [station_id]
      );
    } else {
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      stationResult = await query(
        `SELECT ${stationCols} FROM stations WHERE id = $1 AND user_id = $2`,
        [station_id, parseInt(user.userId)]
      );
    }

    if (stationResult.rows.length === 0) {
      return NextResponse.json({ 
        error: 'Station not found or access denied' 
      }, { status: 404 });
    }

    const station = stationResult.rows[0];
    const userId = isCronJob ? station.user_id : parseInt(user!.userId);

    // Get active LoTW certificate for this station. p12_password column is optional;
    // older rows may pre-date the migration, in which case it's null and we sign
    // assuming an empty password (TQSL's default export when no password is set).
    const certResult = await query(
      `SELECT id, p12_cert, p12_password
       FROM lotw_credentials
       WHERE station_id = $1 AND is_active = true
       ORDER BY created_at DESC LIMIT 1`,
      [station_id]
    );

    if (certResult.rows.length === 0) {
      return NextResponse.json({
        error: 'No active LoTW certificate found for this station. Please upload a certificate first.'
      }, { status: 400 });
    }

    const certificate = certResult.rows[0];

    // Decrypt the stored P12 password (if any). Empty string is a valid input
    // to node-forge's pkcs12FromAsn1 for unprotected exports.
    let p12Password = '';
    if (certificate.p12_password) {
      try {
        p12Password = decryptString(certificate.p12_password);
      } catch (decryptErr) {
        console.error('[LoTW Upload] Failed to decrypt p12 password:', decryptErr);
      }
    }

    // Create upload log entry
    const uploadLogResult = await query(
      `INSERT INTO lotw_upload_logs 
       (station_id, user_id, date_from, date_to, status, upload_method) 
       VALUES ($1, $2, $3, $4, 'pending', $5) 
       RETURNING id`,
      [station_id, userId, date_from || null, date_to || null, upload_method]
    );

    const uploadLogId = uploadLogResult.rows[0].id;

    try {
      // Update status to processing
      await query(
        'UPDATE lotw_upload_logs SET status = $1, started_at = NOW() WHERE id = $2',
        ['processing', uploadLogId]
      );

      // Build query for contacts to upload. lotw_qsl_sent='M' means a downstream
      // service confirmed the QSO and the LoTW record needs re-upload to carry
      // updated QSL fields. lotw_qsl_sent='I' means the QSO is in an unsupported
      // prop_mode (e.g., INTERNET) and we never upload it.
      let contactQuery = `
        SELECT c.*, s.callsign as station_callsign
        FROM contacts c
        JOIN stations s ON c.station_id = s.id
        WHERE c.user_id = $1 AND c.station_id = $2
          AND (c.lotw_qsl_sent IS NULL OR c.lotw_qsl_sent IN ('N', 'M'))
      `;
      const queryParams: (string | number)[] = [userId, station_id];
      let paramIndex = 3;

      if (date_from) {
        contactQuery += ` AND c.datetime >= $${paramIndex}`;
        queryParams.push(date_from);
        paramIndex++;
      }
      if (date_to) {
        contactQuery += ` AND c.datetime <= $${paramIndex}`;
        queryParams.push(date_to);
        paramIndex++;
      }
      contactQuery += ` ORDER BY c.datetime ASC`;

      const contactsResult = await query(contactQuery, queryParams);
      const allContacts: ContactWithLoTW[] = contactsResult.rows;

      // Read the cert's qso_start_date / qso_end_date up front so we can filter
      // out-of-range QSOs without having to ingest a parse failure mid-signing.
      // LoTW silently discards QSOs whose date is outside the cert's window
      // (these are the rejection emails that say "QSO date is outside the
      // QSL'able date range for this certificate"), so this filter prevents the
      // upload from "succeeding" while LoTW drops the file on its end.
      let certMetadata: ReturnType<typeof readCertMetadata> | undefined;
      try {
        certMetadata = readCertMetadata(certificate.p12_cert, p12Password);
      } catch (metaError) {
        console.error('[LoTW Upload] Failed to read cert metadata:', metaError);
      }
      const certWindow = certMetadata
        ? { start: certMetadata.qsoStartDate, end: certMetadata.qsoEndDate }
        : { start: undefined, end: undefined };

      // Filter out QSOs whose prop_mode LoTW doesn't accept; flag them as 'I' so
      // they don't keep cycling through future upload passes. Also filter out
      // QSOs outside the cert's allowed QSO date window — those would be
      // silently dropped by LoTW even though our .tq8 is otherwise valid.
      const skipped: ContactWithLoTW[] = [];
      const outOfRange: ContactWithLoTW[] = [];
      const contacts: ContactWithLoTW[] = [];
      for (const c of allContacts) {
        const propMode = (c.prop_mode || '').toUpperCase();
        if (propMode && LOTW_UNSUPPORTED_PROP_MODES.has(propMode)) {
          skipped.push(c);
          continue;
        }
        if (
          !isQsoWithinCertDateRange(
            new Date(c.datetime),
            certWindow.start,
            certWindow.end
          )
        ) {
          outOfRange.push(c);
          continue;
        }
        contacts.push(c);
      }
      if (skipped.length > 0) {
        await query(
          `UPDATE contacts SET lotw_qsl_sent = 'I', updated_at = NOW()
           WHERE id = ANY($1)`,
          [skipped.map(c => c.id)]
        );
      }

      const formatCertWindow = () => {
        if (!certWindow.start && !certWindow.end) return 'unknown';
        const s = certWindow.start
          ? certWindow.start.toISOString().slice(0, 10)
          : '−∞';
        const e = certWindow.end
          ? certWindow.end.toISOString().slice(0, 10)
          : '+∞';
        return `${s} to ${e}`;
      };

      if (contacts.length === 0) {
        const parts: string[] = [];
        if (skipped.length > 0)
          parts.push(`${skipped.length} unsupported prop_mode`);
        if (outOfRange.length > 0)
          parts.push(
            `${outOfRange.length} outside cert's QSO date range (${formatCertWindow()})`
          );
        const reason = parts.length
          ? `No upload-eligible contacts (skipped ${parts.join(', ')})`
          : 'No contacts found for upload';

        await query(
          `UPDATE lotw_upload_logs
           SET status = 'completed', completed_at = NOW(), qso_count = 0,
               error_message = $1
           WHERE id = $2`,
          [reason, uploadLogId]
        );

        const response: LotwUploadResponse = {
          success: true,
          upload_log_id: uploadLogId,
          qso_count: 0,
          error_message: reason,
        };

        return NextResponse.json(response);
      }

      // Build LotwStationProfile from the station row + DXCC-conditional location.
      const stationProfile: LotwStationProfile = {
        callsign: normalizeCallsign(station.callsign),
        dxcc: station.dxcc_entity_code,
        gridsquare: station.grid_locator || undefined,
        ituz: station.itu_zone || undefined,
        cqz: station.cq_zone || undefined,
      };
      // Map state_province + county into the right DXCC-conditional slot.
      const dxcc = station.dxcc_entity_code;
      const stateValue = station.state_province || undefined;
      const countyValue = station.county || undefined;
      if (dxcc === 6 || dxcc === 110 || dxcc === 291) {
        stationProfile.us_state = stateValue;
        stationProfile.us_county = countyValue;
      } else if (dxcc === 1) {
        stationProfile.ca_province = stateValue;
      } else if ([15, 54, 61, 125, 151].includes(dxcc)) {
        stationProfile.ru_oblast = stateValue;
      } else if (dxcc === 318) {
        stationProfile.cn_province = stateValue;
      } else if (dxcc === 150) {
        stationProfile.au_state = stateValue;
      } else if (dxcc === 339) {
        stationProfile.ja_prefecture = stateValue;
        stationProfile.ja_city_gun_ku = countyValue;
      } else if (dxcc === 5 || dxcc === 224) {
        stationProfile.fi_kunta = stateValue;
      }

      if (!stationProfile.dxcc) {
        await query(
          `UPDATE lotw_upload_logs SET status = 'failed', completed_at = NOW(),
                  error_message = 'Station is missing dxcc_entity_code; cannot build LoTW upload'
           WHERE id = $1`,
          [uploadLogId]
        );
        return NextResponse.json({
          success: false,
          upload_log_id: uploadLogId,
          error_message: 'Station is missing dxcc_entity_code; please set it before uploading to LoTW.'
        }, { status: 400 });
      }

      // Convert contacts to LotwQso[]; normalize callsigns (W1AW_P → W1AW/P).
      const qsos: LotwQso[] = contacts.map(c => ({
        call: normalizeCallsign(c.callsign),
        band: c.band || '',
        band_rx: c.band_rx,
        mode: c.mode || '',
        // contacts.frequency is numeric(10,6) and stores MHz directly. pg returns
        // numeric as a string by default, so coerce to Number for the LotwQso type.
        freq: c.frequency ? Number(c.frequency) : undefined,
        freq_rx: c.freq_rx ? Number(c.freq_rx) : undefined,
        prop_mode: c.prop_mode,
        sat_name: c.sat_name,
        datetime: new Date(c.datetime),
      }));

      // Sign + gzip the .tq8.
      let tq8: Buffer;
      try {
        tq8 = await buildSignedTq8({
          p12: certificate.p12_cert,
          p12Password,
          station: stationProfile,
          qsos,
        });
      } catch (signError) {
        console.error('LoTW .tq8 build error:', signError);
        await query(
          `UPDATE lotw_upload_logs
           SET status = 'failed', completed_at = NOW(), error_message = $1
           WHERE id = $2`,
          [`Failed to sign .tq8: ${signError instanceof Error ? signError.message : 'Unknown error'}`, uploadLogId]
        );
        return NextResponse.json({
          success: false,
          upload_log_id: uploadLogId,
          error_message: `Failed to sign .tq8: ${signError instanceof Error ? signError.message : 'Unknown error'}`
        }, { status: 500 });
      }

      const fileHash = generateAdifHash(tq8.toString('binary'));
      await query(
        `UPDATE lotw_upload_logs
         SET qso_count = $1, file_hash = $2, file_size_bytes = $3
         WHERE id = $4`,
        [contacts.length, fileHash, tq8.length, uploadLogId]
      );

      // Upload to LoTW as multipart/form-data with field name "upfile" (per
      // wavelog Lotw.php:312-315). FormData with a Blob handles the boundary.
      let lotwResponse = '';
      try {
        const fd = new FormData();
        const blob = new Blob([new Uint8Array(tq8)], { type: 'application/octet-stream' });
        fd.append('upfile', blob, `${stationProfile.callsign}.tq8`);
        const uploadResponse = await fetch(LOTW_UPLOAD_URL, { method: 'POST', body: fd });
        lotwResponse = await uploadResponse.text();
        if (!uploadResponse.ok) {
          throw new Error(`LoTW upload HTTP ${uploadResponse.status}: ${lotwResponse.slice(0, 500)}`);
        }
        // LoTW returns 200 even for some failures; the body must contain the
        // success marker or the upload was not actually accepted.
        if (!LOTW_UPLOAD_ACCEPTED_REGEX.test(lotwResponse)) {
          throw new Error(`LoTW did not accept upload: ${lotwResponse.slice(0, 500)}`);
        }
      } catch (uploadError) {
        console.error('LoTW upload error:', uploadError);
        
        await query(
          `UPDATE lotw_upload_logs 
           SET status = 'failed', completed_at = NOW(), 
               error_message = $1, lotw_response = $2 
           WHERE id = $3`,
          [`Upload to LoTW failed: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`, lotwResponse, uploadLogId]
        );

        return NextResponse.json({ 
          success: false,
          upload_log_id: uploadLogId,
          error_message: `Upload to LoTW failed: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`
        }, { status: 500 });
      }

      // Mark contacts as uploaded to LoTW
      const contactIds = contacts.map(c => c.id);
      await query(
        `UPDATE contacts
         SET lotw_qsl_sent = 'Y', updated_at = NOW()
         WHERE id = ANY($1)`,
        [contactIds]
      );

      // Surface the out-of-range count alongside the success log so it's
      // visible on the /lotw upload log table — those QSOs aren't on LoTW
      // and the operator needs to know either to renew the cert or to fix
      // the QSO dates.
      const partialNotice = outOfRange.length
        ? `Skipped ${outOfRange.length} QSO${outOfRange.length === 1 ? '' : 's'} outside cert's QSO date range (${formatCertWindow()})`
        : null;

      // Update upload log as completed
      await query(
        `UPDATE lotw_upload_logs
         SET status = 'completed', completed_at = NOW(),
             success_count = $1, lotw_response = $2,
             error_message = $3
         WHERE id = $4`,
        [contacts.length, lotwResponse, partialNotice, uploadLogId]
      );

      const response: LotwUploadResponse = {
        success: true,
        upload_log_id: uploadLogId,
        qso_count: contacts.length,
        lotw_response: lotwResponse,
        ...(partialNotice ? { error_message: partialNotice } : {}),
      };

      return NextResponse.json(response);

    } catch (error) {
      console.error('Upload processing error:', error);
      
      // Update log with error
      await query(
        `UPDATE lotw_upload_logs 
         SET status = 'failed', completed_at = NOW(), 
             error_message = $1 
         WHERE id = $2`,
        [error instanceof Error ? error.message : 'Unknown error', uploadLogId]
      );

      return NextResponse.json({ 
        success: false,
        upload_log_id: uploadLogId,
        error_message: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('LoTW upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const stationId = searchParams.get('station_id');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query for upload logs
    let logQuery = `
      SELECT lul.*, s.callsign as station_callsign
      FROM lotw_upload_logs lul
      JOIN stations s ON lul.station_id = s.id
      WHERE lul.user_id = $1
    `;
    const queryParams: (string | number)[] = [parseInt(user.userId)];
    let paramIndex = 2;

    if (stationId) {
      logQuery += ` AND lul.station_id = $${paramIndex}`;
      queryParams.push(parseInt(stationId));
      paramIndex++;
    }

    logQuery += ` ORDER BY lul.started_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const logsResult = await query(logQuery, queryParams);

    return NextResponse.json({
      upload_logs: logsResult.rows,
      pagination: {
        limit,
        offset,
        total: logsResult.rows.length
      }
    });

  } catch (error) {
    console.error('Upload logs retrieval error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}