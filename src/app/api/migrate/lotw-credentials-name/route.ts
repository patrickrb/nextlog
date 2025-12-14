// Migration API: Add name column to lotw_credentials table
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST() {
  try {
    // Check if name column already exists
    const columnCheck = await query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'lotw_credentials'
      AND column_name = 'name'
    `);

    if (columnCheck.rows.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'Migration already applied - name column already exists'
      });
    }

    // Add name column (allow NULL initially for existing records)
    await query(`
      ALTER TABLE lotw_credentials
      ADD COLUMN name VARCHAR(255)
    `);

    // Update existing records with a default name
    await query(`
      UPDATE lotw_credentials
      SET name = 'Certificate ' || id
      WHERE name IS NULL
    `);

    // Make the column NOT NULL after populating existing records
    await query(`
      ALTER TABLE lotw_credentials
      ALTER COLUMN name SET NOT NULL
    `);

    return NextResponse.json({
      success: true,
      message: 'Successfully added name column to lotw_credentials table'
    });

  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Migration failed'
      },
      { status: 500 }
    );
  }
}
