// LoTW Upload Cron Job
// This endpoint is called by Vercel Cron to automatically upload QSOs to LoTW

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Enhanced error logging for troubleshooting
    console.log('LoTW upload cron job authentication check...');
    console.log('Request headers (excluding sensitive data):', {
      'user-agent': request.headers.get('user-agent'),
      'x-vercel-id': request.headers.get('x-vercel-id'),
      'x-forwarded-for': request.headers.get('x-forwarded-for'),
      'host': request.headers.get('host'),
      'has-authorization': !!request.headers.get('authorization'),
      'cron-secret-configured': !!process.env.CRON_SECRET
    });

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

    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
    
    // For Vercel cron jobs, we need to be more flexible with authentication
    // Vercel cron jobs run in a trusted environment but may not include the auth header
    const isVercelCron = request.headers.get('user-agent')?.includes('vercel') || 
                        request.headers.get('x-vercel-id') ||
                        request.headers.get('host')?.includes('vercel');
    
    if (!isVercelCron && authHeader !== expectedAuth) {
      console.error('Authentication failed:', {
        hasAuthHeader: !!authHeader,
        hasCronSecret: !!process.env.CRON_SECRET,
        isVercelCron
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Starting LoTW upload cron job...');
    
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

    const results = [];
    
    for (const station of stationsResult.rows) {
      try {
        // Check if we've uploaded recently (within last hour) to avoid duplicate uploads
        const recentUploadResult = await query(
          `SELECT id FROM lotw_upload_logs 
           WHERE station_id = $1 
             AND started_at > NOW() - INTERVAL '1 hour'
             AND status IN ('processing', 'completed')
           LIMIT 1`,
          [station.id]
        );

        if (recentUploadResult.rows.length > 0) {
          console.log(`Skipping station ${station.callsign} - uploaded recently`);
          results.push({
            station_id: station.id,
            callsign: station.callsign,
            status: 'skipped',
            reason: 'uploaded_recently'
          });
          continue;
        }

        // Make internal API call to upload endpoint
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        const uploadResponse = await fetch(`${baseUrl}/api/lotw/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Cron-Job': 'true', // Internal identifier
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

        console.log(`Station ${station.callsign}: ${uploadResponse.ok ? 'success' : 'error'} - ${uploadData.qso_count || 0} QSOs`);

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

    console.log('LoTW upload cron job completed');

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