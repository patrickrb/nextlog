// LoTW Download API endpoint

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { parseLoTWAdif, matchLoTWConfirmations, buildLoTWDownloadUrl, decryptString } from '@/lib/lotw';
import { LotwDownloadRequest, LotwDownloadResponse, ContactWithLoTW } from '@/types/lotw';

export async function POST(request: NextRequest) {
  try {
    // Check if this is a cron job request
    const isCronJob = request.headers.get('X-Cron-Job') === 'true';
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

    const body: LotwDownloadRequest = await request.json();
    const { station_id, date_from, date_to, download_method = 'manual' } = body;

    if (!station_id) {
      return NextResponse.json({ 
        error: 'station_id is required' 
      }, { status: 400 });
    }

    // Verify station exists and get LoTW credentials
    let stationResult;
    if (isCronJob) {
      // For cron jobs, just verify station exists
      stationResult = await query(
        `SELECT s.id, s.callsign, s.lotw_username, s.lotw_password, s.user_id,
                u.third_party_services
         FROM stations s
         JOIN users u ON s.user_id = u.id
         WHERE s.id = $1`,
        [station_id]
      );
    } else {
      // For regular requests, verify station belongs to user
      stationResult = await query(
        `SELECT s.id, s.callsign, s.lotw_username, s.lotw_password, s.user_id,
                u.third_party_services
         FROM stations s
         JOIN users u ON s.user_id = u.id
         WHERE s.id = $1 AND s.user_id = $2`,
        [station_id, parseInt(user.userId)]
      );
    }

    if (stationResult.rows.length === 0) {
      return NextResponse.json({ 
        error: 'Station not found or access denied' 
      }, { status: 404 });
    }

    const station = stationResult.rows[0];
    const userId = isCronJob ? station.user_id : parseInt(user.userId);
    
    // Get LoTW credentials from station or user third_party_services
    let lotwUsername = station.lotw_username;
    let lotwPassword = station.lotw_password;

    // Try user's third_party_services if station doesn't have credentials
    if (!lotwUsername || !lotwPassword) {
      const thirdPartyServices = station.third_party_services;
      if (thirdPartyServices?.lotw) {
        lotwUsername = thirdPartyServices.lotw.username;
        lotwPassword = decryptString(thirdPartyServices.lotw.password);
      }
    } else if (lotwPassword) {
      // Decrypt station password if it exists
      lotwPassword = decryptString(lotwPassword);
    }

    if (!lotwUsername || !lotwPassword) {
      return NextResponse.json({ 
        error: 'LoTW credentials not configured for this station. Please configure username and password in station settings.' 
      }, { status: 400 });
    }

    // Create download log entry
    const downloadLogResult = await query(
      `INSERT INTO lotw_download_logs 
       (station_id, user_id, date_from, date_to, status, download_method) 
       VALUES ($1, $2, $3, $4, 'pending', $5) 
       RETURNING id`,
      [station_id, userId, date_from || null, date_to || null, download_method]
    );

    const downloadLogId = downloadLogResult.rows[0].id;

    try {
      // Update status to processing
      await query(
        'UPDATE lotw_download_logs SET status = $1, started_at = NOW() WHERE id = $2',
        ['processing', downloadLogId]
      );

      // Build LoTW download URL
      const downloadUrl = buildLoTWDownloadUrl(lotwUsername, lotwPassword, date_from, date_to);

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
        
        await query(
          `UPDATE lotw_download_logs 
           SET status = 'failed', completed_at = NOW(), 
               error_message = $1 
           WHERE id = $2`,
          [`Download from LoTW failed: ${downloadError.message}`, downloadLogId]
        );

        return NextResponse.json({ 
          success: false,
          download_log_id: downloadLogId,
          error_message: `Download from LoTW failed: ${downloadError.message}`
        }, { status: 500 });
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

        const response: LotwDownloadResponse = {
          success: true,
          download_log_id: downloadLogId,
          confirmations_found: 0,
          confirmations_matched: 0,
          confirmations_unmatched: 0,
          error_message: 'No confirmations found in LoTW response'
        };

        return NextResponse.json(response);
      }

      // Get contacts from this station to match against
      let contactQuery = `
        SELECT * FROM contacts 
        WHERE user_id = $1 AND station_id = $2
      `;
      const queryParams: (string | number)[] = [userId, station_id];

      // Add date filters based on confirmation dates if provided
      if (date_from || date_to) {
        if (date_from) {
          contactQuery += ` AND datetime >= $3`;
          queryParams.push(date_from);
        }
        if (date_to) {
          const paramIndex = queryParams.length + 1;
          contactQuery += ` AND datetime <= $${paramIndex}`;
          queryParams.push(date_to);
        }
      }

      contactQuery += ` ORDER BY datetime ASC`;

      const contactsResult = await query(contactQuery, queryParams);
      const contacts: ContactWithLoTW[] = contactsResult.rows;

      // Match confirmations with local contacts
      const matches = matchLoTWConfirmations(confirmations, contacts);

      let matchedCount = 0;
      let unmatchedCount = confirmations.length;

      // Update matched contacts
      for (const match of matches) {
        await query(
          `UPDATE contacts 
           SET qsl_lotw = true, 
               qsl_lotw_date = NOW()::date,
               lotw_qsl_rcvd = 'Y',
               lotw_match_status = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [match.matchStatus, match.contact.id]
        );
        
        matchedCount++;
        unmatchedCount--;
      }

      // Update download log as completed
      await query(
        `UPDATE lotw_download_logs 
         SET status = 'completed', completed_at = NOW(), 
             qso_count = $1, confirmations_found = $2, 
             confirmations_matched = $3, confirmations_unmatched = $4
         WHERE id = $5`,
        [contacts.length, confirmations.length, matchedCount, unmatchedCount, downloadLogId]
      );

      const response: LotwDownloadResponse = {
        success: true,
        download_log_id: downloadLogId,
        confirmations_found: confirmations.length,
        confirmations_matched: matchedCount,
        confirmations_unmatched: unmatchedCount
      };

      return NextResponse.json(response);

    } catch (error) {
      console.error('Download processing error:', error);
      
      // Update log with error
      await query(
        `UPDATE lotw_download_logs 
         SET status = 'failed', completed_at = NOW(), 
             error_message = $1 
         WHERE id = $2`,
        [error.message, downloadLogId]
      );

      return NextResponse.json({ 
        success: false,
        download_log_id: downloadLogId,
        error_message: error.message
      }, { status: 500 });
    }

  } catch (error) {
    console.error('LoTW download error:', error);
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

    // Build query for download logs
    let logQuery = `
      SELECT ldl.*, s.callsign as station_callsign
      FROM lotw_download_logs ldl
      JOIN stations s ON ldl.station_id = s.id
      WHERE ldl.user_id = $1
    `;
    const queryParams: (string | number)[] = [parseInt(user.userId)];
    let paramIndex = 2;

    if (stationId) {
      logQuery += ` AND ldl.station_id = $${paramIndex}`;
      queryParams.push(parseInt(stationId));
      paramIndex++;
    }

    logQuery += ` ORDER BY ldl.started_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const logsResult = await query(logQuery, queryParams);

    return NextResponse.json({
      download_logs: logsResult.rows,
      pagination: {
        limit,
        offset,
        total: logsResult.rows.length
      }
    });

  } catch (error) {
    console.error('Download logs retrieval error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}