// LoTW Upload Cron Job
// This endpoint is called by Vercel Cron to automatically upload QSOs to LoTW

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hasValidCronSecret } from '@/lib/cron-auth';

export async function GET(request: NextRequest) {
  try {
    // Environment validation
    const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'ENCRYPTION_SECRET'];
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingEnvVars.length > 0) {
      console.error('Missing required environment variables:', missingEnvVars);
      return NextResponse.json({ 
        error: 'Server configuration error',
        details: `Missing environment variables: ${missingEnvVars.join(', ')}`
      }, { status: 500 });
    }

    // Verify this is a legitimate cron request. Fail closed when the secret
    // is missing — Vercel only attaches the Authorization header when
    // CRON_SECRET is set, and an unset secret must not mean "open endpoint".
    if (!process.env.CRON_SECRET) {
      console.error('CRON_SECRET is not configured; refusing cron request');
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
    }
    if (!hasValidCronSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if lotw_credentials table exists before proceeding
    const tableCheckResult = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'lotw_credentials'
    `);
    
    if (tableCheckResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'LoTW upload skipped - lotw_credentials table not found',
        processed_stations: 0,
        results: []
      });
    }
    
    // Get all active stations that have LoTW credentials configured
    const stationsResult = await query(`
      SELECT DISTINCT s.id, s.callsign, s.user_id
      FROM stations s
      LEFT JOIN lotw_credentials lc ON s.id = lc.station_id AND lc.is_active = true
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.is_active = true 
        AND (
          (s.lotw_username IS NOT NULL AND s.lotw_password IS NOT NULL)
          OR (u.third_party_services->>'lotw' IS NOT NULL)
        )
        AND lc.id IS NOT NULL
    `);

    // Check if lotw_upload_logs table exists before proceeding with duplicate checks
    const uploadLogsTableCheckResult = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'lotw_upload_logs'
    `);
    
    const hasUploadLogsTable = uploadLogsTableCheckResult.rows.length > 0;

    const results = [];
    
    for (const station of stationsResult.rows) {
      try {
        // Check if we've uploaded recently (within last hour) to avoid duplicate uploads
        if (hasUploadLogsTable) {
          const recentUploadResult = await query(
            `SELECT id FROM lotw_upload_logs 
             WHERE station_id = $1 
               AND started_at > NOW() - INTERVAL '1 hour'
               AND status IN ('processing', 'completed')
             LIMIT 1`,
            [station.id]
          );

          if (recentUploadResult.rows.length > 0) {
            results.push({
              station_id: station.id,
              callsign: station.callsign,
              status: 'skipped',
              reason: 'uploaded_recently'
            });
            continue;
          }
        }

        // Make internal API call to upload endpoint
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        const uploadResponse = await fetch(`${baseUrl}/api/lotw/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Cron-Job': 'true', // Cron-mode discriminator (grants nothing by itself)
            'Authorization': `Bearer ${process.env.CRON_SECRET}`,
          },
          body: JSON.stringify({
            station_id: station.id,
            upload_method: 'automatic'
          })
        });

        const uploadData = await uploadResponse.json();
        
        // Enhanced logging for troubleshooting
        if (!uploadResponse.ok) {
          console.error(`Upload failed for station ${station.callsign}:`, {
            status: uploadResponse.status,
            statusText: uploadResponse.statusText,
            error: uploadData.error || 'Unknown error'
          });
        }
        
        results.push({
          station_id: station.id,
          callsign: station.callsign,
          status: uploadResponse.ok ? 'success' : 'error',
          qso_count: uploadData.qso_count || 0,
          error: uploadResponse.ok ? null : uploadData.error
        });

      } catch (stationError) {
        console.error(`Error processing station ${station.callsign}:`, stationError);
        results.push({
          station_id: station.id,
          callsign: station.callsign,
          status: 'error',
          error: stationError instanceof Error ? stationError.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed_stations: results.length,
      results
    });

  } catch (error) {
    console.error('LoTW upload cron error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}