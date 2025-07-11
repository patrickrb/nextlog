import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    let sqlQuery = `
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
      sqlQuery += ` AND (name ILIKE $1 OR prefix ILIKE $1)`;
      params.push(`%${search}%`);
    }

    sqlQuery += ` ORDER BY name`;

    const result = await query(sqlQuery, params);
    
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