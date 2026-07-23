// ADIF (Amateur Data Interchange Format) parsing and insertion helpers.
// Shared by the UI-driven file import (/api/adif/import) and the
// wavelog-compatible /api/qso endpoint that third-party ham radio software
// posts to.

import { query } from '@/lib/db';

export interface AdifRecord {
  fields: { [key: string]: string };
}

export interface InsertResult {
  inserted: boolean;
  skipped: boolean;
  error?: string;
}

/**
 * Parse an ADIF document into one record per QSO. Strips the header (everything
 * up to and including the first <eoh>) if present, then splits on <eor>.
 * Field names are lowercased; values are clipped to the declared length.
 */
export function parseAdifRecords(content: string): AdifRecord[] {
  const eohIndex = content.toLowerCase().indexOf('<eoh>');
  const dataContent = eohIndex >= 0 ? content.substring(eohIndex + 5) : content;

  const records: AdifRecord[] = [];
  const recordStrings = dataContent.split(/<eor>/i).filter(r => r.trim());

  for (const recordString of recordStrings) {
    const record = parseSingleRecord(recordString.trim());
    if (record && Object.keys(record.fields).length > 0) {
      records.push(record);
    }
  }

  return records;
}

function parseSingleRecord(recordString: string): AdifRecord | null {
  const fields: { [key: string]: string } = {};
  // ADIF field spec: <fieldname:length[:type]>data
  // The optional data-type indicator (e.g. <QSO_DATE:8:D>, <TIME_ON:6:T>,
  // <FREQ:8:N>) is emitted by WSJT-X, N1MM, Log4OM and most modern loggers.
  // The previous regex required '>' immediately after the length, so any
  // type-qualified field was silently dropped on import — and when that field
  // was QSO_DATE or TIME_ON the whole QSO was rejected as "missing date/time".
  // We now skip an optional ':type' segment; name + length still drive parsing.
  const fieldRegex = /<([^:>]+):(\d+)(?::[^>]*)?>([^<]*)/gi;
  let match;

  while ((match = fieldRegex.exec(recordString)) !== null) {
    const fieldName = match[1].toLowerCase();
    const length = parseInt(match[2], 10);
    let value = match[3];

    if (value.length > length) {
      value = value.substring(0, length);
    }

    fields[fieldName] = value.trim();
  }

  return { fields };
}

/**
 * Insert one parsed ADIF record into the contacts table for the given user +
 * station. Returns a discriminated result describing what happened:
 *   - { inserted: true } on success
 *   - { skipped: true }  on duplicate (same callsign + datetime + station)
 *   - { error: "..." }   on validation failure
 *
 * Does NOT throw for missing-field validation failures (callsign, date/time);
 * does throw for unexpected DB errors so callers can bucket them.
 */
export async function insertAdifRecord(
  record: AdifRecord,
  userId: number,
  stationId: number,
): Promise<InsertResult> {
  const fields = record.fields;

  // Wavelog/Cloudlog tolerates slashed-zero (Ø) in callsigns; normalize.
  const rawCallsign = fields.call;
  if (!rawCallsign) {
    return { inserted: false, skipped: false, error: 'Record missing callsign' };
  }
  const callsign = rawCallsign.replace(/Ø/g, '0').toUpperCase();

  const qsoDate = fields.qso_date || fields.qso_date_on;
  const timeOn = fields.time_on;

  if (!qsoDate || !timeOn) {
    return { inserted: false, skipped: false, error: `Missing date/time for ${callsign}` };
  }

  const datetime = adifDateTimeToUtc(qsoDate, timeOn);
  if (!datetime) {
    return { inserted: false, skipped: false, error: `Invalid date/time for ${callsign}: ${qsoDate} ${timeOn}` };
  }

  // Duplicate check: same station already has this exact callsign at this exact moment.
  const dupeResult = await query(
    'SELECT id FROM contacts WHERE user_id = $1 AND station_id = $2 AND callsign = $3 AND datetime = $4',
    [userId, stationId, callsign, datetime],
  );
  if (dupeResult.rows.length > 0) {
    return { inserted: false, skipped: true };
  }

  // Frequency → band fallback when band wasn't provided.
  let frequency: number | null = null;
  let band = fields.band || '';
  if (fields.freq) {
    frequency = parseFloat(fields.freq);
    if (!band && frequency) {
      band = frequencyToBand(frequency);
    }
  }

  let qsoDateOff: Date | null = null;
  if (fields.qso_date_off && fields.time_off) {
    qsoDateOff = adifDateTimeToUtc(fields.qso_date_off, fields.time_off);
  }

  const values = [
    userId,
    stationId,
    callsign,
    fields.name || null,
    frequency,
    fields.mode || fields.submode || 'SSB',
    band || null,
    datetime,
    fields.rst_sent || null,
    fields.rst_rcvd || null,
    fields.qth || null,
    fields.gridsquare || null,
    fields.notes || fields.comment || null,
    fields.lat_n ? parseFloat(fields.lat_n) : null,
    fields.lon_w ? parseFloat(fields.lon_w) : null,
    fields.country || null,
    fields.dxcc ? parseInt(fields.dxcc) : null,
    fields.cont || null,
    fields.cqz ? parseInt(fields.cqz) : null,
    fields.ituz ? parseInt(fields.ituz) : null,
    fields.state || null,
    fields.cnty || null,
    fields.qsl_rcvd || null,
    fields.qsl_sent || null,
    fields.qsl_via || null,
    fields.eqsl_qsl_rcvd || null,
    fields.eqsl_qsl_sent || null,
    fields.lotw_qsl_rcvd || null,
    fields.lotw_qsl_sent || null,
    qsoDateOff,
    qsoDateOff ? qsoDateOff.toISOString().split('T')[1].split('.')[0] : null,
    fields.operator || null,
    fields.distance ? parseFloat(fields.distance) : null,
  ];

  await query(
    `INSERT INTO contacts (
      user_id, station_id, callsign, name, frequency, mode, band, datetime,
      rst_sent, rst_received, qth, grid_locator, notes, latitude, longitude,
      country, dxcc, cont, cqz, ituz, state, cnty, qsl_rcvd, qsl_sent, qsl_via,
      eqsl_qsl_rcvd, eqsl_qsl_sent, lotw_qsl_rcvd, lotw_qsl_sent, qso_date_off,
      time_off, operator, distance
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
             $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29,
             $30, $31, $32, $33)`,
    values,
  );

  return { inserted: true, skipped: false };
}

function adifDateTimeToUtc(adifDate: string, adifTime: string): Date | null {
  try {
    // ADIF date format: YYYYMMDD, time format: HHMMSS or HHMM (pad)
    const dateStr = adifDate.padStart(8, '0');
    const timeStr = adifTime.padStart(6, '0');

    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    const hour = parseInt(timeStr.substring(0, 2));
    const minute = parseInt(timeStr.substring(2, 4));
    const second = parseInt(timeStr.substring(4, 6)) || 0;

    const d = new Date(Date.UTC(year, month, day, hour, minute, second));
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function frequencyToBand(frequency: number): string {
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
