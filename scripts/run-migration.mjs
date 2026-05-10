// One-shot migration runner.
// Usage: DATABASE_URL=postgres://... node scripts/run-migration.mjs <sql-file>
//
// Wraps the file contents in a transaction so a partial-fail leaves the DB
// untouched. Idempotent migrations with IF NOT EXISTS / DO $$ BEGIN ... END$$
// guards are safe to re-run.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const sqlPath = process.argv[2];
const dbUrl = process.env.DATABASE_URL;

if (!sqlPath) {
  console.error('Usage: DATABASE_URL=... node scripts/run-migration.mjs <sql-file>');
  process.exit(2);
}
if (!dbUrl) {
  console.error('DATABASE_URL is required');
  process.exit(2);
}

let sql = readFileSync(resolve(sqlPath), 'utf8');

// Postgres 15/17 don't support `CREATE TRIGGER IF NOT EXISTS` (PG 18+ feature).
// Rewrite each occurrence as a DROP IF EXISTS + CREATE pair so the SQL works
// across versions without editing the source migration files.
sql = sql.replace(
  /CREATE TRIGGER IF NOT EXISTS\s+(\w+)\s+([\s\S]*?);/gi,
  (_match, triggerName, body) => {
    // Extract the table name from the trigger body (e.g., "BEFORE UPDATE ON foo").
    const tableMatch = body.match(/\bON\s+(\w+)/i);
    const table = tableMatch ? tableMatch[1] : '';
    return `DROP TRIGGER IF EXISTS ${triggerName} ON ${table};\nCREATE TRIGGER ${triggerName} ${body};`;
  }
);

// Azure Postgres requires SSL; localhost typically doesn't. Detect from URL.
const ssl = /azure\.com|sslmode=require/i.test(dbUrl) ? { rejectUnauthorized: false } : false;
const client = new pg.Client({ connectionString: dbUrl, ssl });

const target = dbUrl.replace(/:[^@:/]*@/, ':****@');
console.log(`Running ${sqlPath} against ${target}`);

try {
  await client.connect();
  await client.query('BEGIN');
  await client.query(sql);
  await client.query('COMMIT');
  console.log('Migration applied successfully.');
} catch (err) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error('Migration failed; rolled back.');
  console.error(err.message);
  process.exit(1);
} finally {
  await client.end();
}
