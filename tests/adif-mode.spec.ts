import { test, expect } from '@playwright/test';
import { resolveAdifMode, parseAdifRecords } from '@/lib/adif';

// Pure-function tests for the ADIF MODE/SUBMODE resolver. WSJT-X, JTDX and
// JS8Call log the "digital voice" of a QSO as an ADIF SUBMODE under a generic
// parent MODE (FT4 under MFSK, JS8 under MFSK, PSK31 under PSK). Storing only
// the parent MODE collapses every one of those into "MFSK"/"PSK", which the
// app's mode filter and mode statistics treat as distinct first-class modes —
// so an FT4 run imported from WSJT-X vanished from the FT4 filter. resolveAdifMode
// promotes the more-specific submode while keeping phone (SSB) intact.

test.describe('resolveAdifMode', () => {
  test('promotes a digital submode to the effective mode', () => {
    // WSJT-X FT4: <MODE:4>MFSK<SUBMODE:3>FT4
    expect(resolveAdifMode('MFSK', 'FT4')).toBe('FT4');
    // JS8Call: <MODE:4>MFSK<SUBMODE:3>JS8
    expect(resolveAdifMode('MFSK', 'JS8')).toBe('JS8');
    // WSJT-X FST4: <MODE:4>MFSK<SUBMODE:4>FST4
    expect(resolveAdifMode('MFSK', 'FST4')).toBe('FST4');
    // fldigi PSK31: <MODE:3>PSK<SUBMODE:5>PSK31
    expect(resolveAdifMode('PSK', 'PSK31')).toBe('PSK31');
  });

  test('keeps the parent MODE for voice (USB/LSB) submodes', () => {
    // SSB phone must stay SSB so it still matches the SSB filter and phone
    // stats — promoting USB/LSB would split every phone QSO out of SSB.
    expect(resolveAdifMode('SSB', 'USB')).toBe('SSB');
    expect(resolveAdifMode('SSB', 'LSB')).toBe('SSB');
    // Case- and whitespace-insensitive.
    expect(resolveAdifMode('SSB', ' lsb ')).toBe('SSB');
  });

  test('falls back to MODE when no submode is present', () => {
    expect(resolveAdifMode('FT8', undefined)).toBe('FT8');
    expect(resolveAdifMode('CW', '')).toBe('CW');
    expect(resolveAdifMode('RTTY', '   ')).toBe('RTTY');
  });

  test('normalizes to uppercase and trims surrounding whitespace', () => {
    expect(resolveAdifMode('mfsk', 'ft4')).toBe('FT4');
    expect(resolveAdifMode(' cw ', undefined)).toBe('CW');
  });

  test('defaults to SSB when neither mode nor submode is usable', () => {
    expect(resolveAdifMode(undefined, undefined)).toBe('SSB');
    expect(resolveAdifMode('', '')).toBe('SSB');
    expect(resolveAdifMode('   ', '  ')).toBe('SSB');
  });

  test('resolves the mode of a parsed WSJT-X FT4 record', () => {
    // A verbatim WSJT-X FT4 log line: the mode lives in SUBMODE, not MODE.
    const adif =
      '<call:4>W1AW<gridsquare:4>FN31<mode:4>MFSK<submode:3>FT4' +
      '<rst_sent:3>+03<rst_rcvd:3>-08<qso_date:8>20240115<time_on:6>123456<eor>';

    const [record] = parseAdifRecords(adif);

    expect(record.fields.mode).toBe('MFSK');
    expect(record.fields.submode).toBe('FT4');
    // The importer stores the promoted submode, so it lands in the FT4 filter.
    expect(resolveAdifMode(record.fields.mode, record.fields.submode)).toBe('FT4');
  });
});
