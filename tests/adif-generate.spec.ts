import { test, expect } from '@playwright/test';
import {
  adifField,
  adifCoordToDecimal,
  decimalToAdifCoord,
  generateAdif,
  parseAdifRecords,
  type AdifExportContact,
} from '@/lib/adif';

// Pure-function tests for the ADIF exporter. These exercise generateAdif() /
// adifField() directly (no browser/DB needed) and guard the interop bug where
// field lengths were declared using JS string length (UTF-16 code units)
// instead of the UTF-8 byte count the ADIF spec requires.

test.describe('adifField', () => {
  test('declares length as the UTF-8 byte count, not code units', () => {
    // "José" is 4 code units but 5 bytes (é = 2 bytes in UTF-8).
    expect(adifField('name', 'José')).toBe('<name:5>José\n');
    // A BMP CJK char is 1 code unit but 3 bytes.
    expect(adifField('qth', '東京')).toBe('<qth:6>東京\n');
    // Slashed zero used in some callsigns is 2 bytes.
    expect(adifField('call', 'RN3Ø')).toBe('<call:5>RN3Ø\n');
  });

  test('matches string length for plain ASCII', () => {
    expect(adifField('call', 'W1AW')).toBe('<call:4>W1AW\n');
  });

  test('omits empty, null, undefined and numeric-zero values', () => {
    expect(adifField('name', '')).toBe('');
    expect(adifField('name', null)).toBe('');
    expect(adifField('name', undefined)).toBe('');
    expect(adifField('dxcc', 0)).toBe('');
  });

  test('serializes numbers', () => {
    expect(adifField('dxcc', 291)).toBe('<dxcc:3>291\n');
    expect(adifField('freq', 14.074)).toBe('<freq:6>14.074\n');
  });
});

// The ADIF "Location" data type is `XDDD MM.MMM` (hemisphere letter, 3-digit
// degrees, minutes) — NOT decimal degrees. Nextlog previously round-tripped raw
// decimals through non-standard lat_n/lon_w fields, so coordinates never
// interoperated with LoTW/TQSL, Cloudlog or N1MM. These guard the conversion.
test.describe('adifCoordToDecimal', () => {
  test('parses the four hemispheres into signed decimal degrees', () => {
    expect(adifCoordToDecimal('N040 26.500')).toBeCloseTo(40.44167, 4);
    expect(adifCoordToDecimal('S040 26.500')).toBeCloseTo(-40.44167, 4);
    expect(adifCoordToDecimal('E073 58.000')).toBeCloseTo(73.96667, 4);
    expect(adifCoordToDecimal('W073 58.000')).toBeCloseTo(-73.96667, 4);
  });

  test('handles the origin and is case/whitespace tolerant', () => {
    expect(adifCoordToDecimal('N000 00.000')).toBe(0);
    expect(adifCoordToDecimal('  w000 30.000  ')).toBeCloseTo(-0.5, 6);
  });

  test('rejects malformed values', () => {
    expect(adifCoordToDecimal('40.44')).toBeNull(); // plain decimal, no hemisphere
    expect(adifCoordToDecimal('X040 26.500')).toBeNull(); // bad hemisphere letter
    expect(adifCoordToDecimal('N040 60.000')).toBeNull(); // minutes must be < 60
    expect(adifCoordToDecimal('')).toBeNull();
  });
});

test.describe('decimalToAdifCoord', () => {
  test('formats signed decimals with padded degrees/minutes', () => {
    expect(decimalToAdifCoord(40.44167, 'lat')).toBe('N040 26.500');
    expect(decimalToAdifCoord(-40.44167, 'lat')).toBe('S040 26.500');
    expect(decimalToAdifCoord(-73.96667, 'lon')).toBe('W073 58.000');
    expect(decimalToAdifCoord(0, 'lat')).toBe('N000 00.000');
  });

  test('round-trips decimal → ADIF → decimal within a metre', () => {
    for (const [dec, axis] of [
      [51.4779, 'lat'],
      [-0.0015, 'lon'],
      [-33.8688, 'lat'],
      [151.2093, 'lon'],
    ] as const) {
      const parsed = adifCoordToDecimal(decimalToAdifCoord(dec, axis));
      expect(parsed).toBeCloseTo(dec, 4);
    }
  });
});

function baseContact(overrides: Partial<AdifExportContact> = {}): AdifExportContact {
  return {
    callsign: 'w1aw',
    mode: 'ssb',
    band: '20m',
    datetime: '2024-01-15T12:34:56.000Z',
    station_callsign: 'k1xx',
    ...overrides,
  };
}

test.describe('generateAdif', () => {
  test('emits a header, required fields and an <eor> terminator', () => {
    const adif = generateAdif([baseContact()]);

    expect(adif).toContain('<eoh>');
    expect(adif).toContain('<adif_ver:5>3.1.5');
    expect(adif).toContain('<programid:7>Nextlog');
    expect(adif).toContain('<call:4>W1AW');
    expect(adif).toContain('<qso_date:8>20240115');
    expect(adif).toContain('<time_on:6>123456');
    expect(adif).toContain('<mode:3>SSB');
    expect(adif).toContain('<band:3>20M');
    expect(adif.trimEnd().endsWith('<eor>')).toBe(true);
  });

  test('declares byte-correct lengths for non-ASCII operator data', () => {
    const adif = generateAdif([baseContact({ name: 'José', qth: '東京' })]);

    expect(adif).toContain('<name:5>José');
    expect(adif).toContain('<qth:6>東京');
  });

  test('round-trips back through the parser without truncation', () => {
    const adif = generateAdif([
      baseContact({ callsign: 'dl1abc', name: 'Jürgen', qth: 'München' }),
    ]);

    // Strip the header/comment so the parser only sees the QSO record.
    const [record] = parseAdifRecords(adif);

    expect(record.fields.call).toBe('DL1ABC');
    expect(record.fields.name).toBe('Jürgen');
    expect(record.fields.qth).toBe('München');
    expect(record.fields.qso_date).toBe('20240115');
    expect(record.fields.time_on).toBe('123456');
  });

  test('omits optional fields that are absent', () => {
    const adif = generateAdif([baseContact()]);

    expect(adif).not.toContain('<name:');
    expect(adif).not.toContain('<notes:');
    expect(adif).not.toContain('<gridsquare:');
  });

  // The search-results export (/api/contacts/search?export=true) feeds raw
  // contact rows straight into generateAdif. Contacts imported without a
  // frequency/mode/band leave those columns null, so the exporter must tolerate
  // nullish values instead of throwing (the old hand-rolled generator called
  // .toString()/.length on them and 500'd the whole export).
  test('tolerates null frequency, mode and band without throwing', () => {
    const adif = generateAdif([
      baseContact({ mode: null, band: null, frequency: null }),
    ]);

    expect(adif).toContain('<call:4>W1AW');
    expect(adif).not.toContain('<mode:');
    expect(adif).not.toContain('<band:');
    expect(adif).not.toContain('<freq:');
    expect(adif.trimEnd().endsWith('<eor>')).toBe(true);
  });

  // The same export path carries DXCC / QSL / country data the hand-rolled
  // generator used to drop. Guard that these survive so award and QSL tooling
  // downstream can consume search exports.
  test('includes DXCC, QSL and country fields for the search export', () => {
    const adif = generateAdif([
      baseContact({
        dxcc: 291,
        country: 'United States',
        qsl_rcvd: 'Y',
        lotw_qsl_rcvd: 'Y',
      }),
    ]);

    expect(adif).toContain('<dxcc:3>291');
    expect(adif).toContain('<country:13>United States');
    expect(adif).toContain('<qsl_rcvd:1>Y');
    expect(adif).toContain('<lotw_qsl_rcvd:1>Y');
  });

  // Satellite and IOTA data is stored on every contact but used to be dropped on
  // export, so a satellite QSO lost its bird/propagation identity (breaking LoTW
  // satellite awards) and IOTA references never round-tripped. Guard that these
  // survive export, uppercased like other designators.
  test('includes satellite, split and IOTA fields', () => {
    const adif = generateAdif([
      baseContact({
        prop_mode: 'sat',
        sat_name: 'so-50',
        band_rx: '70cm',
        freq_rx: 435.795,
        iota: 'na-001',
      }),
    ]);

    expect(adif).toContain('<prop_mode:3>SAT');
    expect(adif).toContain('<sat_name:5>SO-50');
    expect(adif).toContain('<band_rx:4>70CM');
    expect(adif).toContain('<freq_rx:7>435.795');
    expect(adif).toContain('<iota:6>NA-001');
  });

  // Coordinates must export as standard ADIF LAT/LON in `XDDD MM.MMM` form so
  // other loggers and mapping tools can read them — not the old non-standard
  // decimal lat_n/lon_w fields no external software recognized.
  test('emits latitude/longitude as standard ADIF LAT/LON', () => {
    const adif = generateAdif([
      baseContact({ latitude: 40.44167, longitude: -73.96667 }),
    ]);

    expect(adif).toContain('<lat:11>N040 26.500');
    expect(adif).toContain('<lon:11>W073 58.000');
    // The legacy non-standard field names must be gone.
    expect(adif).not.toContain('lat_n');
    expect(adif).not.toContain('lon_w');
  });

  test('omits LAT/LON when a contact has no coordinates', () => {
    const adif = generateAdif([baseContact()]);
    expect(adif).not.toContain('<lat:');
    expect(adif).not.toContain('<lon:');
  });

  test('round-trips satellite/IOTA fields back through the parser', () => {
    const adif = generateAdif([
      baseContact({
        prop_mode: 'SAT',
        sat_name: 'RS-44',
        band_rx: '2M',
        freq_rx: 435.01,
        iota: 'EU-005',
      }),
    ]);

    const [record] = parseAdifRecords(adif);

    expect(record.fields.prop_mode).toBe('SAT');
    expect(record.fields.sat_name).toBe('RS-44');
    expect(record.fields.band_rx).toBe('2M');
    expect(record.fields.freq_rx).toBe('435.01');
    expect(record.fields.iota).toBe('EU-005');
  });
});
