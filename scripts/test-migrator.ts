// Manual test for src/lib/migrator.ts. Not part of the regular test suite.
//
// Usage: npx tsx scripts/test-migrator.ts
//
// Spins up two temp DBs in the running Postgres container:
//   1. Existing-install path: pre-populate with install-database.sql, then run
//      the migrator. Expect: backfill seeds __drizzle_migrations with the
//      baseline, migrate() applies nothing.
//   2. Fresh-install path: empty DB. Expect: migrate() applies the baseline,
//      __drizzle_migrations has exactly one row.

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

function applyLegacyInstall(): void {
  // Copy install-database.sql into the test DB via docker exec, like the
  // current install endpoint does. Ignore the reference-data INSERT failure
  // (one of the DXCC entries has an unescaped apostrophe — schema is what we
  // need for the test).
  execSync(
    `cat install-database.sql | docker exec -i nextlog-postgres psql -U nextlog -d ${TEST_DB}`,
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
    applyLegacyInstall();
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
