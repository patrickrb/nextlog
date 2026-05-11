// Runtime Drizzle migration runner.
//
// Handles two scenarios:
//
// 1. Fresh DB: `__drizzle_migrations` doesn't exist, no canonical tables
//    either. `migrate()` runs every migration including the baseline.
//
// 2. Existing install: canonical tables already exist (the install path ran
//    `install-database.sql` + `propagation-schema.sql` + the hand-rolled
//    migrate-schema endpoint). We seed `drizzle.__drizzle_migrations` with
//    the baseline marked as applied so `migrate()` doesn't try to recreate
//    schema that already exists. Future incremental migrations apply
//    normally.
//
// Detection heuristic: `public.users` exists.
//
// Drizzle's skip logic is timestamp-based (MAX(created_at) from the
// migrations table compared against each migration's `when` from the
// journal). We seed with the baseline's exact `when` value.

import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate as drizzleMigrate } from 'drizzle-orm/node-postgres/migrator';
import type { Pool } from 'pg';

const MIGRATIONS_FOLDER = path.join(process.cwd(), 'drizzle', 'migrations');

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface Journal {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

export interface MigrationRunResult {
  backfilled: boolean;
  migrationsAppliedCount: number;
  baselineTag: string;
}

function readJournal(): Journal {
  const journalPath = path.join(MIGRATIONS_FOLDER, 'meta', '_journal.json');
  return JSON.parse(fs.readFileSync(journalPath, 'utf-8'));
}

function hashMigrationFile(tag: string): string {
  const sqlPath = path.join(MIGRATIONS_FOLDER, `${tag}.sql`);
  const content = fs.readFileSync(sqlPath, 'utf-8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Apply pending migrations, backfilling the migration-tracking table for
 * pre-existing installs. Idempotent — safe to call multiple times.
 */
export async function runMigrations(pool: Pool): Promise<MigrationRunResult> {
  const db = drizzle(pool);
  const journal = readJournal();
  const baseline = journal.entries[0];
  if (!baseline) {
    throw new Error('No migrations found in journal');
  }

  // Detect existing-install state.
  const usersExists = await pool.query<{ exists: boolean }>(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'users'
    ) AS exists
  `);
  const drizzleTableExists = await pool.query<{ exists: boolean }>(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
    ) AS exists
  `);

  let backfilled = false;

  if (usersExists.rows[0]?.exists && !drizzleTableExists.rows[0]?.exists) {
    // Existing install with canonical schema but no Drizzle tracking.
    // Seed the tracking table so migrate() treats the baseline as applied.
    const baselineHash = hashMigrationFile(baseline.tag);

    await pool.query('CREATE SCHEMA IF NOT EXISTS drizzle');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL,
        created_at BIGINT
      )
    `);
    // Only seed if the baseline row isn't already there (defensive: handles
    // concurrent first-runs without a unique constraint to lean on).
    await pool.query(
      `INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
       SELECT $1, $2
       WHERE NOT EXISTS (
         SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = $2
       )`,
      [baselineHash, baseline.when]
    );
    backfilled = true;
  }

  // Count applied migrations before, so we can report how many migrate() applied.
  const beforeCount = await pool.query<{ count: string }>(`
    SELECT COUNT(*)::text AS count
    FROM information_schema.tables
    WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
  `);
  let beforeApplied = 0;
  if (parseInt(beforeCount.rows[0]?.count ?? '0', 10) > 0) {
    const r = await pool.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM drizzle.__drizzle_migrations'
    );
    beforeApplied = parseInt(r.rows[0]?.count ?? '0', 10);
  }

  await drizzleMigrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  const afterResult = await pool.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM drizzle.__drizzle_migrations'
  );
  const afterApplied = parseInt(afterResult.rows[0]?.count ?? '0', 10);

  return {
    backfilled,
    migrationsAppliedCount: afterApplied - beforeApplied,
    baselineTag: baseline.tag,
  };
}
