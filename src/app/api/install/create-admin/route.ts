import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { name, email, password, callsign, gridLocator } = await request.json();
    
    // Validate required fields
    if (!name || !email || !password || !callsign) {
      return NextResponse.json(
        { error: 'Name, email, password, and callsign are required' },
        { status: 400 }
      );
    }
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create the admin user
      const userResult = await client.query(`
        INSERT INTO users (
          name, email, password, callsign, grid_locator, role, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, 'admin', 'active', NOW())
        RETURNING id, name, email, callsign, role
      `, [name, email, hashedPassword, callsign.toUpperCase(), gridLocator?.toUpperCase() || null]);
      
      const user = userResult.rows[0];
      
      // Create a default station for the admin user
      // First check what columns exist in the stations table
      const stationColumnsResult = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'stations' AND table_schema = 'public'
      `);
      const stationColumns = stationColumnsResult.rows.map(row => row.column_name);
      
      // Build the insert query based on available columns
      const hasOperatorName = stationColumns.includes('operator_name');
      const hasGridLocator = stationColumns.includes('grid_locator');
      
      if (hasOperatorName && hasGridLocator) {
        // Full schema with all columns
        await client.query(`
          INSERT INTO stations (
            user_id, callsign, station_name, operator_name, 
            grid_locator, is_active, is_default, created_at
          ) VALUES ($1, $2, $3, $4, $5, true, true, NOW())
        `, [
          user.id,
          callsign.toUpperCase(),
          `${callsign.toUpperCase()} Station`,
          name,
          gridLocator?.toUpperCase() || null
        ]);
      } else {
        // Fallback schema with minimal columns
        await client.query(`
          INSERT INTO stations (
            user_id, callsign, station_name, is_active, is_default, created_at
          ) VALUES ($1, $2, $3, true, true, NOW())
        `, [
          user.id,
          callsign.toUpperCase(),
          `${callsign.toUpperCase()} Station`
        ]);
      }
      
      await client.query('COMMIT');
      
      return NextResponse.json({ 
        success: true,
        message: 'Administrator account created successfully',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          callsign: user.callsign,
          role: user.role
        }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Admin user creation error:', error);
    
    // Handle duplicate email error
    if ((error as { code?: string; constraint?: string })?.code === '23505' && (error as { code?: string; constraint?: string })?.constraint === 'users_email_key') {
      return NextResponse.json(
        { error: 'An account with this email address already exists' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to create administrator account',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}