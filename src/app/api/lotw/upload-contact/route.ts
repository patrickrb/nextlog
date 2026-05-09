// LoTW Single Contact Upload API endpoint

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { buildSignedTq8, normalizeCallsign, decryptString } from '@/lib/lotw';
import { ContactWithLoTW, LotwQso, LotwStationProfile } from '@/types/lotw';

const LOTW_UNSUPPORTED_PROP_MODES = new Set(['INTERNET', 'RPT']);
const LOTW_UPLOAD_URL = 'https://lotw.arrl.org/lotw/upload';
const LOTW_UPLOAD_ACCEPTED_REGEX = /<!--\s*\.UPL\.\s*accepted\s*-->/i;

export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { contact_id } = body;

    if (!contact_id) {
      return NextResponse.json({
        error: 'contact_id is required'
      }, { status: 400 });
    }

    // Pull the contact joined with the station's location profile required to
    // build a valid LoTW upload (DXCC entity, gridsquare, ITU/CQ, state/county).
    const contactResult = await query(
      `SELECT c.*,
              s.callsign as station_callsign, s.id as station_id,
              s.dxcc_entity_code, s.grid_locator,
              s.itu_zone, s.cq_zone, s.state_province, s.county
       FROM contacts c
       JOIN stations s ON c.station_id = s.id
       WHERE c.id = $1 AND c.user_id = $2`,
      [contact_id, parseInt(user.userId)]
    );

    if (contactResult.rows.length === 0) {
      return NextResponse.json({
        error: 'Contact not found or access denied'
      }, { status: 404 });
    }

    const contact = contactResult.rows[0] as ContactWithLoTW & {
      station_callsign: string;
      station_id: number;
      dxcc_entity_code: number;
      grid_locator?: string;
      itu_zone?: number;
      cq_zone?: number;
      state_province?: string;
      county?: string;
    };

    if (contact.lotw_qsl_sent === 'Y') {
      return NextResponse.json({
        success: false,
        error: 'Contact already uploaded to LoTW'
      }, { status: 400 });
    }

    const propMode = (contact.prop_mode || '').toUpperCase();
    if (propMode && LOTW_UNSUPPORTED_PROP_MODES.has(propMode)) {
      await query(
        `UPDATE contacts SET lotw_qsl_sent = 'I', updated_at = NOW() WHERE id = $1`,
        [contact_id]
      );
      return NextResponse.json({
        success: false,
        error: `prop_mode=${propMode} is not supported by LoTW; contact marked as ignored.`
      }, { status: 400 });
    }

    if (!contact.dxcc_entity_code) {
      return NextResponse.json({
        success: false,
        error: 'Station is missing dxcc_entity_code; please set it before uploading to LoTW.'
      }, { status: 400 });
    }

    const certResult = await query(
      `SELECT id, p12_cert, p12_password
       FROM lotw_credentials
       WHERE station_id = $1 AND is_active = true
       ORDER BY created_at DESC LIMIT 1`,
      [contact.station_id]
    );

    if (certResult.rows.length === 0) {
      return NextResponse.json({
        error: 'No active LoTW certificate found for this station. Please upload a certificate first.'
      }, { status: 400 });
    }

    const certificate = certResult.rows[0];
    let p12Password = '';
    if (certificate.p12_password) {
      try { p12Password = decryptString(certificate.p12_password); } catch {}
    }

    const stationProfile: LotwStationProfile = {
      callsign: normalizeCallsign(contact.station_callsign),
      dxcc: contact.dxcc_entity_code,
      gridsquare: contact.grid_locator || undefined,
      ituz: contact.itu_zone || undefined,
      cqz: contact.cq_zone || undefined,
    };
    const dxcc = contact.dxcc_entity_code;
    const stateValue = contact.state_province || undefined;
    const countyValue = contact.county || undefined;
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

    const qso: LotwQso = {
      call: normalizeCallsign(contact.callsign),
      band: contact.band || '',
      band_rx: contact.band_rx,
      mode: contact.mode || '',
      freq: contact.frequency ? Number(contact.frequency) : undefined,
      freq_rx: contact.freq_rx ? Number(contact.freq_rx) : undefined,
      prop_mode: contact.prop_mode,
      sat_name: contact.sat_name,
      datetime: new Date(contact.datetime),
    };

    let tq8: Buffer;
    try {
      tq8 = await buildSignedTq8({
        p12: certificate.p12_cert,
        p12Password,
        station: stationProfile,
        qsos: [qso],
      });
    } catch (signError) {
      console.error('LoTW .tq8 build error:', signError);
      return NextResponse.json({
        success: false,
        error: `Failed to sign .tq8: ${signError instanceof Error ? signError.message : 'Unknown error'}`
      }, { status: 500 });
    }

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
      if (!LOTW_UPLOAD_ACCEPTED_REGEX.test(lotwResponse)) {
        throw new Error(`LoTW did not accept upload: ${lotwResponse.slice(0, 500)}`);
      }
    } catch (uploadError) {
      console.error('LoTW upload error:', uploadError);
      return NextResponse.json({
        success: false,
        error: `Upload to LoTW failed: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`
      }, { status: 500 });
    }

    await query(
      `UPDATE contacts SET lotw_qsl_sent = 'Y', updated_at = NOW() WHERE id = $1`,
      [contact_id]
    );

    return NextResponse.json({
      success: true,
      message: 'Contact uploaded to LoTW successfully',
      lotw_response: lotwResponse
    });

  } catch (error) {
    console.error('LoTW single contact upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
