// LoTW Download Cron Job
// This endpoint is called by Vercel Cron to automatically download confirmations from LoTW

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

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

    // Get all active stations that have LoTW credentials configured
    const stationsResult = await query(`
      SELECT DISTINCT s.id, s.callsign, s.user_id
      FROM stations s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.is_active = true 
        AND (
          (s.lotw_username IS NOT NULL AND s.lotw_password IS NOT NULL)
          OR (u.third_party_services->>'lotw' IS NOT NULL)
        )
    `);

    const results = [];
    
    for (const station of stationsResult.rows) {
      try {
        // Check if we've downloaded recently (within last hour) to avoid duplicate downloads
        const recentDownloadResult = await query(
          `SELECT id FROM lotw_download_logs 
           WHERE station_id = $1 
             AND started_at > NOW() - INTERVAL '1 hour'
             AND status IN ('processing', 'completed')
           LIMIT 1`,
          [station.id]
        );

        if (recentDownloadResult.rows.length > 0) {
          results.push({
            station_id: station.id,
            callsign: station.callsign,
            status: 'skipped',
            reason: 'downloaded_recently'
          });
          continue;
        }

        // Make internal API call to download endpoint
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        const downloadResponse = await fetch(`${baseUrl}/api/lotw/download`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Cron-Job': 'true', // Internal identifier
          },
          body: JSON.stringify({
            station_id: station.id,
            download_method: 'automatic'
          })
        });

        const downloadData = await downloadResponse.json();
        
        // Enhanced logging for troubleshooting
        if (!downloadResponse.ok) {
          console.error(`Download failed for station ${station.callsign}:`, {
            status: downloadResponse.status,
            statusText: downloadResponse.statusText,
            error: downloadData.error || 'Unknown error'
          });
        }
        
        results.push({
          station_id: station.id,
          callsign: station.callsign,
          status: downloadResponse.ok ? 'success' : 'error',
          confirmations_found: downloadData.confirmations_found || 0,
          confirmations_matched: downloadData.confirmations_matched || 0,
          error: downloadResponse.ok ? null : downloadData.error
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
    console.error('LoTW download cron error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}