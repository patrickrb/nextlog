import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';

interface StatsData {
  qsosByYear: Array<{ year: number; count: number }>;
  qsosByMode: Array<{ mode: string; count: number }>;
  qsosByBand: Array<{ band: string; count: number }>;
  qsosByModeAndBand: Array<{ mode: string; band: string; count: number }>;
  availableYears: number[];
  totalQsos: number;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const stationId = searchParams.get('stationId');

    let whereClause = 'WHERE c.user_id = $1';
    const params: unknown[] = [parseInt(user.userId)];
    let paramCount = 1;

    // Add station filter if provided
    if (stationId && stationId !== 'all') {
      whereClause += ` AND c.station_id = $${++paramCount}`;
      params.push(parseInt(stationId));
    }

    // Add year filter if provided
    if (year && year !== 'all') {
      whereClause += ` AND EXTRACT(YEAR FROM c.datetime) = $${++paramCount}`;
      params.push(parseInt(year));
    }

    // Get available years
    const yearsQuery = `
      SELECT DISTINCT EXTRACT(YEAR FROM datetime) as year
      FROM contacts c
      WHERE c.user_id = $1 ${stationId && stationId !== 'all' ? 'AND c.station_id = $2' : ''}
      ORDER BY year DESC
    `;
    const yearsParams = stationId && stationId !== 'all' ? [parseInt(user.userId), parseInt(stationId)] : [parseInt(user.userId)];
    const yearsResult = await query(yearsQuery, yearsParams);
    const availableYears = yearsResult.rows.map(row => parseInt(row.year));

    // Get QSOs by year
    const qsosByYearQuery = `
      SELECT 
        EXTRACT(YEAR FROM c.datetime) as year,
        COUNT(*) as count
      FROM contacts c
      ${whereClause.replace('WHERE c.user_id = $1', 'WHERE c.user_id = $1')}
      GROUP BY EXTRACT(YEAR FROM c.datetime)
      ORDER BY year DESC
    `;
    const qsosByYearResult = await query(qsosByYearQuery, params);

    // Get QSOs by mode
    const qsosByModeQuery = `
      SELECT 
        COALESCE(c.mode, 'Unknown') as mode,
        COUNT(*) as count
      FROM contacts c
      ${whereClause}
      GROUP BY c.mode
      ORDER BY count DESC
    `;
    const qsosByModeResult = await query(qsosByModeQuery, params);

    // Get QSOs by band
    const qsosByBandQuery = `
      SELECT 
        COALESCE(c.band, 'Unknown') as band,
        COUNT(*) as count
      FROM contacts c
      ${whereClause}
      GROUP BY c.band
      ORDER BY 
        CASE 
          WHEN c.band ~ '^[0-9]+M$' THEN CAST(SUBSTRING(c.band FROM '^([0-9]+)') AS INTEGER)
          ELSE 999
        END ASC,
        c.band ASC
    `;
    const qsosByBandResult = await query(qsosByBandQuery, params);

    // Get QSOs by mode and band (for the matrix table)
    const qsosByModeAndBandQuery = `
      SELECT 
        COALESCE(c.mode, 'Unknown') as mode,
        COALESCE(c.band, 'Unknown') as band,
        COUNT(*) as count
      FROM contacts c
      ${whereClause}
      GROUP BY c.mode, c.band
      ORDER BY c.mode, c.band
    `;
    const qsosByModeAndBandResult = await query(qsosByModeAndBandQuery, params);

    // Get total QSOs
    const totalQsosQuery = `
      SELECT COUNT(*) as total
      FROM contacts c
      ${whereClause}
    `;
    const totalQsosResult = await query(totalQsosQuery, params);

    const statsData: StatsData = {
      qsosByYear: qsosByYearResult.rows.map(row => ({
        year: parseInt(row.year),
        count: parseInt(row.count)
      })),
      qsosByMode: qsosByModeResult.rows.map(row => ({
        mode: row.mode,
        count: parseInt(row.count)
      })),
      qsosByBand: qsosByBandResult.rows.map(row => ({
        band: row.band,
        count: parseInt(row.count)
      })),
      qsosByModeAndBand: qsosByModeAndBandResult.rows.map(row => ({
        mode: row.mode,
        band: row.band,
        count: parseInt(row.count)
      })),
      availableYears,
      totalQsos: parseInt(totalQsosResult.rows[0].total)
    };

    return NextResponse.json(statsData);

  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}