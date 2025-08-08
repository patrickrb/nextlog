import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const client = await pool.connect();
    
    try {
      // Check if users table exists and has any users
      const userCheck = await client.query('SELECT COUNT(*) as count FROM users');
      const userCount = parseInt(userCheck.rows[0].count);
      
      // Check if we have admin users specifically
      const adminCheck = await client.query('SELECT COUNT(*) as count FROM users WHERE role = $1', ['admin']);
      const adminCount = parseInt(adminCheck.rows[0].count);
      
      // Check if we have essential reference data
      const dxccCheck = await client.query('SELECT COUNT(*) as count FROM dxcc_entities');
      const dxccCount = parseInt(dxccCheck.rows[0].count);
      
      // Check if core tables exist
      const coreTablesCheck = await client.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('users', 'stations', 'contacts', 'dxcc_entities', 'states_provinces')
      `);
      const coreTableCount = parseInt(coreTablesCheck.rows[0].count);
      
      const isInstalled = userCount > 0 && adminCount > 0 && dxccCount > 100 && coreTableCount >= 5;
      
      return NextResponse.json({ 
        isInstalled,
        stats: {
          users: userCount,
          adminUsers: adminCount,
          dxccEntities: dxccCount,
          coreTablesFound: coreTableCount
        }
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    // If tables don't exist, installation is needed
    if ((error as { code?: string })?.code === '42P01') {
      return NextResponse.json({ 
        isInstalled: false,
        requiresInstallation: true
      });
    }
    
    // If database connection fails, installation is needed
    if ((error as { code?: string })?.code === 'ECONNREFUSED' || 
        (error as { code?: string })?.code === 'ENOTFOUND' ||
        (error as Error).message?.includes('database') ||
        (error as Error).message?.includes('connection')) {
      return NextResponse.json({ 
        isInstalled: false,
        requiresInstallation: true,
        reason: 'Database connection failed'
      });
    }
    
    console.error('Installation check error:', error);
    return NextResponse.json(
      { error: 'Failed to check installation status' },
      { status: 500 }
    );
  }
}