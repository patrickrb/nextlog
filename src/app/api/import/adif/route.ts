import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import pool from '@/lib/db';


interface ADIFRecord {
  fields: { [key: string]: string };
}

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: number;
  message?: string;
  details?: string[];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const stationId = formData.get('stationId') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!stationId) {
      return NextResponse.json({ error: 'Station ID is required' }, { status: 400 });
    }

    // Verify station belongs to user
    const stationQuery = 'SELECT id FROM stations WHERE id = $1 AND user_id = $2';
    const stationResult = await pool.query(stationQuery, [parseInt(stationId), parseInt(user.userId)]);
    
    if (stationResult.rows.length === 0) {
      return NextResponse.json({ error: 'Station not found or access denied' }, { status: 404 });
    }

    // Read and parse ADIF file
    const fileContent = await file.text();
    const result = await parseAndImportADIF(fileContent, parseInt(user.userId), parseInt(stationId));

    return NextResponse.json(result);
  } catch (error) {
    console.error('ADIF import error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function parseAndImportADIF(content: string, userId: number, stationId: number): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    imported: 0,
    skipped: 0,
    errors: 0,
    details: []
  };

  try {
    // Remove header if present (everything before <eoh>)
    const eohIndex = content.toLowerCase().indexOf('<eoh>');
    const dataContent = eohIndex >= 0 ? content.substring(eohIndex + 5) : content;

    // Parse records
    const records = parseADIFRecords(dataContent);
    
    for (const record of records) {
      try {
        await importRecord(record, userId, stationId, result);
      } catch (error) {
        result.errors++;
        result.details?.push(`Error importing record: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    result.message = `Import completed: ${result.imported} imported, ${result.skipped} skipped, ${result.errors} errors`;
    return result;
  } catch (error) {
    return {
      success: false,
      imported: 0,
      skipped: 0,
      errors: 1,
      message: `Failed to parse ADIF file: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

function parseADIFRecords(content: string): ADIFRecord[] {
  const records: ADIFRecord[] = [];
  
  // Split by <eor> (end of record)
  const recordStrings = content.split(/<eor>/i).filter(r => r.trim());
  
  for (const recordString of recordStrings) {
    const record = parseADIFRecord(recordString.trim());
    if (record && Object.keys(record.fields).length > 0) {
      records.push(record);
    }
  }
  
  return records;
}

function parseADIFRecord(recordString: string): ADIFRecord | null {
  const fields: { [key: string]: string } = {};
  
  // Regular expression to match ADIF fields: <fieldname:length>value
  const fieldRegex = /<([^:>]+):(\d+)>([^<]*)/gi;
  let match;
  
  while ((match = fieldRegex.exec(recordString)) !== null) {
    const fieldName = match[1].toLowerCase();
    const length = parseInt(match[2]);
    let value = match[3];
    
    // Ensure we only take the specified length
    if (value.length > length) {
      value = value.substring(0, length);
    }
    
    fields[fieldName] = value.trim();
  }
  
  return { fields };
}

async function importRecord(record: ADIFRecord, userId: number, stationId: number, result: ImportResult): Promise<void> {
  const fields = record.fields;
  
  // Required fields
  const callsign = fields.call;
  if (!callsign) {
    result.errors++;
    result.details?.push('Record missing callsign');
    return;
  }

  // Parse date and time
  const qsoDate = fields.qso_date || fields.qso_date_on;
  const timeOn = fields.time_on;
  
  let datetime: Date | null = null;
  if (qsoDate && timeOn) {
    try {
      // ADIF date format: YYYYMMDD, time format: HHMMSS or HHMM
      const dateStr = qsoDate.padStart(8, '0');
      const timeStr = timeOn.padStart(6, '0');
      
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-indexed
      const day = parseInt(dateStr.substring(6, 8));
      const hour = parseInt(timeStr.substring(0, 2));
      const minute = parseInt(timeStr.substring(2, 4));
      const second = parseInt(timeStr.substring(4, 6)) || 0;
      
      datetime = new Date(Date.UTC(year, month, day, hour, minute, second));
    } catch {
      result.errors++;
      result.details?.push(`Invalid date/time format for ${callsign}: ${qsoDate} ${timeOn}`);
      return;
    }
  }

  if (!datetime) {
    result.errors++;
    result.details?.push(`Missing or invalid date/time for ${callsign}`);
    return;
  }

  // Check for duplicates
  const duplicateQuery = `
    SELECT id FROM contacts 
    WHERE user_id = $1 AND station_id = $2 AND callsign = $3 AND datetime = $4
  `;
  const duplicateResult = await pool.query(duplicateQuery, [userId, stationId, callsign.toUpperCase(), datetime]);
  
  if (duplicateResult.rows.length > 0) {
    result.skipped++;
    return;
  }

  // Parse frequency and determine band
  let frequency: number | null = null;
  let band = fields.band || '';
  
  if (fields.freq) {
    frequency = parseFloat(fields.freq);
    if (!band && frequency) {
      band = frequencyToBand(frequency);
    }
  }

  // Prepare contact data
  const contactData = {
    user_id: userId,
    station_id: stationId,
    callsign: callsign.toUpperCase(),
    name: fields.name || null,
    frequency: frequency,
    mode: fields.mode || fields.submode || 'SSB',
    band: band || null,
    datetime: datetime,
    rst_sent: fields.rst_sent || null,
    rst_received: fields.rst_rcvd || null,
    qth: fields.qth || null,
    grid_locator: fields.gridsquare || null,
    notes: fields.notes || fields.comment || null,
    latitude: fields.lat_n ? parseFloat(fields.lat_n) : null,
    longitude: fields.lon_w ? parseFloat(fields.lon_w) : null
  };

  // Insert contact
  const insertQuery = `
    INSERT INTO contacts (
      user_id, station_id, callsign, name, frequency, mode, band, datetime,
      rst_sent, rst_received, qth, grid_locator, notes, latitude, longitude
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
  `;

  const values = [
    contactData.user_id,
    contactData.station_id,
    contactData.callsign,
    contactData.name,
    contactData.frequency,
    contactData.mode,
    contactData.band,
    contactData.datetime,
    contactData.rst_sent,
    contactData.rst_received,
    contactData.qth,
    contactData.grid_locator,
    contactData.notes,
    contactData.latitude,
    contactData.longitude
  ];

  await pool.query(insertQuery, values);
  result.imported++;
}

function frequencyToBand(frequency: number): string {
  // Convert frequency (MHz) to amateur radio band
  if (frequency >= 1.8 && frequency <= 2.0) return '160M';
  if (frequency >= 3.5 && frequency <= 4.0) return '80M';
  if (frequency >= 7.0 && frequency <= 7.3) return '40M';
  if (frequency >= 10.1 && frequency <= 10.15) return '30M';
  if (frequency >= 14.0 && frequency <= 14.35) return '20M';
  if (frequency >= 18.068 && frequency <= 18.168) return '17M';
  if (frequency >= 21.0 && frequency <= 21.45) return '15M';
  if (frequency >= 24.89 && frequency <= 24.99) return '12M';
  if (frequency >= 28.0 && frequency <= 29.7) return '10M';
  if (frequency >= 50.0 && frequency <= 54.0) return '6M';
  if (frequency >= 144.0 && frequency <= 148.0) return '2M';
  if (frequency >= 420.0 && frequency <= 450.0) return '70CM';
  if (frequency >= 902.0 && frequency <= 928.0) return '33CM';
  if (frequency >= 1240.0 && frequency <= 1300.0) return '23CM';
  
  return 'OTHER';
}