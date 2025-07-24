// LoTW Upload API endpoint

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { generateAdifForLoTW, signAdifWithCertificate, generateAdifHash } from '@/lib/lotw';
import { LotwUploadRequest, LotwUploadResponse, ContactWithLoTW } from '@/types/lotw';

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

    const body: LotwUploadRequest = await request.json();
    const { station_id, date_from, date_to, upload_method = 'manual' } = body;

    if (!station_id) {
      return NextResponse.json({ 
        error: 'station_id is required' 
      }, { status: 400 });
    }

    // Verify station exists and get user info
    let stationResult;
    if (isCronJob) {
      // For cron jobs, just verify station exists and get the user
      stationResult = await query(
        'SELECT id, callsign, user_id FROM stations WHERE id = $1',
        [station_id]
      );
    } else {
      // For regular requests, verify station belongs to user
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      stationResult = await query(
        'SELECT id, callsign, user_id FROM stations WHERE id = $1 AND user_id = $2',
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

    // Get active LoTW certificate for this station
    const certResult = await query(
      'SELECT id, p12_cert FROM lotw_credentials WHERE station_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1',
      [station_id]
    );

    if (certResult.rows.length === 0) {
      return NextResponse.json({ 
        error: 'No active LoTW certificate found for this station. Please upload a certificate first.' 
      }, { status: 400 });
    }

    const certificate = certResult.rows[0];

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

      // Build query for contacts to upload
      let contactQuery = `
        SELECT c.*, s.callsign as station_callsign
        FROM contacts c 
        JOIN stations s ON c.station_id = s.id
        WHERE c.user_id = $1 AND c.station_id = $2
      `;
      const queryParams: (string | number)[] = [userId, station_id];
      let paramIndex = 3;

      // Add date filters if provided
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

      // Only upload contacts that haven't been uploaded to LoTW yet
      contactQuery += ` AND (c.lotw_qsl_sent IS NULL OR c.lotw_qsl_sent != 'Y')`;
      
      contactQuery += ` ORDER BY c.datetime ASC`;

      const contactsResult = await query(contactQuery, queryParams);
      const contacts: ContactWithLoTW[] = contactsResult.rows;

      if (contacts.length === 0) {
        await query(
          `UPDATE lotw_upload_logs 
           SET status = 'completed', completed_at = NOW(), qso_count = 0, 
               error_message = 'No contacts found for upload' 
           WHERE id = $1`,
          [uploadLogId]
        );

        const response: LotwUploadResponse = {
          success: true,
          upload_log_id: uploadLogId,
          qso_count: 0,
          error_message: 'No contacts found for upload'
        };

        return NextResponse.json(response);
      }

      // Generate ADIF content
      const adifContent = generateAdifForLoTW(contacts, station.callsign);
      const fileHash = generateAdifHash(adifContent);
      const fileSizeBytes = Buffer.byteLength(adifContent, 'utf8');

      // Update log with file details
      await query(
        `UPDATE lotw_upload_logs 
         SET qso_count = $1, file_hash = $2, file_size_bytes = $3 
         WHERE id = $4`,
        [contacts.length, fileHash, fileSizeBytes, uploadLogId]
      );

      // Sign ADIF file with certificate
      let signedContent: string;
      try {
        signedContent = await signAdifWithCertificate(
          adifContent,
          certificate.p12_cert,
          station.callsign
        );
      } catch (signError) {
        console.error('ADIF signing error:', signError);
        
        await query(
          `UPDATE lotw_upload_logs 
           SET status = 'failed', completed_at = NOW(), 
               error_message = $1 
           WHERE id = $2`,
          [`Failed to sign ADIF file: ${signError.message}`, uploadLogId]
        );

        return NextResponse.json({ 
          success: false,
          upload_log_id: uploadLogId,
          error_message: `Failed to sign ADIF file: ${signError.message}`
        }, { status: 500 });
      }

      // Upload to LoTW
      let lotwResponse: string;
      try {
        const uploadResponse = await fetch('https://lotw.arrl.org/lotwuser/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${station.callsign}.tq8"`,
          },
          body: signedContent,
        });

        lotwResponse = await uploadResponse.text();

        if (!uploadResponse.ok) {
          throw new Error(`LoTW upload failed: ${uploadResponse.status} ${lotwResponse}`);
        }

      } catch (uploadError) {
        console.error('LoTW upload error:', uploadError);
        
        await query(
          `UPDATE lotw_upload_logs 
           SET status = 'failed', completed_at = NOW(), 
               error_message = $1, lotw_response = $2 
           WHERE id = $3`,
          [`Upload to LoTW failed: ${uploadError.message}`, lotwResponse || '', uploadLogId]
        );

        return NextResponse.json({ 
          success: false,
          upload_log_id: uploadLogId,
          error_message: `Upload to LoTW failed: ${uploadError.message}`
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

      // Update upload log as completed
      await query(
        `UPDATE lotw_upload_logs 
         SET status = 'completed', completed_at = NOW(), 
             success_count = $1, lotw_response = $2 
         WHERE id = $3`,
        [contacts.length, lotwResponse, uploadLogId]
      );

      const response: LotwUploadResponse = {
        success: true,
        upload_log_id: uploadLogId,
        qso_count: contacts.length,
        lotw_response: lotwResponse
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
        [error.message, uploadLogId]
      );

      return NextResponse.json({ 
        success: false,
        upload_log_id: uploadLogId,
        error_message: error.message
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