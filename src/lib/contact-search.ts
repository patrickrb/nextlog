// WHERE-clause builder for the contact search (GET /api/contacts/search).
//
// Kept free of server-only imports (no `pg`, no db pool) so it can be unit
// tested directly, like @/lib/grid and @/lib/bands. The route feeds the result
// straight into `query(sql, params)`.
//
// Placeholders ($2, $3, …) are numbered off the length of the `params` array as
// each value is pushed, so they can never drift out of step with the values.
// The subtle bug this prevents: a predicate-only filter (`qslStatus` adds a QSL
// confirmation expression with no bound value) must not advance the placeholder
// counter — otherwise a later value-bound filter (`dxcc`) references a `$N`
// that has no matching parameter, 500-ing the COUNT query and mis-binding the
// paginated one.

export interface ContactSearchFilters {
  callsign?: string;
  name?: string;
  qth?: string;
  mode?: string;
  band?: string;
  gridLocator?: string;
  startDate?: string;
  endDate?: string;
  qslStatus?: string;
  dxcc?: string;
}

/**
 * SQL boolean expression that is true when a QSO has been confirmed by any QSL
 * source — LoTW (either the boolean sync flag or an ADIF-style 'Y'), QRZ, paper,
 * or eQSL. There is no `confirmed` column; this mirrors the canonical definition
 * in Contact.countConfirmedByUserId (the dashboard "QSL Confirmed" stat) so the
 * search filter and the stat card agree on what "confirmed" means.
 *
 * Each term is wrapped so the whole expression is a plain boolean that is never
 * NULL — that lets it be negated cleanly (`NOT ...`) for the "not confirmed"
 * filter without a NULL QSL column silently dropping an unconfirmed row.
 */
export const CONFIRMED_QSL_SQL =
  "(COALESCE(qsl_lotw, false) " +
  "OR COALESCE(lotw_qsl_rcvd, '') = 'Y' " +
  "OR COALESCE(qrz_qsl_rcvd, '') = 'Y' " +
  "OR COALESCE(qsl_rcvd, '') = 'Y' " +
  "OR COALESCE(eqsl_qsl_rcvd, '') = 'Y')";

export interface ContactSearchQuery {
  /** The full WHERE clause, always anchored on `user_id = $1`. */
  whereClause: string;
  /** Bound parameter values, index N-1 corresponding to placeholder `$N`. */
  params: (string | number)[];
}

/**
 * Build the parameterized WHERE clause + bound values for a contact search.
 * Blank, whitespace-only, and the `all` sentinel are treated as "no filter".
 */
export function buildContactSearchQuery(
  userId: number,
  filters: ContactSearchFilters,
): ContactSearchQuery {
  const conditions: string[] = ['user_id = $1'];
  const params: (string | number)[] = [userId];

  // Push a value and return its 1-based placeholder index, keeping the two in
  // lockstep no matter how many predicate-only filters precede it.
  const bind = (value: string | number): number => params.push(value);

  for (const [key, raw] of Object.entries(filters)) {
    const value = raw?.trim();
    if (!value || value === 'all') continue;

    switch (key) {
      case 'callsign':
        conditions.push(`UPPER(callsign) LIKE UPPER($${bind(`%${value}%`)})`);
        break;
      case 'name':
        conditions.push(`UPPER(name) LIKE UPPER($${bind(`%${value}%`)})`);
        break;
      case 'qth':
        conditions.push(`UPPER(qth) LIKE UPPER($${bind(`%${value}%`)})`);
        break;
      case 'mode':
        conditions.push(`UPPER(mode) = UPPER($${bind(value)})`);
        break;
      case 'band':
        conditions.push(`UPPER(band) = UPPER($${bind(value)})`);
        break;
      case 'gridLocator':
        conditions.push(`UPPER(grid_locator) LIKE UPPER($${bind(`%${value}%`)})`);
        break;
      case 'startDate':
        conditions.push(`DATE(datetime) >= $${bind(value)}`);
        break;
      case 'endDate':
        conditions.push(`DATE(datetime) <= $${bind(value)}`);
        break;
      case 'qslStatus':
        // Predicate-only: adds SQL but binds no value, so it must NOT call bind().
        // There is no `confirmed` column — expand to the real QSL-source check
        // (see CONFIRMED_QSL_SQL). The old `confirmed = true` 500'd every
        // QSL-status search with "column confirmed does not exist".
        if (value === 'confirmed') {
          conditions.push(CONFIRMED_QSL_SQL);
        } else if (value === 'not_confirmed') {
          conditions.push(`NOT ${CONFIRMED_QSL_SQL}`);
        }
        break;
      case 'dxcc': {
        const dxcc = parseInt(value, 10);
        if (!Number.isNaN(dxcc)) {
          conditions.push(`dxcc = $${bind(dxcc)}`);
        }
        break;
      }
    }
  }

  return { whereClause: conditions.join(' AND '), params };
}
