import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { getAdifImportSettings } from '@/lib/settings';

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

    // Get current import settings
    const importSettings = await getAdifImportSettings();
    const maxFileSizeMB = importSettings.adif_max_file_size_mb as number;
    const maxFileSize = maxFileSizeMB * 1024 * 1024;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const stationId = formData.get('stationId') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!stationId) {
      return NextResponse.json({ error: 'Station ID is required' }, { status: 400 });
    }

    // Check file size using dynamic setting
    if (file.size > maxFileSize) {
      return NextResponse.json({ 
        error: `File too large. Please upload files smaller than ${maxFileSizeMB}MB. For larger files, consider splitting them into smaller chunks.` 
      }, { status: 413 });
    }

    // Verify station belongs to user
    const stationQuery = 'SELECT id FROM stations WHERE id = $1 AND user_id = $2';
    const stationResult = await query(stationQuery, [parseInt(stationId), parseInt(user.userId)]);
    
    if (stationResult.rows.length === 0) {
      return NextResponse.json({ error: 'Station not found or access denied' }, { status: 404 });
    }

    // Read and parse ADIF file
    const fileContent = await file.text();
    
    // Quick validation before processing using dynamic settings
    const maxContentSize = maxFileSizeMB * 1.5 * 1024 * 1024; // Allow 1.5x file size for text expansion
    if (fileContent.length > maxContentSize) {
      return NextResponse.json({ 
        error: 'File content too large to process. Please use smaller files.' 
      }, { status: 413 });
    }

    const result = await parseAndImportADIF(fileContent, parseInt(user.userId), parseInt(stationId), importSettings);

    return NextResponse.json(result);
  } catch (error) {
    console.error('ADIF import error:', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('deadline')) {
        return NextResponse.json({
          error: 'Import timeout. Please try with a smaller file or split your ADIF file into chunks.'
        }, { status: 408 });
      }
      if (error.message.includes('memory') || error.message.includes('heap')) {
        return NextResponse.json({
          error: 'File too large to process. Please split into smaller files.'
        }, { status: 413 });
      }
    }
    
    return NextResponse.json(
      { error: 'Internal server error during import. Please try with a smaller file.' },
      { status: 500 }
    );
  }
}

async function parseAndImportADIF(content: string, userId: number, stationId: number, settings: Record<string, unknown>): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    imported: 0,
    skipped: 0,
    errors: 0,
    details: []
  };

  const startTime = Date.now();
  const timeoutMs = (settings.adif_timeout_seconds as number) * 1000; // Dynamic timeout from settings
  const maxRecords = settings.adif_max_record_count as number;
  const batchSize = settings.adif_batch_size as number;
  
  try {
    // Remove header if present (everything before <eoh>)
    const eohIndex = content.toLowerCase().indexOf('<eoh>');
    const dataContent = eohIndex >= 0 ? content.substring(eohIndex + 5) : content;

    // Parse records
    const records = parseADIFRecords(dataContent);
    console.log(`Parsed ${records.length} records from ADIF file`);
    
    // Limit number of records for large imports using dynamic setting
    if (records.length > maxRecords) {
      return {
        success: false,
        imported: 0,
        skipped: 0,
        errors: 1,
        message: `File contains ${records.length} records. For performance reasons, please limit imports to ${maxRecords} records or fewer. Consider using the ADIF splitter tool: node scripts/split-adif.js yourfile.adi 400`
      };
    }
    
    // For large files, provide realistic timeout warning
    const estimatedTimeNeeded = Math.ceil(records.length / batchSize) * 0.2; // Estimate 200ms per batch
    if (estimatedTimeNeeded > (timeoutMs / 1000)) {
      console.warn(`Warning: File has ${records.length} records which may take ~${estimatedTimeNeeded}s but timeout is ${timeoutMs/1000}s. Consider splitting the file.`);
    }
    
    // Process records in batches to avoid timeouts using dynamic setting
    const totalBatches = Math.ceil(records.length / batchSize);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      // Check timeout early with buffer
      const elapsedTime = Date.now() - startTime;
      const remainingTime = timeoutMs - elapsedTime;
      
      if (remainingTime < 3000) { // Leave 3 seconds buffer for final processing
        const recordsProcessed = batchIndex * batchSize;
        const recordsRemaining = records.length - recordsProcessed;
        result.message = `Import timed out after processing ${recordsProcessed}/${records.length} records (${result.imported} imported, ${result.skipped} skipped, ${result.errors} errors). ${recordsRemaining} records remaining. Please try importing in smaller chunks using: node scripts/split-adif.js yourfile.adi 400`;
        result.success = false;
        return result;
      }
      
      const startIdx = batchIndex * batchSize;
      const endIdx = Math.min(startIdx + batchSize, records.length);
      const batch = records.slice(startIdx, endIdx);
      
      console.log(`Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} records) - ${elapsedTime/1000}s elapsed`);
      
      try {
        // Process batch with transaction for better performance
        await processBatch(batch, userId, stationId, result);
        
        // Log progress every 10 batches
        if ((batchIndex + 1) % 10 === 0) {
          console.log(`Progress: ${batchIndex + 1}/${totalBatches} batches completed. ${result.imported} imported, ${result.skipped} skipped, ${result.errors} errors.`);
        }
      } catch (batchError) {
        console.error(`Batch ${batchIndex + 1} failed:`, batchError);
        result.errors += batch.length; // Mark all records in batch as errors
        if (result.details && result.details.length < 10) {
          result.details.push(`Batch ${batchIndex + 1} failed: ${batchError instanceof Error ? batchError.message : 'Unknown error'}`);
        }
      }
      
      // Small delay to prevent overwhelming the database
      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 5)); // Reduced delay
      }
    }

    const totalProcessed = result.imported + result.skipped + result.errors;
    result.message = `Import completed successfully: ${result.imported} imported, ${result.skipped} skipped, ${result.errors} errors out of ${records.length} total records (${totalProcessed}/${records.length} processed)`;
    
    if (totalProcessed < records.length) {
      result.success = false;
      result.message += `. Warning: Only ${totalProcessed} of ${records.length} records were processed.`;
    }
    
    return result;
  } catch (error) {
    console.error('ADIF parsing error:', error);
    
    // More detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    
    console.error('Error stack:', errorStack);
    
    return {
      success: false,
      imported: result.imported,
      skipped: result.skipped,
      errors: result.errors + 1,
      message: `Failed to parse ADIF file: ${errorMessage}. Processed ${result.imported + result.skipped + result.errors} records before failure.`,
      details: result.details || []
    };
  }
}

async function processBatch(records: ADIFRecord[], userId: number, stationId: number, result: ImportResult): Promise<void> {
  for (const record of records) {
    try {
      await importRecord(record, userId, stationId, result);
    } catch (error) {
      result.errors++;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('Record import error:', errorMsg);
      
      // Only store first 10 error details to avoid memory issues
      if (result.details && result.details.length < 10) {
        result.details.push(`Error importing record: ${errorMsg}`);
      }
    }
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
  const duplicateResult = await query(duplicateQuery, [userId, stationId, callsign.toUpperCase(), datetime]);
  
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

  // Parse additional date/time fields
  let qsoDateOff: Date | null = null;
  if (fields.qso_date_off && fields.time_off) {
    try {
      const dateStr = fields.qso_date_off.padStart(8, '0');
      const timeStr = fields.time_off.padStart(6, '0');
      
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1;
      const day = parseInt(dateStr.substring(6, 8));
      const hour = parseInt(timeStr.substring(0, 2));
      const minute = parseInt(timeStr.substring(2, 4));
      const second = parseInt(timeStr.substring(4, 6)) || 0;
      
      qsoDateOff = new Date(Date.UTC(year, month, day, hour, minute, second));
    } catch {
      // Ignore invalid date
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
    longitude: fields.lon_w ? parseFloat(fields.lon_w) : null,
    // Additional ADIF fields
    country: fields.country || null,
    dxcc: fields.dxcc ? parseInt(fields.dxcc) : null,
    cont: fields.cont || null,
    cqz: fields.cqz ? parseInt(fields.cqz) : null,
    ituz: fields.ituz ? parseInt(fields.ituz) : null,
    state: fields.state || null,
    cnty: fields.cnty || null,
    qsl_rcvd: fields.qsl_rcvd || null,
    qsl_sent: fields.qsl_sent || null,
    qsl_via: fields.qsl_via || null,
    eqsl_qsl_rcvd: fields.eqsl_qsl_rcvd || null,
    eqsl_qsl_sent: fields.eqsl_qsl_sent || null,
    lotw_qsl_rcvd: fields.lotw_qsl_rcvd || null,
    lotw_qsl_sent: fields.lotw_qsl_sent || null,
    qso_date_off: qsoDateOff,
    time_off: qsoDateOff ? qsoDateOff.toISOString().split('T')[1].split('.')[0] : null,
    operator: fields.operator || null,
    distance: fields.distance ? parseFloat(fields.distance) : null
  };

  // Insert contact
  const insertQuery = `
    INSERT INTO contacts (
      user_id, station_id, callsign, name, frequency, mode, band, datetime,
      rst_sent, rst_received, qth, grid_locator, notes, latitude, longitude,
      country, dxcc, cont, cqz, ituz, state, cnty, qsl_rcvd, qsl_sent, qsl_via,
      eqsl_qsl_rcvd, eqsl_qsl_sent, lotw_qsl_rcvd, lotw_qsl_sent, qso_date_off,
      time_off, operator, distance
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 
             $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, 
             $30, $31, $32, $33)
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
    contactData.longitude,
    contactData.country,
    contactData.dxcc,
    contactData.cont,
    contactData.cqz,
    contactData.ituz,
    contactData.state,
    contactData.cnty,
    contactData.qsl_rcvd,
    contactData.qsl_sent,
    contactData.qsl_via,
    contactData.eqsl_qsl_rcvd,
    contactData.eqsl_qsl_sent,
    contactData.lotw_qsl_rcvd,
    contactData.lotw_qsl_sent,
    contactData.qso_date_off,
    contactData.time_off,
    contactData.operator,
    contactData.distance
  ];

  await query(insertQuery, values);
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