// ADIF (Amateur Data Interchange Format) parsing and insertion helpers.
// Shared by the UI-driven file import (/api/adif/import) and the
// wavelog-compatible /api/qso endpoint that third-party ham radio software
// posts to.

import { query } from '@/lib/db';
import { frequencyToBand } from '@/lib/bands';

// Re-exported so existing importers (and tests) can keep sourcing the band
// mapper from '@/lib/adif'. The implementation now lives in '@/lib/bands' — a
// server-imports-free module the client logging forms can share.
export { frequencyToBand };

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

  // Satellite / split receive frequency → band fallback, mirroring the freq
  // handling above so a satellite QSO that only carries FREQ_RX still lands on
  // the right receive band.
  let freqRx: number | null = null;
  let bandRx = fields.band_rx || '';
  if (fields.freq_rx) {
    freqRx = parseFloat(fields.freq_rx);
    if (!bandRx && freqRx) {
      bandRx = frequencyToBand(freqRx);
    }
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
    fields.prop_mode ? fields.prop_mode.toUpperCase() : null,
    fields.sat_name ? fields.sat_name.toUpperCase() : null,
    bandRx || null,
    freqRx,
    fields.iota ? fields.iota.toUpperCase() : null,
  ];

  await query(
    `INSERT INTO contacts (
      user_id, station_id, callsign, name, frequency, mode, band, datetime,
      rst_sent, rst_received, qth, grid_locator, notes, latitude, longitude,
      country, dxcc, cont, cqz, ituz, state, cnty, qsl_rcvd, qsl_sent, qsl_via,
      eqsl_qsl_rcvd, eqsl_qsl_sent, lotw_qsl_rcvd, lotw_qsl_sent, qso_date_off,
      time_off, operator, distance, prop_mode, sat_name, band_rx, freq_rx, iota
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
             $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29,
             $30, $31, $32, $33, $34, $35, $36, $37, $38)`,
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

/**
 * Shape of a contact row (joined with its station) as exported to ADIF.
 * Mirrors the columns selected by the /api/adif/export route.
 */
export interface AdifExportContact {
  callsign: string;
  name?: string | null;
  frequency?: number | null;
  mode?: string | null;
  band?: string | null;
  datetime: Date | string;
  rst_sent?: string | null;
  rst_received?: string | null;
  qth?: string | null;
  grid_locator?: string | null;
  notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  country?: string | null;
  dxcc?: number | null;
  cont?: string | null;
  cqz?: number | null;
  ituz?: number | null;
  state?: string | null;
  cnty?: string | null;
  qsl_rcvd?: string | null;
  qsl_sent?: string | null;
  qsl_via?: string | null;
  eqsl_qsl_rcvd?: string | null;
  eqsl_qsl_sent?: string | null;
  lotw_qsl_rcvd?: string | null;
  lotw_qsl_sent?: string | null;
  qso_date_off?: Date | string | null;
  time_off?: string | null;
  operator?: string | null;
  distance?: number | null;
  // Satellite / split-operation and IOTA fields. These are stored on every
  // contact but were previously dropped on export, so satellite QSOs lost their
  // bird/propagation identity and IOTA references never round-tripped.
  prop_mode?: string | null;
  sat_name?: string | null;
  band_rx?: string | null;
  freq_rx?: number | null;
  iota?: string | null;
  // Station ("my") fields.
  station_callsign?: string | null;
  my_gridsquare?: string | null;
  my_city?: string | null;
  my_state?: string | null;
  my_country?: string | null;
  my_dxcc?: number | null;
  my_itu_zone?: number | null;
  my_cq_zone?: number | null;
  tx_pwr?: number | null;
}

/**
 * Format one ADIF field as `<name:byteLength>value`.
 *
 * ADIF declares each field's length as the number of octets (UTF-8 bytes) of
 * its data — NOT the number of Unicode code points. Using JS `String.length`
 * (UTF-16 code units) under-counts multi-byte characters (accents, ø, CJK,
 * emoji), so a name like "José" was exported as `<name:4>José` when the data is
 * 5 bytes. Strict ADIF readers (LoTW/TQSL, Cloudlog, N1MM) then truncate or
 * mis-align the field. We count UTF-8 bytes so the declared length is correct.
 *
 * Returns '' for empty/nullish values (and for numeric 0) so optional fields
 * are omitted rather than emitted blank — matching the export's prior gating.
 */
export function adifField(name: string, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '' || value === 0) {
    return '';
  }
  const str = String(value);
  const byteLength = Buffer.byteLength(str, 'utf8');
  return `<${name}:${byteLength}>${str}\n`;
}

/**
 * Serialize contacts to an ADIF 3.1.5 document. Field selection and value
 * transforms (callsign/mode/band/grid uppercasing, freq in MHz, etc.) mirror
 * what other logging software expects on import.
 */
export function generateAdif(contacts: AdifExportContact[]): string {
  const createdTimestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const header =
    'ADIF Export from Nextlog\n\n' +
    adifField('adif_ver', '3.1.5') +
    adifField('programid', 'Nextlog') +
    adifField('created_timestamp', createdTimestamp) +
    '<eoh>\n\n';

  let records = '';

  for (const contact of contacts) {
    const datetime = new Date(contact.datetime);
    const qsoDate = datetime.toISOString().split('T')[0].replace(/-/g, '');
    const timeOn = datetime.toISOString().split('T')[1].split('.')[0].replace(/:/g, '');

    let record = '';
    record += adifField('call', contact.callsign.toUpperCase());
    record += adifField('qso_date', qsoDate);
    record += adifField('time_on', timeOn);

    record += adifField('name', contact.name);
    record += adifField('freq', contact.frequency);
    record += adifField('mode', contact.mode ? contact.mode.toUpperCase() : contact.mode);
    record += adifField('band', contact.band ? contact.band.toUpperCase() : contact.band);
    record += adifField('rst_sent', contact.rst_sent);
    record += adifField('rst_rcvd', contact.rst_received);
    record += adifField('qth', contact.qth);
    record += adifField('gridsquare', contact.grid_locator ? contact.grid_locator.toUpperCase() : contact.grid_locator);
    record += adifField('notes', contact.notes);
    record += adifField('lat_n', contact.latitude);
    record += adifField('lon_w', contact.longitude);

    // Station ("my") information.
    record += adifField('station_callsign', contact.station_callsign ? contact.station_callsign.toUpperCase() : contact.station_callsign);
    record += adifField('my_gridsquare', contact.my_gridsquare ? contact.my_gridsquare.toUpperCase() : contact.my_gridsquare);
    record += adifField('my_city', contact.my_city);
    record += adifField('my_state', contact.my_state);
    record += adifField('my_country', contact.my_country);
    record += adifField('my_dxcc', contact.my_dxcc);
    record += adifField('my_itu_zone', contact.my_itu_zone);
    record += adifField('my_cq_zone', contact.my_cq_zone);
    record += adifField('tx_pwr', contact.tx_pwr);

    // Additional contact fields.
    record += adifField('country', contact.country);
    record += adifField('dxcc', contact.dxcc);
    record += adifField('cont', contact.cont);
    record += adifField('cqz', contact.cqz);
    record += adifField('ituz', contact.ituz);
    record += adifField('state', contact.state);
    record += adifField('cnty', contact.cnty);
    record += adifField('qsl_rcvd', contact.qsl_rcvd);
    record += adifField('qsl_sent', contact.qsl_sent);
    record += adifField('qsl_via', contact.qsl_via);
    record += adifField('eqsl_qsl_rcvd', contact.eqsl_qsl_rcvd);
    record += adifField('eqsl_qsl_sent', contact.eqsl_qsl_sent);
    record += adifField('lotw_qsl_rcvd', contact.lotw_qsl_rcvd);
    record += adifField('lotw_qsl_sent', contact.lotw_qsl_sent);

    if (contact.qso_date_off) {
      const qsoDateOff = new Date(contact.qso_date_off).toISOString().split('T')[0].replace(/-/g, '');
      record += adifField('qso_date_off', qsoDateOff);
    }
    record += adifField('time_off', contact.time_off ? contact.time_off.replace(/:/g, '') : contact.time_off);
    record += adifField('operator', contact.operator);
    record += adifField('distance', contact.distance);

    // Satellite / split-operation and IOTA fields. Designators (SAT, SO-50,
    // NA-001) and bands are conventionally uppercase, matching band/gridsquare.
    record += adifField('prop_mode', contact.prop_mode ? contact.prop_mode.toUpperCase() : contact.prop_mode);
    record += adifField('sat_name', contact.sat_name ? contact.sat_name.toUpperCase() : contact.sat_name);
    record += adifField('band_rx', contact.band_rx ? contact.band_rx.toUpperCase() : contact.band_rx);
    record += adifField('freq_rx', contact.freq_rx);
    record += adifField('iota', contact.iota ? contact.iota.toUpperCase() : contact.iota);

    record += '<eor>\n\n';
    records += record;
  }

  return header + records;
}
