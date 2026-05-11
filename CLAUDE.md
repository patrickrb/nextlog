# CLAUDE.md

Conventions and guidance for working in this repo. Keep this file short — it loads into every Claude session.

## Stack

- Next.js 16 (App Router), React 19, TypeScript 5.8
- PostgreSQL via raw `pg` (no ORM). Migrations are hand-written SQL in `/migrations/`.
- Playwright for e2e tests; ESLint 9 for linting; no Prettier.

## Naming convention: `snake_case` end-to-end

The database is `snake_case`. To eliminate boundary-translation bugs (the kind where a column rename silently breaks a route), we mirror that everywhere data crosses a wire:

- **DB columns**: `snake_case` (Postgres native)
- **TS model interfaces** (e.g. `ContactData`, `User`): properties match column names — `grid_locator`, not `gridLocator`
- **API JSON response fields**: `snake_case` — `{ grid_locator: ... }`
- **API request bodies**: `snake_case` keys

**Exempt from this rule:**

- React component-local form state (`formData.gridLocator`) — purely internal, never crosses the wire. The translation happens at the `fetch()` call site.
- Internal helper function parameters (e.g. `buildLoTWDownloadUrl({ dateFrom, dateTo })`) — not API surface, just JS function args.

**Known still-drifting surfaces** (cleanup candidates, not blockers):

- `GET /api/contacts/search` query params (`gridLocator`, `startDate`, `endDate`, `qslStatus`) still use camelCase. Defer to a follow-up sweep.

## Error response shape

Two acceptable patterns. Pick based on what consumers already expect.

**Default — `{ error: string }` with HTTP status:**

```ts
return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
```

HTTP status carries the error category (400 client error, 401 unauthorized, 403 forbidden, 404 not found, 500 server error). New internal routes should default to this shape.

**Discriminated union — `{ success, data, error }`:** used by `/api/awards/*` and the public-facing `/api/cloudlog/*`. Consumers check `data.success` to branch. The shape is part of the contract; don't change it without updating every consumer.

```ts
type AwardResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };
```

**Don't leak raw error messages.** A `catch` block that returns `error.message` to the client can expose DB constraint names, stack frames, and other internals. Log the real message with `console.error` and return a generic string:

```ts
catch (error) {
  console.error('DXCC summary error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
```

The `details:` field used by some install/cron routes (`{ error, details }`) is admin/diagnostic only and not consumed by the frontend — keep it scoped to flows where untrusted callers can't reach.

## Logging

- `no-console` is lint-enforced in `src/` (allows `warn`, `error` only). Use `console.error` in genuine error paths; everything else should go through `src/lib/logger.ts` (`logger.debug` / `logger.info` / `logger.warn` / `logger.error`).
- `scripts/` and `tests/` are exempt from the rule — CLI utilities and test diagnostics may use `console.log`.

## Type discipline

- **No `any`**. The codebase is currently clean of explicit `: any` — keep it that way. If you genuinely don't know a type, use `unknown` and narrow at the use site.
- Run `npm run typecheck` (alias for `tsc --noEmit`) before committing. It must pass.

## Code layout

- `src/app/` — Next.js App Router. Pages live here; API routes under `src/app/api/<route>/route.ts`.
- `src/models/` — DB access. API routes should call models, not `query()` directly, when a model method exists.
- `src/lib/` — utilities, integrations (QRZ, LoTW), auth, db pool, crypto.
- `src/components/` — React components. Radix-based UI primitives in `src/components/ui/`.
- `src/contexts/` — React Context (UserContext, ThemeContext).
- `src/types/` — shared TS types not tied to a single model.
- `/migrations/` — hand-written SQL migrations. Root-level `*.sql` files are install/seed schema.
- `/tests/` — Playwright specs.

## Scripts (run from repo root)

- `npm run dev` — Next dev server (Turbopack)
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — Playwright e2e

## Pre-commit checklist

1. `npm run lint` clean (warnings allowed for now, errors no)
2. `npm run typecheck` clean
3. `npm run build` succeeds
4. If you touched API request/response shapes, update both ends in the same PR.
