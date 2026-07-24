// Allowlist + SET-clause builder for updating a contact (PUT /api/contacts/[id],
// via Contact.update).
//
// Kept free of server-only imports (no `pg`, no db pool) so it can be unit
// tested directly, like @/lib/contact-search. Contact.update feeds the result
// straight into `query(sql, values)`.
//
// Why an allowlist: Contact.update used to interpolate *every* key of the input
// object straight into the SQL as a column name (`SET ${key} = $n`), and the
// PUT route hands it the raw JSON request body with no filtering. Two problems
// followed from that:
//   1. Mass assignment — a caller could reassign one of their QSOs to another
//      operator by sending `{ "user_id": <someone-else> }` (only id/created_at/
//      updated_at were excluded), silently moving the contact out of their log.
//   2. SQL injection — the key is *concatenated*, never bound, so a crafted key
//      (e.g. `"user_id = 1, notes"`) becomes live SQL rather than a bad-column
//      error.
// Restricting writes to a fixed set of real, user-editable columns closes both:
// unknown/forbidden keys are dropped, and every emitted column name comes from
// this constant — never from caller input.

// Every editable column on the `contacts` table (see drizzle/schema.ts) EXCEPT
// the identity/ownership/bookkeeping ones — `id`, `user_id`, `created_at`,
// `updated_at` — which must never be reassigned through an edit.
export const UPDATABLE_CONTACT_COLUMNS = new Set<string>([
  'station_id', 'callsign', 'name', 'frequency', 'mode', 'band', 'datetime',
  'rst_sent', 'rst_received', 'qth', 'grid_locator', 'latitude', 'longitude',
  'country', 'dxcc', 'cont', 'cqz', 'ituz', 'state', 'cnty',
  'qsl_rcvd', 'qsl_sent', 'qsl_via', 'eqsl_qsl_rcvd', 'eqsl_qsl_sent',
  'lotw_qsl_rcvd', 'lotw_qsl_sent', 'qrz_qsl_sent', 'qrz_qsl_rcvd',
  'qrz_qsl_sent_date', 'qrz_qsl_rcvd_date', 'qso_date_off', 'time_off',
  'operator', 'distance', 'tx_pwr', 'notes', 'qsl_lotw', 'qsl_lotw_date',
  'lotw_match_status', 'prop_mode', 'sat_name', 'band_rx', 'freq_rx', 'iota',
  'lotw_qslrdate',
]);

export interface ContactUpdateAssignments {
  /** `col = $n` fragments, in insertion order. */
  fields: string[];
  /** Bound values, index N-1 corresponding to placeholder `$N`. */
  values: unknown[];
}

/**
 * Build the `col = $n, …` assignments and their bound values for a contact
 * update from a partial contact object. Only keys in
 * UPDATABLE_CONTACT_COLUMNS are emitted; unknown keys (including id/user_id/
 * created_at/updated_at and any crafted injection key) and `undefined` values
 * are skipped. Placeholders start at $1 and count only the fields actually
 * included, so they can never drift out of step with `values`. A `null` value
 * is kept — that's how the edit form clears a field.
 */
export function buildContactUpdate(
  contactData: Record<string, unknown>,
): ContactUpdateAssignments {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(contactData)) {
    if (value === undefined) continue;
    if (!UPDATABLE_CONTACT_COLUMNS.has(key)) continue;
    fields.push(`${key} = $${values.length + 1}`);
    values.push(value);
  }

  return { fields, values };
}
