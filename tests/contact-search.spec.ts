import { test, expect } from '@playwright/test';
import { buildContactSearchQuery, CONFIRMED_QSL_SQL, SENT_QSL_SQL } from '@/lib/contact-search';

// Pure-function tests for the contact-search WHERE-clause builder. This is the
// shared query builder behind GET /api/contacts/search — it turns the filter
// set into a parameterized WHERE clause plus its bound values. No DB needed.
//
// The regression these guard: placeholders ($2, $3, …) must stay in lockstep
// with the params array. A filter like `qslStatus` adds a SQL predicate but no
// bound value; the previous code advanced a shared counter for *every* filter,
// so any predicate-only filter shifted the numbering of every later filter —
// combining "confirmed" with a DXCC entity produced a `$N` with no matching
// value (500 on the COUNT query) or a dxcc compared against the LIMIT value.

test.describe('buildContactSearchQuery', () => {
  test('always begins with the mandatory user_id predicate', () => {
    const { whereClause, params } = buildContactSearchQuery(7, {});
    expect(whereClause).toBe('user_id = $1');
    expect(params).toEqual([7]);
  });

  test('LIKE filters use case-insensitive contains matching', () => {
    const { whereClause, params } = buildContactSearchQuery(1, { callsign: 'w1aw' });
    expect(whereClause).toBe('user_id = $1 AND UPPER(callsign) LIKE UPPER($2)');
    expect(params).toEqual([1, '%w1aw%']);
  });

  test('mode and band match exactly (case-insensitive)', () => {
    const { whereClause, params } = buildContactSearchQuery(1, { mode: 'ft8', band: '20m' });
    expect(whereClause).toBe(
      'user_id = $1 AND UPPER(mode) = UPPER($2) AND UPPER(band) = UPPER($3)'
    );
    expect(params).toEqual([1, 'ft8', '20m']);
  });

  test('date range filters compare on the calendar date', () => {
    const { whereClause, params } = buildContactSearchQuery(1, {
      startDate: '2024-01-01',
      endDate: '2024-12-31',
    });
    expect(whereClause).toBe(
      'user_id = $1 AND DATE(datetime) >= $2 AND DATE(datetime) <= $3'
    );
    expect(params).toEqual([1, '2024-01-01', '2024-12-31']);
  });

  test('dxcc is bound as an integer', () => {
    const { whereClause, params } = buildContactSearchQuery(1, { dxcc: '291' });
    expect(whereClause).toBe('user_id = $1 AND dxcc = $2');
    expect(params).toEqual([1, 291]);
  });

  // There is no `confirmed` column — a QSO is "confirmed" when any QSL source
  // (LoTW, QRZ, paper, eQSL) confirms it, mirroring Contact.countConfirmedByUserId.
  // The filter emits that real expression rather than a nonexistent column, and
  // the "not confirmed" case negates it (NULL-safe, so unconfirmed rows with NULL
  // QSL fields still match).
  test('qsl status adds a predicate but no bound parameter', () => {
    const confirmed = buildContactSearchQuery(1, { qslStatus: 'confirmed' });
    expect(confirmed.whereClause).toBe(`user_id = $1 AND ${CONFIRMED_QSL_SQL}`);
    expect(confirmed.params).toEqual([1]);

    const notConfirmed = buildContactSearchQuery(1, { qslStatus: 'not_confirmed' });
    expect(notConfirmed.whereClause).toBe(`user_id = $1 AND NOT ${CONFIRMED_QSL_SQL}`);
    expect(notConfirmed.params).toEqual([1]);
  });

  // "Pending" is offered in the search UI's QSL-status dropdown. It must mean a
  // QSO where a QSL was sent/requested on at least one channel but no source has
  // confirmed it yet — i.e. awaiting a reply. The predicate is the sent-side
  // expression AND-ed with the negated confirmed expression; still no bound value.
  // Regression: 'pending' used to fall through the switch and contribute nothing,
  // so the UI filter silently returned every contact.
  test('qsl status "pending" filters sent-but-not-confirmed QSOs, with no bound parameter', () => {
    const pending = buildContactSearchQuery(1, { qslStatus: 'pending' });
    expect(pending.whereClause).toBe(
      `user_id = $1 AND (${SENT_QSL_SQL} AND NOT ${CONFIRMED_QSL_SQL})`
    );
    expect(pending.params).toEqual([1]);
  });

  // The sent expression must reference only real "sent" columns (Y/R/Q states),
  // never a received column or a bare `confirmed`.
  test('the sent predicate references the real qsl-sent columns', () => {
    expect(SENT_QSL_SQL).not.toMatch(/\bconfirmed\b/);
    for (const col of ['qsl_sent', 'eqsl_qsl_sent', 'lotw_qsl_sent', 'qrz_qsl_sent']) {
      expect(SENT_QSL_SQL).toContain(col);
    }
  });

  // The confirmed expression must reference only real columns and never a bare
  // `confirmed` (the column that never existed and 500'd every QSL-status search).
  test('the confirmed predicate references real columns, not a `confirmed` column', () => {
    expect(CONFIRMED_QSL_SQL).not.toMatch(/\bconfirmed\b/);
    for (const col of [
      'qsl_lotw',
      'lotw_qsl_rcvd',
      'qrz_qsl_rcvd',
      'qsl_rcvd',
      'eqsl_qsl_rcvd',
    ]) {
      expect(CONFIRMED_QSL_SQL).toContain(col);
    }
  });

  test('an unrecognized qsl status contributes nothing', () => {
    const { whereClause, params } = buildContactSearchQuery(1, { qslStatus: 'bogus' });
    expect(whereClause).toBe('user_id = $1');
    expect(params).toEqual([1]);
  });

  // The core regression: a predicate-only filter (qslStatus) sitting *before*
  // a value-bound filter (dxcc) must not shift dxcc's placeholder off its value.
  test('qsl status combined with dxcc keeps placeholders aligned with params', () => {
    const { whereClause, params } = buildContactSearchQuery(1, {
      qslStatus: 'confirmed',
      dxcc: '291',
    });
    expect(whereClause).toBe(`user_id = $1 AND ${CONFIRMED_QSL_SQL} AND dxcc = $2`);
    expect(params).toEqual([1, 291]);

    // Every `$N` referenced in the clause must have a corresponding param.
    const referenced = [...whereClause.matchAll(/\$(\d+)/g)].map(m => Number(m[1]));
    expect(Math.max(...referenced)).toBe(params.length);
  });

  test('blank, whitespace, and "all" sentinel values are ignored', () => {
    const { whereClause, params } = buildContactSearchQuery(1, {
      callsign: '',
      name: '   ',
      mode: 'all',
      band: '40m',
    });
    expect(whereClause).toBe('user_id = $1 AND UPPER(band) = UPPER($2)');
    expect(params).toEqual([1, '40m']);
  });

  test('a full filter set numbers every bound placeholder sequentially', () => {
    const { whereClause, params } = buildContactSearchQuery(42, {
      callsign: 'dl',
      name: 'hans',
      qth: 'berlin',
      mode: 'cw',
      band: '15m',
      gridLocator: 'jo',
      startDate: '2024-06-01',
      endDate: '2024-06-30',
      qslStatus: 'confirmed',
      dxcc: '230',
    });

    // 10 filters supplied, but qslStatus binds no value → 9 bound params + userId.
    expect(params).toEqual([
      42, '%dl%', '%hans%', '%berlin%', 'cw', '15m', '%jo%',
      '2024-06-01', '2024-06-30', 230,
    ]);

    const referenced = [...whereClause.matchAll(/\$(\d+)/g)].map(m => Number(m[1]));
    // Placeholders must be exactly $1..$params.length with no gaps or overshoot.
    expect(referenced).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(Math.max(...referenced)).toBe(params.length);
  });
});
