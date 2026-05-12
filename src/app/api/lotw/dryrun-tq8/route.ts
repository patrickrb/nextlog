// LoTW dry-run .tq8 download endpoint — diagnostic only.
//
// Builds the exact same signed .tq8 that POST /api/lotw/upload would send
// to lotw.arrl.org, but returns it as a file download instead of uploading.
// Lets the operator upload the file manually via lotw.arrl.org/lotw/upload
// to isolate whether problems are in the .tq8 content vs. our HTTP POST.
//
// Side-effect free: no upload-log row written, no contacts marked, no
// network call to LoTW. Auth = same user verification as the real upload.

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { buildSignedTq8, normalizeCallsign, decryptString } from '@/lib/lotw';
import { ContactWithLoTW, LotwQso, LotwStationProfile } from '@/types/lotw';

const LOTW_UNSUPPORTED_PROP_MODES = new Set(['INTERNET', 'RPT']);

export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const stationIdRaw = searchParams.get('station_id');
    const limitRaw = searchParams.get('limit');
    const contactIdRaw = searchParams.get('contact_id');

    if (!stationIdRaw && !contactIdRaw) {
      return NextResponse.json(
        { error: 'Provide either station_id (bulk) or contact_id (single QSO).' },
        { status: 400 }
      );
    }

    let station: {
      id: number;
      callsign: string;
      dxcc_entity_code: number;
      grid_locator?: string;
      itu_zone?: number;
      cq_zone?: number;
      state_province?: string;
      county?: string;
    };
    let contacts: ContactWithLoTW[];

    if (contactIdRaw) {
      // Single-contact mode — sign the exact same QSO that POST
      // /api/lotw/upload-contact would.
      const contactResult = await query(
        `SELECT c.*,
                s.id as station_id, s.callsign as station_callsign,
                s.dxcc_entity_code, s.grid_locator,
                s.itu_zone, s.cq_zone, s.state_province, s.county
         FROM contacts c
         JOIN stations s ON c.station_id = s.id
         WHERE c.id = $1 AND c.user_id = $2`,
        [parseInt(contactIdRaw, 10), parseInt(user.userId)]
      );
      if (contactResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Contact not found or access denied.' },
          { status: 404 }
        );
      }
      const row = contactResult.rows[0];
      station = {
        id: row.station_id,
        callsign: row.station_callsign,
        dxcc_entity_code: row.dxcc_entity_code,
        grid_locator: row.grid_locator,
        itu_zone: row.itu_zone,
        cq_zone: row.cq_zone,
        state_province: row.state_province,
        county: row.county,
      };
      contacts = [row as ContactWithLoTW];
    } else {
      // Bulk mode — same query as POST /api/lotw/upload, capped by `limit`
      // (default 5) so the dry-run download stays small enough to inspect.
      const stationId = parseInt(stationIdRaw!, 10);
      const limit = Math.max(
        1,
        Math.min(100, limitRaw ? parseInt(limitRaw, 10) : 5)
      );
      const stationResult = await query(
        `SELECT id, callsign, dxcc_entity_code, grid_locator,
                itu_zone, cq_zone, state_province, county
         FROM stations
         WHERE id = $1 AND user_id = $2`,
        [stationId, parseInt(user.userId)]
      );
      if (stationResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Station not found or access denied.' },
          { status: 404 }
        );
      }
      station = stationResult.rows[0];
      const contactsResult = await query(
        `SELECT c.*, s.callsign as station_callsign
         FROM contacts c
         JOIN stations s ON c.station_id = s.id
         WHERE c.user_id = $1 AND c.station_id = $2
           AND (c.lotw_qsl_sent IS NULL OR c.lotw_qsl_sent IN ('N', 'M'))
         ORDER BY c.datetime ASC
         LIMIT $3`,
        [parseInt(user.userId), stationId, limit]
      );
      contacts = contactsResult.rows;
    }

    // Drop QSOs LoTW won't accept (matches the real upload route).
    contacts = contacts.filter(c => {
      const pm = (c.prop_mode || '').toUpperCase();
      return !pm || !LOTW_UNSUPPORTED_PROP_MODES.has(pm);
    });

    if (contacts.length === 0) {
      return NextResponse.json(
        { error: 'No eligible QSOs to include in dry-run.' },
        { status: 400 }
      );
    }

    if (!station.dxcc_entity_code) {
      return NextResponse.json(
        { error: 'Station is missing dxcc_entity_code.' },
        { status: 400 }
      );
    }

    // Fetch the active cert + decrypt password (same logic as the real upload).
    const certResult = await query(
      `SELECT id, p12_cert, p12_password
       FROM lotw_credentials
       WHERE station_id = $1 AND is_active = true
       ORDER BY created_at DESC LIMIT 1`,
      [station.id]
    );
    if (certResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'No active LoTW certificate for this station.' },
        { status: 400 }
      );
    }
    const certificate = certResult.rows[0];
    let p12Password = '';
    if (certificate.p12_password) {
      try {
        p12Password = decryptString(certificate.p12_password);
      } catch (decryptErr) {
        console.error('[LoTW Dry-run] Failed to decrypt p12 password:', decryptErr);
      }
    }

    // Build station profile + DXCC-conditional location fields (identical to the
    // real upload routes so the .tq8 byte-matches what we would actually send).
    const stationProfile: LotwStationProfile = {
      callsign: normalizeCallsign(station.callsign),
      dxcc: station.dxcc_entity_code,
      gridsquare: station.grid_locator || undefined,
      ituz: station.itu_zone || undefined,
      cqz: station.cq_zone || undefined,
    };
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

    const qsos: LotwQso[] = contacts.map(c => ({
      call: normalizeCallsign(c.callsign),
      band: c.band || '',
      band_rx: c.band_rx,
      mode: c.mode || '',
      freq: c.frequency ? Number(c.frequency) : undefined,
      freq_rx: c.freq_rx ? Number(c.freq_rx) : undefined,
      prop_mode: c.prop_mode,
      sat_name: c.sat_name,
      datetime: new Date(c.datetime),
    }));

    let tq8: Buffer;
    try {
      tq8 = await buildSignedTq8({
        p12: certificate.p12_cert,
        p12Password,
        station: stationProfile,
        qsos,
      });
    } catch (signError) {
      console.error('[LoTW Dry-run] sign error:', signError);
      return NextResponse.json(
        {
          error: `Failed to sign .tq8: ${signError instanceof Error ? signError.message : 'Unknown error'}`,
        },
        { status: 500 }
      );
    }

    const filename = `${stationProfile.callsign}-dryrun.tq8`;
    return new NextResponse(new Uint8Array(tq8), {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(tq8.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[LoTW Dry-run] unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
