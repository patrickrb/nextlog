// Cloudlog-compatible Station API endpoint
// GET: Retrieve station information

import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey, canAccessStation } from '@/lib/api-auth';
import { query } from '@/lib/db';
import { addRateLimitHeaders } from '@/lib/api-utils';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const authResult = await verifyApiKey(request);

  if (!authResult.success) {
    return NextResponse.json({
      success: false,
      error: authResult.error
    }, { status: authResult.statusCode || 500 });
  }

  const auth = authResult.auth!;
  const url = new URL(request.url);

  try {
    const stationIdParam = url.searchParams.get('station_id');
    let stationId = auth.stationId;

    // If station_id is specified, verify access
    if (stationIdParam) {
      const requestedStationId = parseInt(stationIdParam);
      if (await canAccessStation(auth, requestedStationId)) {
        stationId = requestedStationId;
      } else {
        return NextResponse.json({
          success: false,
          error: 'Access denied to specified station'
        }, { status: 403 });
      }
    }

    let stationsQuery: string;
    let queryParams: unknown[];

    if (stationId) {
      // Get specific station
      stationsQuery = `
        SELECT 
          s.*,
          de.name as dxcc_name,
          de.prefix as dxcc_prefix
        FROM stations s
        LEFT JOIN dxcc_entities de ON s.dxcc_entity_code = de.adif
        WHERE s.id = $1 AND s.user_id = $2
      `;
      queryParams = [stationId, auth.userId];
    } else {
      // Get all user's stations
      stationsQuery = `
        SELECT 
          s.*,
          de.name as dxcc_name,
          de.prefix as dxcc_prefix
        FROM stations s
        LEFT JOIN dxcc_entities de ON s.dxcc_entity_code = de.adif
        WHERE s.user_id = $1
        ORDER BY s.is_default DESC, s.station_name ASC
      `;
      queryParams = [auth.userId];
    }

    const stationsResult = await query(stationsQuery, queryParams);

    if (stationsResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No stations found'
      }, { status: 404 });
    }

    const stations = stationsResult.rows.map(station => ({
      id: station.id,
      callsign: station.callsign,
      station_name: station.station_name,
      operator_name: station.operator_name,
      qth_name: station.qth_name,
      street_address: station.street_address,
      city: station.city,
      county: station.county,
      state_province: station.state_province,
      postal_code: station.postal_code,
      country: station.country,
      dxcc_entity_code: station.dxcc_entity_code,
      dxcc_name: station.dxcc_name,
      dxcc_prefix: station.dxcc_prefix,
      grid_locator: station.grid_locator,
      latitude: station.latitude,
      longitude: station.longitude,
      itu_zone: station.itu_zone,
      cq_zone: station.cq_zone,
      power_watts: station.power_watts,
      rig_info: station.rig_info,
      antenna_info: station.antenna_info,
      station_equipment: station.station_equipment,
      is_active: station.is_active,
      is_default: station.is_default,
      club_callsign: station.club_callsign,
      created_at: station.created_at,
      updated_at: station.updated_at
    }));

    const response = NextResponse.json({
      success: true,
      stations: stationId ? stations[0] : stations,
      count: stations.length
    });

    // Add rate limit headers  
    addRateLimitHeaders(response, 999, auth.rateLimitPerHour);

    return response;

  } catch (error) {
    logger.error('Station retrieval error', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}