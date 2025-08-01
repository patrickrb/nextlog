import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST() {
  try {
    // Check if database connection is working
    const client = await pool.connect();
    
    // Check if any users exist - if they do, installation should not proceed
    const userCheck = await client.query('SELECT COUNT(*) as count FROM users WHERE 1=0 OR true');
    const userCount = parseInt(userCheck.rows[0]?.count || '0');
    
    if (userCount > 0) {
      client.release();
      return NextResponse.json(
        { error: 'Installation not allowed: Users already exist in the system' },
        { status: 400 }
      );
    }
    
    client.release();
    
    return NextResponse.json({ 
      success: true,
      message: 'System ready for installation'
    });
    
  } catch (error) {
    // If tables don't exist, that's expected for first install
    if ((error as { code?: string })?.code === '42P01') {
      return NextResponse.json({ 
        success: true,
        message: 'Fresh installation detected - ready to proceed'
      });
    }
    
    console.error('Installation validation error:', error);
    return NextResponse.json(
      { error: 'Database connection failed - please check your database configuration' },
      { status: 500 }
    );
  }
}