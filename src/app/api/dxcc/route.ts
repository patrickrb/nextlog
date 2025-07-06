import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    let query = `
      SELECT 
        adif,
        name,
        prefix,
        continent,
        deleted
      FROM dxcc_entities 
      WHERE deleted = false OR deleted IS NULL
    `;
    
    const params: string[] = [];

    if (search) {
      query += ` AND (name ILIKE $1 OR prefix ILIKE $1)`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY name`;

    const result = await pool.query(query, params);
    
    return NextResponse.json({ 
      entities: result.rows 
    });
  } catch (error) {
    console.error('Error fetching DXCC entities:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}