// Admin endpoint to apply pending Drizzle migrations.
//
// Safe to call repeatedly. The migrator backfills `drizzle.__drizzle_migrations`
// on first run for existing installs (so the baseline isn't reapplied against
// a populated schema), then applies any pending migrations.
//
// Not yet wired into the install UI — current install flow still uses
// /api/install/database + /api/install/migrate-schema. This endpoint is the
// foundation for switching that over in a follow-up PR.

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { requirePermission } from '@/lib/auth';
import { Permission } from '@/lib/permissions';
import { runMigrations } from '@/lib/migrator';

export const POST = requirePermission(Permission.SYSTEM_ADMIN)(
  async (_request: NextRequest) => {
    // Short-lived dedicated pool: the migrator needs to close its connections
    // when it finishes, and we don't want to disturb lib/db's shared long-lived
    // pool that other endpoints rely on.
    const migrationPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 1,
    });

    try {
      const result = await runMigrations(migrationPool);
      return NextResponse.json({ success: true, ...result });
    } catch (error) {
      console.error('Migration run error:', error);
      return NextResponse.json(
        { error: 'Migration failed', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    } finally {
      await migrationPool.end();
    }
  }
);
