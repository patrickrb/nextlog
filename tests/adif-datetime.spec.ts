import { test, expect } from '@playwright/test';
import { adifDateTimeToUtc } from '@/lib/adif';

// Pure-function tests for ADIF QSO_DATE + TIME_ON → UTC conversion. The ADIF
// Time type is HHMMSS *or* HHMM (seconds omitted). A 4-digit time must be read
// as HHMM:00 — appending "00" seconds — not as a right-aligned HHMMSS, which
// would silently shift the QSO to the wrong time of day (2359 → 00:23:59).

test.describe('adifDateTimeToUtc', () => {
  test('reads a full HHMMSS time', () => {
    const d = adifDateTimeToUtc('20231231', '235900');
    expect(d?.toISOString()).toBe('2023-12-31T23:59:00.000Z');
  });

  test('reads a 4-digit HHMM time as HH:MM:00', () => {
    const d = adifDateTimeToUtc('20231231', '2359');
    expect(d?.toISOString()).toBe('2023-12-31T23:59:00.000Z');
  });

  test('reads noon from a 4-digit time', () => {
    const d = adifDateTimeToUtc('20240101', '1200');
    expect(d?.toISOString()).toBe('2024-01-01T12:00:00.000Z');
  });

  test('reads midnight from a 4-digit time', () => {
    const d = adifDateTimeToUtc('20240101', '0000');
    expect(d?.toISOString()).toBe('2024-01-01T00:00:00.000Z');
  });

  test('returns null for an unparseable date', () => {
    expect(adifDateTimeToUtc('notadate', '1200')).toBeNull();
  });
});
