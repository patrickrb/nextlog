import { test, expect } from '@playwright/test';
import {
  adifField,
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
});
