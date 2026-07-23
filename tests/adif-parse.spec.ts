import { test, expect } from '@playwright/test';
import { parseAdifRecords } from '@/lib/adif';

// Pure-function tests for the ADIF parser. These exercise parseAdifRecords()
// directly (no browser/DB needed) and guard the interop bug where fields
// carrying an optional data-type indicator were silently dropped on import.

test.describe('parseAdifRecords', () => {
  test('parses fields with an optional data-type indicator', () => {
    // WSJT-X / N1MM / Log4OM style: <QSO_DATE:8:D>, <TIME_ON:6:T>, <FREQ:8:N>
    const adif =
      '<call:4>W1AW<qso_date:8:D>20240115<time_on:6:T>123456' +
      '<mode:3>SSB<freq:8:N>14.07400<eor>';

    const [record] = parseAdifRecords(adif);

    expect(record.fields).toMatchObject({
      call: 'W1AW',
      qso_date: '20240115',
      time_on: '123456',
      mode: 'SSB',
      freq: '14.07400',
    });
  });

  test('still parses fields without a type indicator', () => {
    const adif = '<call:4>K1XX<qso_date:8>20231231<time_on:4>2359<eor>';

    const [record] = parseAdifRecords(adif);

    expect(record.fields).toMatchObject({
      call: 'K1XX',
      qso_date: '20231231',
      time_on: '2359',
    });
  });

  test('clips an over-long value to its declared length', () => {
    // Declared length 4 but 6 characters of data before <eor>.
    const adif = '<call:4>K1XXYZ<eor>';

    const [record] = parseAdifRecords(adif);

    expect(record.fields.call).toBe('K1XX');
  });

  test('strips the header and splits multiple records', () => {
    const adif =
      'Some header\n<programid:7>Nextlog<eoh>\n' +
      '<call:5>W1AW<qso_date:8:D>20240101<time_on:4:T>1200<eor>\n' +
      '<call:5>K5ZZ<qso_date:8:D>20240102<time_on:4:T>1300<eor>\n';

    const records = parseAdifRecords(adif);

    expect(records).toHaveLength(2);
    expect(records[0].fields.call).toBe('W1AW');
    expect(records[1].fields.call).toBe('K5ZZ');
    // The header's <programid> must not leak into the first QSO record.
    expect(records[0].fields.programid).toBeUndefined();
  });
});
