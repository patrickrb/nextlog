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

API routes return:

```ts
{ error: string }
```

with an appropriate HTTP status (400 client error, 401 unauthorized, 403 forbidden, 404 not found, 500 server error). Some routes return richer shapes (`{ success: boolean, error?: string, ... }`) — that's fine where it's already established, but new routes should default to the simple shape.

## Logging

- `console.log` in `src/` is being phased out — don't add new ones. (Lint rule coming in a follow-up PR.)
- `console.error` is acceptable in genuine error paths until a real logger is introduced.

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
