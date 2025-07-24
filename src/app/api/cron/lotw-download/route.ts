// LoTW Download Cron Job
// This endpoint is called by Vercel Cron to automatically download confirmations from LoTW

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Starting LoTW download cron job...');
    
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
          console.log(`Skipping station ${station.callsign} - downloaded recently`);
          results.push({
            station_id: station.id,
            callsign: station.callsign,
            status: 'skipped',
            reason: 'downloaded_recently'
          });
          continue;
        }

        // Make internal API call to download endpoint
        const downloadResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/lotw/download`, {
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
        
        results.push({
          station_id: station.id,
          callsign: station.callsign,
          status: downloadResponse.ok ? 'success' : 'error',
          confirmations_found: downloadData.confirmations_found || 0,
          confirmations_matched: downloadData.confirmations_matched || 0,
          error: downloadResponse.ok ? null : downloadData.error
        });

        console.log(`Station ${station.callsign}: ${downloadResponse.ok ? 'success' : 'error'} - ${downloadData.confirmations_found || 0} confirmations found, ${downloadData.confirmations_matched || 0} matched`);

      } catch (stationError) {
        console.error(`Error processing station ${station.callsign}:`, stationError);
        results.push({
          station_id: station.id,
          callsign: station.callsign,
          status: 'error',
          error: stationError.message
        });
      }
    }

    console.log('LoTW download cron job completed');

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