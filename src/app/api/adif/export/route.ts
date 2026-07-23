import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { generateAdif, type AdifExportContact } from '@/lib/adif';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { stationId, startDate, endDate } = body;

    if (!stationId) {
      return NextResponse.json({ error: 'Station ID is required' }, { status: 400 });
    }

    // Verify station belongs to user
    const stationQuery = 'SELECT id, callsign, station_name FROM stations WHERE id = $1 AND user_id = $2';
    const stationResult = await query(stationQuery, [parseInt(stationId), parseInt(user.userId)]);
    
    if (stationResult.rows.length === 0) {
      return NextResponse.json({ error: 'Station not found or access denied' }, { status: 404 });
    }

    const station = stationResult.rows[0];

    // Get date range for contacts if not specified
    let effectiveStartDate = startDate;
    let effectiveEndDate = endDate;

    if (!startDate || !endDate) {
      const dateRangeQuery = `
        SELECT MIN(datetime) as first_contact, MAX(datetime) as last_contact
        FROM contacts 
        WHERE user_id = $1 AND station_id = $2
      `;
      const dateRangeResult = await query(dateRangeQuery, [parseInt(user.userId), parseInt(stationId)]);
      
      if (dateRangeResult.rows.length > 0 && dateRangeResult.rows[0].first_contact) {
        if (!startDate) {
          effectiveStartDate = dateRangeResult.rows[0].first_contact.toISOString().split('T')[0];
        }
        if (!endDate) {
          effectiveEndDate = dateRangeResult.rows[0].last_contact.toISOString().split('T')[0];
        }
      }
    }

    // Build query with date filtering - join with stations table for station info
    let contactQuery = `
      SELECT c.id, c.callsign, c.name, c.frequency, c.mode, c.band, c.datetime, 
             c.rst_sent, c.rst_received, c.qth, c.grid_locator, c.notes, 
             c.latitude, c.longitude, c.country, c.dxcc, c.cont, c.cqz, c.ituz, 
             c.state, c.cnty, c.qsl_rcvd, c.qsl_sent, c.qsl_via, c.eqsl_qsl_rcvd, 
             c.eqsl_qsl_sent, c.lotw_qsl_rcvd, c.lotw_qsl_sent, c.qso_date_off,
             c.time_off, c.operator, c.distance, c.prop_mode, c.sat_name,
             c.band_rx, c.freq_rx, c.iota,
             s.callsign as station_callsign, s.grid_locator as my_gridsquare,
             s.city as my_city, s.state_province as my_state, s.country as my_country,
             s.dxcc_entity_code as my_dxcc, s.itu_zone as my_itu_zone, 
             s.cq_zone as my_cq_zone, s.power_watts as tx_pwr
      FROM contacts c
      JOIN stations s ON c.station_id = s.id
      WHERE c.user_id = $1 AND c.station_id = $2
    `;
    const queryParams: (number | Date)[] = [parseInt(user.userId), parseInt(stationId)];

    if (effectiveStartDate) {
      queryParams.push(new Date(effectiveStartDate));
      contactQuery += ` AND datetime >= $${queryParams.length}`;
    }

    if (effectiveEndDate) {
      queryParams.push(new Date(effectiveEndDate + 'T23:59:59.999Z')); // End of day
      contactQuery += ` AND datetime <= $${queryParams.length}`;
    }

    contactQuery += ' ORDER BY datetime DESC';

    const contactResult = await query(contactQuery, queryParams);
    const contacts: AdifExportContact[] = contactResult.rows;

    if (contacts.length === 0) {
      return NextResponse.json({ error: 'No contacts found for the specified criteria' }, { status: 404 });
    }

    // Generate ADIF content
    const adifContent = generateAdif(contacts);

    // Create filename
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `${station.callsign}_${dateStr}.adi`;

    // Return ADIF file as download
    return new NextResponse(adifContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('ADIF export error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
