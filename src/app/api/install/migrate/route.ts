// Install-time migration endpoint. Calls the same runner as
// `/api/admin/migrate` but is gated on "no users yet exist" instead of
// admin auth — during a fresh install there's no admin to authenticate as.
//
// Once an admin has been created (via /api/install/create-admin or the normal
// signup flow), this endpoint refuses further runs and the admin endpoint
// becomes the only way to apply pending migrations.

import { NextResponse } from 'next/server';
import { Pool } from 'pg';

import { query } from '@/lib/db';
import { runMigrations } from '@/lib/migrator';

export async function POST() {
  // Pre-flight: refuse if any user already exists. The long-lived shared pool
  // is fine for this short read.
  try {
    const usersExists = await query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users'
      ) AS exists
    `);

    if (usersExists.rows[0]?.exists) {
      const userCount = await query('SELECT COUNT(*)::text AS count FROM users');
      if (parseInt(userCount.rows[0]?.count ?? '0', 10) > 0) {
        return NextResponse.json(
          {
            error:
              'Installation already complete. Use /api/admin/migrate as an authenticated admin to run further migrations.',
          },
          { status: 400 }
        );
      }
    }
  } catch (error) {
    console.error('Install migrate pre-flight error:', error);
    return NextResponse.json(
      {
        error: 'Failed to verify installation state',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }

  // Dedicated short-lived pool for the migration run — the migrator needs to
  // close its connections when it finishes, and we don't want to disturb the
  // shared long-lived pool that other endpoints rely on.
  const migrationPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 1,
  });

  try {
    const result = await runMigrations(migrationPool);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Install migrate run error:', error);
    return NextResponse.json(
      {
        error: 'Failed to apply migrations',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  } finally {
    await migrationPool.end();
  }
}
