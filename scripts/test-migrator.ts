// Manual test for src/lib/migrator.ts. Not part of the regular test suite.
//
// Usage: npx tsx scripts/test-migrator.ts
//
// Spins up two temp DBs in the running Postgres container:
//   1. Existing-install path: apply the baseline migration directly (canonical
//      schema, no drizzle tracking) — same shape as a prod install set up by
//      the now-deleted install-database.sql. Expect: backfill seeds
//      __drizzle_migrations with the baseline, then 0001 applies.
//   2. Fresh-install path: empty DB. Expect: migrate() applies the baseline +
//      0001, __drizzle_migrations has both rows.

import { Pool } from 'pg';
import { execSync } from 'node:child_process';
import { runMigrations } from '../src/lib/migrator';

const PG_ADMIN_URL = 'postgresql://nextlog:password@localhost:5432/postgres';
const TEST_DB = 'nextlog_migrator_test';

async function recreateTestDb(): Promise<void> {
  const admin = new Pool({ connectionString: PG_ADMIN_URL });
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB}`);
    await admin.query(`CREATE DATABASE ${TEST_DB}`);
  } finally {
    await admin.end();
  }
}

function applyBaselineOnly(): void {
  // Apply the canonical baseline migration directly (without going through the
  // migrator). Result: canonical schema present, drizzle tracking table absent
  // — same shape as a pre-#196 prod install that was bootstrapped by the
  // legacy install-database.sql path.
  execSync(
    `cat drizzle/migrations/0000_baseline_canonical_schema.sql | docker exec -i nextlog-postgres psql -U nextlog -d ${TEST_DB}`,
    { stdio: 'pipe' }
  );
}

async function countTables(db: string): Promise<number> {
  const pool = new Pool({
    connectionString: `postgresql://nextlog:password@localhost:5432/${db}`,
  });
  try {
    const r = await pool.query(
      `SELECT COUNT(*)::int AS n FROM information_schema.tables
       WHERE table_schema = 'public'`
    );
    return r.rows[0].n as number;
  } finally {
    await pool.end();
  }
}

async function countMigrations(db: string): Promise<number> {
  const pool = new Pool({
    connectionString: `postgresql://nextlog:password@localhost:5432/${db}`,
  });
  try {
    const r = await pool.query(
      'SELECT COUNT(*)::int AS n FROM drizzle.__drizzle_migrations'
    );
    return r.rows[0].n as number;
  } finally {
    await pool.end();
  }
}

async function runScenario(label: string, prepare: () => void | Promise<void>) {
  console.log(`\n=== ${label} ===`);
  await recreateTestDb();
  await prepare();

  const before = await countTables(TEST_DB);
  console.log(`Tables before migrate: ${before}`);

  const pool = new Pool({
    connectionString: `postgresql://nextlog:password@localhost:5432/${TEST_DB}`,
  });
  let result;
  try {
    result = await runMigrations(pool);
  } finally {
    await pool.end();
  }

  const after = await countTables(TEST_DB);
  const migrations = await countMigrations(TEST_DB);
  console.log(`Tables after migrate: ${after}`);
  console.log(`__drizzle_migrations rows: ${migrations}`);
  console.log('Result:', result);
}

async function main() {
  await runScenario('Existing install (backfill)', async () => {
    applyBaselineOnly();
  });

  await runScenario('Fresh install (full apply)', async () => {
    // No-op: leave the DB empty
  });

  // Cleanup
  const admin = new Pool({ connectionString: PG_ADMIN_URL });
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB}`);
  } finally {
    await admin.end();
  }
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
