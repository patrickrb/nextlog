import { test, expect } from '@playwright/test';
import {
  buildContactUpdate,
  UPDATABLE_CONTACT_COLUMNS,
} from '@/lib/contact-update';

// Pure-function tests for the contact-update SET-clause builder. This is the
// shared assignment builder behind PUT /api/contacts/[id] (via Contact.update)
// — it turns a partial contact object into `col = $n` fragments plus their
// bound values. No DB needed.
//
// The regression these guard: Contact.update used to interpolate *every* key of
// the request body straight into the SQL as a column name (`SET ${key} = $n`),
// and the PUT route hands it the raw JSON body. So a caller could reassign a
// QSO to another operator by sending `user_id`, or inject SQL through a crafted
// key (the key was concatenated, never bound). The builder must therefore only
// ever emit column names drawn from a fixed allowlist.

test.describe('buildContactUpdate', () => {
  test('emits `col = $n` assignments in lockstep with their bound values', () => {
    const { fields, values } = buildContactUpdate({
      callsign: 'W1AW',
      mode: 'CW',
      frequency: 14.074,
    });
    expect(fields).toEqual([
      'callsign = $1',
      'mode = $2',
      'frequency = $3',
    ]);
    expect(values).toEqual(['W1AW', 'CW', 14.074]);
  });

  test('skips undefined values without advancing the placeholder counter', () => {
    const { fields, values } = buildContactUpdate({
      callsign: 'W1AW',
      name: undefined,
      band: '20M',
    });
    expect(fields).toEqual(['callsign = $1', 'band = $2']);
    expect(values).toEqual(['W1AW', '20M']);
  });

  test('includes null values so a field can be cleared on edit', () => {
    const { fields, values } = buildContactUpdate({ grid_locator: null });
    expect(fields).toEqual(['grid_locator = $1']);
    expect(values).toEqual([null]);
  });

  test('drops ownership/identity columns — no reassigning a QSO to another user', () => {
    const { fields, values } = buildContactUpdate({
      user_id: 999,
      id: 5,
      created_at: '2020-01-01',
      updated_at: '2020-01-01',
      callsign: 'W1AW',
    });
    // Only the legitimate edit survives; user_id/id/timestamps are dropped.
    expect(fields).toEqual(['callsign = $1']);
    expect(values).toEqual(['W1AW']);
  });

  test('drops unknown / crafted keys instead of interpolating them as SQL', () => {
    const { fields, values } = buildContactUpdate({
      // A key crafted to inject SQL through the old column-name concatenation.
      "user_id = 1, notes": 'pwned',
      'not_a_real_column': 'x',
      callsign: 'W1AW',
    });
    expect(fields).toEqual(['callsign = $1']);
    expect(values).toEqual(['W1AW']);
  });

  test('returns no assignments when nothing updatable is provided', () => {
    const { fields, values } = buildContactUpdate({
      user_id: 999,
      bogus: 'x',
    });
    expect(fields).toEqual([]);
    expect(values).toEqual([]);
  });

  test('placeholders count only included fields when forbidden keys are interleaved', () => {
    const { fields, values } = buildContactUpdate({
      callsign: 'W1AW',
      user_id: 999, // dropped — must not consume $2
      band: '20M',
    });
    expect(fields).toEqual(['callsign = $1', 'band = $2']);
    expect(values).toEqual(['W1AW', '20M']);
  });

  test('every editable contacts column is updatable, none of the identity ones', () => {
    // Sanity-check the allowlist against the columns a user legitimately edits.
    for (const col of ['callsign', 'mode', 'band', 'notes', 'tx_pwr', 'grid_locator', 'qsl_lotw']) {
      expect(UPDATABLE_CONTACT_COLUMNS.has(col)).toBe(true);
    }
    for (const col of ['id', 'user_id', 'created_at', 'updated_at']) {
      expect(UPDATABLE_CONTACT_COLUMNS.has(col)).toBe(false);
    }
  });
});
