import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dxcc = searchParams.get('dxcc');

    if (!dxcc) {
      return NextResponse.json({ error: 'DXCC parameter is required' }, { status: 400 });
    }

    const sqlQuery = `
      SELECT id, code, name, type, cq_zone, itu_zone 
      FROM states_provinces 
      WHERE dxcc_entity = $1 
      ORDER BY name
    `;

    const result = await query(sqlQuery, [dxcc]);
    
    return NextResponse.json({ states: result.rows });
  } catch (error) {
    console.error('Error fetching states:', error);
    return NextResponse.json({ error: 'Failed to fetch states' }, { status: 500 });
  }
}