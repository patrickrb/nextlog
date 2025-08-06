import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '10');

    const userId = typeof user.userId === 'string' ? parseInt(user.userId, 10) : user.userId;

    let sql = `
      SELECT DISTINCT callsign, 
             MAX(name) as name,
             MAX(qth) as qth,
             COUNT(*) as contact_count,
             MAX(datetime) as last_contact
      FROM contacts 
      WHERE user_id = $1
    `;
    
    const queryParams: (string | number)[] = [userId];
    
    if (search.trim()) {
      sql += ` AND UPPER(callsign) LIKE UPPER($2)`;
      queryParams.push(`${search}%`);
    }
    
    sql += `
      GROUP BY callsign
      ORDER BY MAX(datetime) DESC
      LIMIT $${queryParams.length + 1}
    `;
    
    queryParams.push(limit);

    const result = await query(sql, queryParams);
    
    const callsigns = result.rows.map(row => ({
      value: row.callsign,
      label: row.callsign,
      secondary: row.name ? `${row.name}${row.qth ? ` - ${row.qth}` : ''}` : row.qth,
      contactCount: parseInt(row.contact_count),
      lastContact: row.last_contact
    }));

    return NextResponse.json({ callsigns });

  } catch (error) {
    console.error('Error fetching callsigns:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}