// LoTW Single Contact Download/Confirmation API endpoint

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { parseLoTWAdif, matchLoTWConfirmations, buildLoTWDownloadUrl, decryptString } from '@/lib/lotw';
import { ContactWithLoTW } from '@/types/lotw';

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

    // Get the contact and verify ownership
    const contactResult = await query(
      `SELECT c.*, s.callsign as station_callsign, s.id as station_id,
              s.lotw_username, s.lotw_password, u.third_party_services
       FROM contacts c
       JOIN stations s ON c.station_id = s.id
       JOIN users u ON s.user_id = u.id
       WHERE c.id = $1 AND c.user_id = $2`,
      [contact_id, parseInt(user.userId)]
    );

    if (contactResult.rows.length === 0) {
      return NextResponse.json({
        error: 'Contact not found or access denied'
      }, { status: 404 });
    }

    const contact: ContactWithLoTW & {
      lotw_username?: string;
      lotw_password?: string;
      third_party_services?: { lotw?: { username: string; password: string } };
      station_callsign: string;
      station_id: number;
    } = contactResult.rows[0];

    // Check if already confirmed
    if (contact.qsl_lotw === true || contact.lotw_qsl_rcvd === 'Y') {
      return NextResponse.json({
        success: false,
        error: 'Contact already confirmed via LoTW'
      }, { status: 400 });
    }

    // Get LoTW credentials from station or user third_party_services
    let lotwUsername = contact.lotw_username;
    let lotwPassword = contact.lotw_password;
    let credentialSource = 'none';

    console.log(`[LoTW Download] Checking credentials for contact ${contact_id}, station ${contact.station_id} (${contact.station_callsign})`);
    console.log(`[LoTW Download] Station credentials present: username=${!!lotwUsername}, password=${!!lotwPassword}`);

    // Try user's third_party_services if station doesn't have credentials
    if (!lotwUsername || !lotwPassword) {
      const thirdPartyServices = contact.third_party_services;
      console.log(`[LoTW Download] Checking user-level credentials: third_party_services=${!!thirdPartyServices}, lotw field=${!!thirdPartyServices?.lotw}`);

      if (thirdPartyServices?.lotw) {
        lotwUsername = thirdPartyServices.lotw.username;
        try {
          lotwPassword = decryptString(thirdPartyServices.lotw.password);
          credentialSource = 'user';
          console.log(`[LoTW Download] Using user-level credentials, username present: ${!!lotwUsername}`);
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
        console.log(`[LoTW Download] Using station-level credentials for station ${contact.station_id}`);
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

      return NextResponse.json({
        error: errorMessage,
        debug: {
          station_id: contact.station_id,
          station_callsign: contact.station_callsign,
          credential_source: credentialSource,
          has_username: !!lotwUsername,
          has_password: !!lotwPassword
        }
      }, { status: 400 });
    }

    console.log(`[LoTW Download] Credentials validated from source: ${credentialSource}`);

    // Create a date range around the contact (±1 day to be safe)
    const contactDate = new Date(contact.datetime);
    const dateFrom = new Date(contactDate);
    dateFrom.setDate(dateFrom.getDate() - 1);
    const dateTo = new Date(contactDate);
    dateTo.setDate(dateTo.getDate() + 1);

    const dateFromStr = dateFrom.toISOString().split('T')[0];
    const dateToStr = dateTo.toISOString().split('T')[0];

    // Build LoTW download URL with date range
    const downloadUrl = buildLoTWDownloadUrl(lotwUsername, lotwPassword, dateFromStr, dateToStr);

    // Download confirmations from LoTW
    let adifContent: string;
    try {
      const downloadResponse = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Nextlog/1.0.0',
        },
      });

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
      return NextResponse.json({
        success: false,
        error: `Download from LoTW failed: ${downloadError instanceof Error ? downloadError.message : 'Unknown error'}`
      }, { status: 500 });
    }

    // Parse ADIF confirmations
    const confirmations = parseLoTWAdif(adifContent);

    if (confirmations.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No confirmations found in LoTW for this contact'
      });
    }

    // Match confirmations with this specific contact
    const matches = matchLoTWConfirmations(confirmations, [contact]);

    if (matches.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No matching confirmation found in LoTW for this contact'
      });
    }

    const match = matches[0];

    // Update the contact with confirmation
    await query(
      `UPDATE contacts
       SET qsl_lotw = true,
           qsl_lotw_date = NOW()::date,
           lotw_qsl_rcvd = 'Y',
           lotw_match_status = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [match.matchStatus, contact_id]
    );

    return NextResponse.json({
      success: true,
      message: 'Contact confirmed via LoTW',
      match_status: match.matchStatus
    });

  } catch (error) {
    console.error('LoTW single contact download error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}
