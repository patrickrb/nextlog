// Shared LoTW upload/download sync logic.
//
// Called in-process by both the user-facing API routes (/api/lotw/upload,
// /api/lotw/download) and the unified sync cron (/api/cron/sync). The cron
// previously re-entered the app over HTTP (fetch to NEXTAUTH_URL/localhost),
// which fails in serverless environments — keep all callers on these
// functions instead of self-fetching.

import { query } from '@/lib/db';
import {
  buildSignedTq8,
  generateAdifHash,
  normalizeCallsign,
  decryptString,
  readCertMetadata,
  isQsoWithinCertDateRange,
  parseLoTWAdif,
  matchLoTWConfirmations,
  buildLoTWDownloadUrl,
  fetchLotwWithRetry,
  LOTW_USER_AGENT,
} from '@/lib/lotw';
import {
  LotwUploadResponse,
  LotwDownloadResponse,
  ContactWithLoTW,
  LotwQso,
  LotwStationProfile,
} from '@/types/lotw';

// LoTW (TQSL ≥ 2.7.3) rejects these prop_modes. Wavelog flags such QSOs as 'I'
// (ignore) so they are skipped on every future upload pass.
const LOTW_UNSUPPORTED_PROP_MODES = new Set(['INTERNET', 'RPT']);

const LOTW_UPLOAD_URL = 'https://lotw.arrl.org/lotw/upload';
const LOTW_UPLOAD_ACCEPTED_REGEX = /<!--\s*\.UPL\.\s*accepted\s*-->/i;

// HTTP-shaped outcome so API routes can pass it straight to NextResponse.json
// and cron callers can branch on status without an HTTP round trip.
export interface LotwSyncOutcome<T> {
  status: number;
  body: T | { error: string };
}

interface LotwSyncOptions {
  stationId: number;
  // When set, the station must belong to this user (user-facing API path).
  // When omitted, the caller is trusted (cron) and the station's own user_id
  // is used for logging and contact scoping.
  requesterUserId?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface LotwUploadOptions extends LotwSyncOptions {
  uploadMethod?: 'manual' | 'automatic' | 'scheduled';
}

export interface LotwDownloadOptions extends LotwSyncOptions {
  downloadMethod?: 'manual' | 'automatic' | 'scheduled';
}

export async function performLotwUpload(
  options: LotwUploadOptions
): Promise<LotwSyncOutcome<LotwUploadResponse>> {
  const { stationId, requesterUserId, dateFrom, dateTo, uploadMethod = 'manual' } = options;

  // Verify station exists and get user info
  // Expanded station select — buildSignedTq8 needs the full LotwStationProfile
  // (DXCC entity, gridsquare, ITU/CQ zones, state/county) to build a valid .tq8.
  const stationCols = `id, callsign, user_id, dxcc_entity_code, grid_locator,
                       itu_zone, cq_zone, state_province, county`;
  const stationResult =
    requesterUserId !== undefined
      ? await query(
          `SELECT ${stationCols} FROM stations WHERE id = $1 AND user_id = $2`,
          [stationId, requesterUserId]
        )
      : await query(`SELECT ${stationCols} FROM stations WHERE id = $1`, [stationId]);

  if (stationResult.rows.length === 0) {
    return { status: 404, body: { error: 'Station not found or access denied' } };
  }

  const station = stationResult.rows[0];
  const userId = requesterUserId ?? station.user_id;

  // Get active LoTW certificate for this station. p12_password column is optional;
  // older rows may pre-date the migration, in which case it's null and we sign
  // assuming an empty password (TQSL's default export when no password is set).
  const certResult = await query(
    `SELECT id, p12_cert, p12_password
     FROM lotw_credentials
     WHERE station_id = $1 AND is_active = true
     ORDER BY created_at DESC LIMIT 1`,
    [stationId]
  );

  if (certResult.rows.length === 0) {
    return {
      status: 400,
      body: {
        error: 'No active LoTW certificate found for this station. Please upload a certificate first.',
      },
    };
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
    [stationId, userId, dateFrom || null, dateTo || null, uploadMethod]
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
    const queryParams: (string | number)[] = [userId, stationId];
    let paramIndex = 3;

    if (dateFrom) {
      contactQuery += ` AND c.datetime >= $${paramIndex}`;
      queryParams.push(dateFrom);
      paramIndex++;
    }
    if (dateTo) {
      contactQuery += ` AND c.datetime <= $${paramIndex}`;
      queryParams.push(dateTo);
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

      return {
        status: 200,
        body: {
          success: true,
          upload_log_id: uploadLogId,
          qso_count: 0,
          error_message: reason,
        },
      };
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
      return {
        status: 400,
        body: {
          success: false,
          upload_log_id: uploadLogId,
          error_message: 'Station is missing dxcc_entity_code; please set it before uploading to LoTW.',
        },
      };
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
      return {
        status: 500,
        body: {
          success: false,
          upload_log_id: uploadLogId,
          error_message: `Failed to sign .tq8: ${signError instanceof Error ? signError.message : 'Unknown error'}`,
        },
      };
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
      const uploadResponse = await fetchLotwWithRetry(() => {
        const fd = new FormData();
        const blob = new Blob([new Uint8Array(tq8)], { type: 'application/octet-stream' });
        fd.append('upfile', blob, `${stationProfile.callsign}.tq8`);
        // Only set User-Agent — fetch sets the multipart Content-Type (with
        // boundary) from the FormData body, so don't override it.
        return fetch(LOTW_UPLOAD_URL, {
          method: 'POST',
          body: fd,
          headers: { 'User-Agent': LOTW_USER_AGENT },
        });
      }, 'upload');
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

      return {
        status: 500,
        body: {
          success: false,
          upload_log_id: uploadLogId,
          error_message: `Upload to LoTW failed: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`,
        },
      };
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

    return {
      status: 200,
      body: {
        success: true,
        upload_log_id: uploadLogId,
        qso_count: contacts.length,
        lotw_response: lotwResponse,
        ...(partialNotice ? { error_message: partialNotice } : {}),
      },
    };
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

    return {
      status: 500,
      body: {
        success: false,
        upload_log_id: uploadLogId,
        error_message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

export async function performLotwDownload(
  options: LotwDownloadOptions
): Promise<LotwSyncOutcome<LotwDownloadResponse>> {
  const { stationId, requesterUserId, dateFrom, dateTo, downloadMethod = 'manual' } = options;

  // Verify station exists and get LoTW credentials
  const stationSelect = `
    SELECT s.id, s.callsign, s.lotw_username, s.lotw_password, s.user_id,
           s.lotw_last_qsl_rcvd_date, u.third_party_services
    FROM stations s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = $1`;
  const stationResult =
    requesterUserId !== undefined
      ? await query(`${stationSelect} AND s.user_id = $2`, [stationId, requesterUserId])
      : await query(stationSelect, [stationId]);

  if (stationResult.rows.length === 0) {
    return { status: 404, body: { error: 'Station not found or access denied' } };
  }

  const station = stationResult.rows[0];
  const userId = requesterUserId ?? station.user_id;

  // Get LoTW credentials from station or user third_party_services
  let lotwUsername = station.lotw_username;
  let lotwPassword = station.lotw_password;
  let credentialSource = 'none';

  // Try user's third_party_services if station doesn't have credentials
  if (!lotwUsername || !lotwPassword) {
    const thirdPartyServices = station.third_party_services;

    if (thirdPartyServices?.lotw) {
      lotwUsername = thirdPartyServices.lotw.username;
      try {
        lotwPassword = decryptString(thirdPartyServices.lotw.password);
        credentialSource = 'user';
      } catch (error) {
        console.error('[LoTW Download] Failed to decrypt user password:', error);
        lotwPassword = undefined;
      }
    }
  } else if (lotwPassword) {
    // Decrypt station password if it exists
    try {
      lotwPassword = decryptString(lotwPassword);
      credentialSource = 'station';
    } catch (error) {
      console.error('[LoTW Download] Failed to decrypt station password:', error);
      lotwPassword = undefined;
    }
  }

  if (!lotwUsername || !lotwPassword) {
    console.error(`[LoTW Download] No valid credentials found. Username: ${!!lotwUsername}, Password: ${!!lotwPassword}, Source attempted: ${credentialSource}`);

    const errorMessage = credentialSource === 'none'
      ? 'LoTW credentials not configured. Please configure LoTW credentials in Settings > LoTW Integration (either at User level for all stations, or Station level for this specific station).'
      : 'LoTW credentials are incomplete or invalid. Please reconfigure them in Settings > LoTW Integration.';

    return { status: 400, body: { error: errorMessage } };
  }

  // Create download log entry
  const downloadLogResult = await query(
    `INSERT INTO lotw_download_logs
     (station_id, user_id, date_from, date_to, status, download_method)
     VALUES ($1, $2, $3, $4, 'pending', $5)
     RETURNING id`,
    [stationId, userId, dateFrom || null, dateTo || null, downloadMethod]
  );

  const downloadLogId = downloadLogResult.rows[0].id;

  try {
    // Update status to processing
    await query(
      'UPDATE lotw_download_logs SET status = $1, started_at = NOW() WHERE id = $2',
      ['processing', downloadLogId]
    );

    // Incremental fetch for scheduled runs: resume from the newest QSL date
    // already applied (qso_qslsince filters by QSL date, not QSO date, so
    // the local contacts query below must stay unfiltered by this date —
    // confirmations can arrive for arbitrarily old QSOs).
    let urlDateFrom = dateFrom;
    if (!urlDateFrom && downloadMethod !== 'manual' && station.lotw_last_qsl_rcvd_date) {
      const last = station.lotw_last_qsl_rcvd_date;
      urlDateFrom = last instanceof Date ? last.toISOString().split('T')[0] : String(last);
    }

    // Build LoTW download URL
    const downloadUrl = buildLoTWDownloadUrl(lotwUsername, lotwPassword, {
      dateFrom: urlDateFrom,
      dateTo,
      ownCallsign: station.callsign,
    });

    // Download confirmations from LoTW
    let adifContent: string;
    try {
      const downloadResponse = await fetchLotwWithRetry(
        () =>
          fetch(downloadUrl, {
            method: 'GET',
            headers: { 'User-Agent': LOTW_USER_AGENT },
          }),
        'download'
      );

      if (!downloadResponse.ok) {
        throw new Error(`LoTW download failed: ${downloadResponse.status} ${downloadResponse.statusText}`);
      }

      adifContent = await downloadResponse.text();

      // Check if the response indicates an authentication error
      if (adifContent.includes('Invalid login') || adifContent.includes('Login failed')) {
        throw new Error('Invalid LoTW credentials');
      }

    } catch (downloadError) {
      console.error('LoTW download error:', downloadError);

      await query(
        `UPDATE lotw_download_logs
         SET status = 'failed', completed_at = NOW(),
             error_message = $1
         WHERE id = $2`,
        [`Download from LoTW failed: ${downloadError instanceof Error ? downloadError.message : 'Unknown error'}`, downloadLogId]
      );

      return {
        status: 500,
        body: {
          success: false,
          download_log_id: downloadLogId,
          error_message: `Download from LoTW failed: ${downloadError instanceof Error ? downloadError.message : 'Unknown error'}`,
        },
      };
    }

    // Parse ADIF confirmations
    const confirmations = parseLoTWAdif(adifContent);

    if (confirmations.length === 0) {
      await query(
        `UPDATE lotw_download_logs
         SET status = 'completed', completed_at = NOW(),
             qso_count = 0, confirmations_found = 0, confirmations_matched = 0,
             error_message = 'No confirmations found in LoTW response'
         WHERE id = $1`,
        [downloadLogId]
      );

      return {
        status: 200,
        body: {
          success: true,
          download_log_id: downloadLogId,
          confirmations_found: 0,
          confirmations_matched: 0,
          confirmations_unmatched: 0,
          error_message: 'No confirmations found in LoTW response',
        },
      };
    }

    // Get contacts from this station to match against. Join the station
    // callsign so the matcher can disambiguate multi-station accounts
    // against LoTW's app_lotw_owncall.
    let contactQuery = `
      SELECT c.*, s.callsign as station_callsign
      FROM contacts c
      JOIN stations s ON c.station_id = s.id
      WHERE c.user_id = $1 AND c.station_id = $2
    `;
    const queryParams: (string | number)[] = [userId, stationId];

    if (dateFrom || dateTo) {
      if (dateFrom) {
        contactQuery += ` AND c.datetime >= $3`;
        queryParams.push(dateFrom);
      }
      if (dateTo) {
        const paramIndex = queryParams.length + 1;
        contactQuery += ` AND c.datetime <= $${paramIndex}`;
        queryParams.push(dateTo);
      }
    }

    contactQuery += ` ORDER BY c.datetime ASC`;

    const contactsResult = await query(contactQuery, queryParams);
    const contacts: ContactWithLoTW[] = contactsResult.rows;

    // Match confirmations with local contacts
    const matches = matchLoTWConfirmations(confirmations, contacts);

    let matchedCount = 0;
    let unmatchedCount = confirmations.length;
    let failedCount = 0;
    let firstApplyError: string | null = null;
    const appliedQslDates: string[] = [];

    // Apply each confirmation: set LoTW QSL flags, enrich location fields
    // (state/county/CQZ/ITUZ/DXCC/country/grid/iota), and cross-flag QRZ
    // for re-upload when the QSO was already in QRZ ('Y' → 'M').
    for (const match of matches) {
      const conf = match.confirmation;

      // Build a dynamic UPDATE — only set fields LoTW returned non-empty.
      const sets: string[] = [
        'qsl_lotw = true',
        `lotw_qsl_rcvd = 'Y'`,
        'lotw_match_status = $1',
        'updated_at = NOW()',
      ];
      const params: (string | number | Date)[] = [match.matchStatus];

      const addEnrich = (col: string, value: string | undefined) => {
        if (!value) return;
        params.push(value);
        sets.push(`${col} = $${params.length}`);
      };
      addEnrich('state', conf.state);
      addEnrich('cnty', conf.cnty);
      if (conf.cqz) {
        const n = parseInt(conf.cqz, 10);
        if (!Number.isNaN(n)) { params.push(n); sets.push(`cqz = $${params.length}`); }
      }
      if (conf.ituz) {
        const n = parseInt(conf.ituz, 10);
        if (!Number.isNaN(n)) { params.push(n); sets.push(`ituz = $${params.length}`); }
      }
      if (conf.dxcc) {
        const n = parseInt(conf.dxcc, 10);
        if (!Number.isNaN(n)) { params.push(n); sets.push(`dxcc = $${params.length}`); }
      }
      addEnrich('country', conf.country);
      // Only update gridsquare if LoTW reported one and ours was missing/different.
      if (conf.gridsquare && conf.gridsquare !== match.contact.grid_locator) {
        params.push(conf.gridsquare);
        sets.push(`grid_locator = $${params.length}`);
      }
      // Cross-sync: if QRZ already shipped this QSO, mark for re-upload so the
      // updated lotw_qsl_rcvd / location fields propagate. Wavelog's 'M' flag.
      if (match.contact.qrz_qsl_sent === 'Y') {
        sets.push(`qrz_qsl_sent = 'M'`);
      }
      // qsl_lotw_date is assigned exactly once — Postgres rejects an UPDATE
      // that sets the same column twice. Prefer LoTW's own QSL date
      // (YYYY-MM-DD already); fall back to today (UTC) so the applied date
      // still advances the incremental-download watermark below.
      const qslDate = conf.qsl_rcvd_date || new Date().toISOString().slice(0, 10);
      params.push(qslDate);
      sets.push(`qsl_lotw_date = $${params.length}::date`);

      params.push(match.contact.id);
      try {
        await query(
          `UPDATE contacts SET ${sets.join(', ')} WHERE id = $${params.length}`,
          params
        );
        matchedCount++;
        appliedQslDates.push(qslDate);
      } catch (applyError) {
        // Isolate per-row failures so one bad row can't discard the batch.
        failedCount++;
        const msg = applyError instanceof Error ? applyError.message : 'Unknown error';
        if (!firstApplyError) firstApplyError = msg;
        console.error(
          `[LoTW Download] Failed to apply confirmation to contact ${match.contact.id}:`,
          applyError
        );
      }
      // Count this confirmation as matched even if applying it failed; failures are tracked separately.
      unmatchedCount--;
    }

    // Persist the most recent qsl_rcvd_date so the next download can use it
    // as qso_qslsince for an incremental fetch. Only consider confirmations
    // that actually applied — advancing past a failed row would skip it on
    // the next incremental run.
    if (appliedQslDates.length > 0) {
      const maxDate = appliedQslDates
        .sort()
        .pop();
      if (maxDate) {
        await query(
          `UPDATE stations SET lotw_last_qsl_rcvd_date = GREATEST(
              COALESCE(lotw_last_qsl_rcvd_date, '1970-01-01'::date), $1::date
           ) WHERE id = $2`,
          [maxDate, stationId]
        );
      }
    }

    // Update download log as completed; surface partial apply failures so
    // they are visible in the sync history instead of silently dropped.
    const applyErrorMessage = failedCount > 0
      ? `${failedCount} matched confirmation(s) failed to apply: ${firstApplyError}`
      : null;

    await query(
      `UPDATE lotw_download_logs
       SET status = 'completed', completed_at = NOW(),
           qso_count = $1, confirmations_found = $2,
           confirmations_matched = $3, confirmations_unmatched = $4,
           error_message = $5
       WHERE id = $6`,
      [contacts.length, confirmations.length, matchedCount, unmatchedCount, applyErrorMessage, downloadLogId]
    );

    return {
      status: 200,
      body: {
        success: true,
        download_log_id: downloadLogId,
        confirmations_found: confirmations.length,
        confirmations_matched: matchedCount,
        confirmations_unmatched: unmatchedCount,
        ...(applyErrorMessage ? { error_message: applyErrorMessage } : {}),
      },
    };
  } catch (error) {
    console.error('Download processing error:', error);

    // Update log with error
    await query(
      `UPDATE lotw_download_logs
       SET status = 'failed', completed_at = NOW(),
           error_message = $1
       WHERE id = $2`,
      [error instanceof Error ? error.message : 'Unknown error', downloadLogId]
    );

    return {
      status: 500,
      body: {
        success: false,
        download_log_id: downloadLogId,
        error_message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}
