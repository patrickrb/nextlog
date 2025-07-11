import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';

interface Contact {
  id: number;
  callsign: string;
  name?: string;
  frequency?: number;
  mode: string;
  band?: string;
  datetime: Date;
  rst_sent?: string;
  rst_received?: string;
  qth?: string;
  grid_locator?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  // Additional ADIF fields
  country?: string;
  dxcc?: number;
  cont?: string;
  cqz?: number;
  ituz?: number;
  state?: string;
  cnty?: string;
  qsl_rcvd?: string;
  qsl_sent?: string;
  qsl_via?: string;
  eqsl_qsl_rcvd?: string;
  eqsl_qsl_sent?: string;
  lotw_qsl_rcvd?: string;
  lotw_qsl_sent?: string;
  qso_date_off?: Date;
  time_off?: string;
  operator?: string;
  distance?: number;
  // Station fields
  station_callsign: string;
  my_gridsquare?: string;
  my_city?: string;
  my_state?: string;
  my_country?: string;
  my_dxcc?: number;
  my_itu_zone?: number;
  my_cq_zone?: number;
  tx_pwr?: number;
}

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
             c.time_off, c.operator, c.distance,
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
    const contacts: Contact[] = contactResult.rows;

    if (contacts.length === 0) {
      return NextResponse.json({ error: 'No contacts found for the specified criteria' }, { status: 404 });
    }

    // Generate ADIF content
    const adifContent = generateADIF(contacts);

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

function generateADIF(contacts: Contact[]): string {
  const header = `ADIF Export from NodeLog

<adif_ver:5>3.1.5
<programid:7>NodeLog
<created_timestamp:15>${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
<eoh>

`;

  let records = '';
  
  for (const contact of contacts) {
    let record = '';
    
    // Required fields - each on new line
    record += `<call:${contact.callsign.length}>${contact.callsign.toUpperCase()}\n`;
    
    // Date and time
    const datetime = new Date(contact.datetime);
    const qsoDate = datetime.toISOString().split('T')[0].replace(/-/g, '');
    const timeOn = datetime.toISOString().split('T')[1].split('.')[0].replace(/:/g, '');
    
    record += `<qso_date:8>${qsoDate}\n`;
    record += `<time_on:6>${timeOn}\n`;
    
    // Optional fields - each on new line
    if (contact.name) {
      record += `<name:${contact.name.length}>${contact.name}\n`;
    }
    
    if (contact.frequency) {
      const freqStr = contact.frequency.toString();
      record += `<freq:${freqStr.length}>${freqStr}\n`;
    }
    
    if (contact.mode) {
      record += `<mode:${contact.mode.length}>${contact.mode.toUpperCase()}\n`;
    }
    
    if (contact.band) {
      record += `<band:${contact.band.length}>${contact.band.toUpperCase()}\n`;
    }
    
    if (contact.rst_sent) {
      record += `<rst_sent:${contact.rst_sent.length}>${contact.rst_sent}\n`;
    }
    
    if (contact.rst_received) {
      record += `<rst_rcvd:${contact.rst_received.length}>${contact.rst_received}\n`;
    }
    
    if (contact.qth) {
      record += `<qth:${contact.qth.length}>${contact.qth}\n`;
    }
    
    if (contact.grid_locator) {
      record += `<gridsquare:${contact.grid_locator.length}>${contact.grid_locator.toUpperCase()}\n`;
    }
    
    if (contact.notes) {
      record += `<notes:${contact.notes.length}>${contact.notes}\n`;
    }
    
    if (contact.latitude) {
      const latStr = contact.latitude.toString();
      record += `<lat_n:${latStr.length}>${latStr}\n`;
    }
    
    if (contact.longitude) {
      const lonStr = contact.longitude.toString();
      record += `<lon_w:${lonStr.length}>${lonStr}\n`;
    }
    
    // Station information (My station data)
    if (contact.station_callsign) {
      record += `<station_callsign:${contact.station_callsign.length}>${contact.station_callsign.toUpperCase()}\n`;
    }
    
    if (contact.my_gridsquare) {
      record += `<my_gridsquare:${contact.my_gridsquare.length}>${contact.my_gridsquare.toUpperCase()}\n`;
    }
    
    if (contact.my_city) {
      record += `<my_city:${contact.my_city.length}>${contact.my_city}\n`;
    }
    
    if (contact.my_state) {
      record += `<my_state:${contact.my_state.length}>${contact.my_state}\n`;
    }
    
    if (contact.my_country) {
      record += `<my_country:${contact.my_country.length}>${contact.my_country}\n`;
    }
    
    if (contact.my_dxcc) {
      const dxccStr = contact.my_dxcc.toString();
      record += `<my_dxcc:${dxccStr.length}>${dxccStr}\n`;
    }
    
    if (contact.my_itu_zone) {
      const ituStr = contact.my_itu_zone.toString();
      record += `<my_itu_zone:${ituStr.length}>${ituStr}\n`;
    }
    
    if (contact.my_cq_zone) {
      const cqStr = contact.my_cq_zone.toString();
      record += `<my_cq_zone:${cqStr.length}>${cqStr}\n`;
    }
    
    if (contact.tx_pwr) {
      const pwrStr = contact.tx_pwr.toString();
      record += `<tx_pwr:${pwrStr.length}>${pwrStr}\n`;
    }
    
    // Additional contact fields
    if (contact.country) {
      record += `<country:${contact.country.length}>${contact.country}\n`;
    }
    
    if (contact.dxcc) {
      const dxccStr = contact.dxcc.toString();
      record += `<dxcc:${dxccStr.length}>${dxccStr}\n`;
    }
    
    if (contact.cont) {
      record += `<cont:${contact.cont.length}>${contact.cont}\n`;
    }
    
    if (contact.cqz) {
      const cqzStr = contact.cqz.toString();
      record += `<cqz:${cqzStr.length}>${cqzStr}\n`;
    }
    
    if (contact.ituz) {
      const ituzStr = contact.ituz.toString();
      record += `<ituz:${ituzStr.length}>${ituzStr}\n`;
    }
    
    if (contact.state) {
      record += `<state:${contact.state.length}>${contact.state}\n`;
    }
    
    if (contact.cnty) {
      record += `<cnty:${contact.cnty.length}>${contact.cnty}\n`;
    }
    
    if (contact.qsl_rcvd) {
      record += `<qsl_rcvd:${contact.qsl_rcvd.length}>${contact.qsl_rcvd}\n`;
    }
    
    if (contact.qsl_sent) {
      record += `<qsl_sent:${contact.qsl_sent.length}>${contact.qsl_sent}\n`;
    }
    
    if (contact.qsl_via) {
      record += `<qsl_via:${contact.qsl_via.length}>${contact.qsl_via}\n`;
    }
    
    if (contact.eqsl_qsl_rcvd) {
      record += `<eqsl_qsl_rcvd:${contact.eqsl_qsl_rcvd.length}>${contact.eqsl_qsl_rcvd}\n`;
    }
    
    if (contact.eqsl_qsl_sent) {
      record += `<eqsl_qsl_sent:${contact.eqsl_qsl_sent.length}>${contact.eqsl_qsl_sent}\n`;
    }
    
    if (contact.lotw_qsl_rcvd) {
      record += `<lotw_qsl_rcvd:${contact.lotw_qsl_rcvd.length}>${contact.lotw_qsl_rcvd}\n`;
    }
    
    if (contact.lotw_qsl_sent) {
      record += `<lotw_qsl_sent:${contact.lotw_qsl_sent.length}>${contact.lotw_qsl_sent}\n`;
    }
    
    if (contact.qso_date_off) {
      const qsoDateOff = new Date(contact.qso_date_off).toISOString().split('T')[0].replace(/-/g, '');
      record += `<qso_date_off:8>${qsoDateOff}\n`;
    }
    
    if (contact.time_off) {
      const timeOff = contact.time_off.replace(/:/g, '');
      record += `<time_off:6>${timeOff}\n`;
    }
    
    if (contact.operator) {
      record += `<operator:${contact.operator.length}>${contact.operator}\n`;
    }
    
    if (contact.distance) {
      const distStr = contact.distance.toString();
      record += `<distance:${distStr.length}>${distStr}\n`;
    }
    
    record += '<eor>\n\n';
    records += record;
  }
  
  return header + records;
}