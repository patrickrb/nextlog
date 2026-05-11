// Manual verification for drizzle/migrations/0001_seed_reference_data.sql.
// Spins up two temp DBs in the running Postgres container, runs both the
// fresh-install path and the existing-install (backfill) path, and prints
// row counts + applied constraints. Not part of the regular test suite.
//
// Usage: npx tsx scripts/verify-seed.ts
import { Pool } from 'pg';
import { execSync } from 'node:child_process';
import { runMigrations } from '../src/lib/migrator';

const PG_ADMIN = 'postgresql://nextlog:password@localhost:5432/postgres';
const DB = 'seed_verify';

async function recreate(): Promise<void> {
  const admin = new Pool({ connectionString: PG_ADMIN });
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${DB}`);
    await admin.query(`CREATE DATABASE ${DB}`);
  } finally {
    await admin.end();
  }
}

async function report(label: string): Promise<void> {
  const pool = new Pool({
    connectionString: `postgresql://nextlog:password@localhost:5432/${DB}`,
  });
  try {
    const dxcc = await pool.query('SELECT COUNT(*)::int AS n FROM dxcc_entities');
    const sp = await pool.query('SELECT COUNT(*)::int AS n FROM states_provinces');
    const constraints = await pool.query(
      "SELECT conname FROM pg_constraint WHERE conname IN ('dxcc_entities_adif_key', 'states_provinces_dxcc_entity_code_key') ORDER BY conname"
    );
    console.log(`${label}:`);
    console.log('  dxcc_entities:', dxcc.rows[0].n);
    console.log('  states_provinces:', sp.rows[0].n);
    console.log('  constraints:', constraints.rows.map((r: { conname: string }) => r.conname).join(', '));
  } finally {
    await pool.end();
  }
}

async function migrate(): Promise<void> {
  const pool = new Pool({
    connectionString: `postgresql://nextlog:password@localhost:5432/${DB}`,
  });
  try {
    const r = await runMigrations(pool);
    console.log('  migrator:', r);
  } finally {
    await pool.end();
  }
}

async function main() {
  // Fresh install
  await recreate();
  console.log('\n=== Fresh install ===');
  await migrate();
  await report('After migrate');

  // Existing install (backfill): canonical schema present, no drizzle tracking.
  // Simulates a prod install that was bootstrapped by the now-deleted
  // install-database.sql before #196's migrator existed.
  await recreate();
  console.log('\n=== Existing install (baseline only, then migrator) ===');
  execSync(
    `cat drizzle/migrations/0000_baseline_canonical_schema.sql | docker exec -i nextlog-postgres psql -U nextlog -d ${DB}`,
    { stdio: 'pipe' }
  );
  await report('After baseline only');
  await migrate();
  await report('After migrator backfill');

  // Cleanup
  const cleanup = new Pool({ connectionString: PG_ADMIN });
  try {
    await cleanup.query(`DROP DATABASE IF EXISTS ${DB}`);
  } finally {
    await cleanup.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
