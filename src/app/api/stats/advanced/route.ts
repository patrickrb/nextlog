import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const stationId = searchParams.get('stationId');
    const type = searchParams.get('type') || 'activity'; // activity, geographic, comparative

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

    let analyticsData = {};

    switch (type) {
      case 'activity':
        analyticsData = await getActivityAnalytics(whereClause, params);
        break;
      case 'geographic':
        analyticsData = await getGeographicAnalytics(whereClause, params);
        break;
      case 'comparative':
        analyticsData = await getComparativeAnalytics(whereClause, params);
        break;
      case 'heatmap':
        analyticsData = await getHeatmapAnalytics(whereClause, params);
        break;
      default:
        analyticsData = await getActivityAnalytics(whereClause, params);
    }

    return NextResponse.json(analyticsData);

  } catch (error) {
    console.error('Advanced stats API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch advanced statistics' },
      { status: 500 }
    );
  }
}

async function getActivityAnalytics(whereClause: string, params: unknown[]) {
  // Monthly activity trend
  const monthlyActivityQuery = `
    SELECT 
      DATE_TRUNC('month', c.datetime) as month,
      COUNT(*) as qsos
    FROM contacts c
    ${whereClause}
    GROUP BY DATE_TRUNC('month', c.datetime)
    ORDER BY month DESC
    LIMIT 24
  `;
  const monthlyActivity = await query(monthlyActivityQuery, params);

  // Daily activity for current year
  const dailyActivityQuery = `
    SELECT 
      DATE(c.datetime) as date,
      COUNT(*) as qsos
    FROM contacts c
    ${whereClause} AND EXTRACT(YEAR FROM c.datetime) = EXTRACT(YEAR FROM CURRENT_DATE)
    GROUP BY DATE(c.datetime)
    ORDER BY date DESC
    LIMIT 365
  `;
  const dailyActivity = await query(dailyActivityQuery, params);

  // QSO rates
  const qsoRatesQuery = `
    SELECT 
      COUNT(*) as total_qsos,
      COUNT(DISTINCT DATE(c.datetime)) as active_days,
      ROUND(COUNT(*) / NULLIF(COUNT(DISTINCT DATE(c.datetime)), 0), 2) as qsos_per_day,
      ROUND(COUNT(*) / NULLIF(COUNT(DISTINCT DATE_TRUNC('month', c.datetime)), 0), 2) as qsos_per_month
    FROM contacts c
    ${whereClause}
  `;
  const qsoRates = await query(qsoRatesQuery, params);

  // Unique callsigns
  const uniqueCallsignsQuery = `
    SELECT 
      COUNT(DISTINCT c.callsign) as unique_callsigns,
      COUNT(*) as total_qsos,
      ROUND(COUNT(*) / NULLIF(COUNT(DISTINCT c.callsign), 0), 2) as qsos_per_callsign
    FROM contacts c
    ${whereClause}
  `;
  const uniqueCallsigns = await query(uniqueCallsignsQuery, params);

  return {
    monthlyActivity: monthlyActivity.rows.map(row => ({
      date: row.month,
      qsos: parseInt(row.qsos)
    })),
    dailyActivity: dailyActivity.rows.map(row => ({
      date: row.date,
      qsos: parseInt(row.qsos)
    })),
    qsoRates: qsoRates.rows[0],
    uniqueCallsigns: uniqueCallsigns.rows[0]
  };
}

async function getGeographicAnalytics(whereClause: string, params: unknown[]) {
  // Country distribution
  const countryDistributionQuery = `
    SELECT 
      de.name as country,
      de.continent,
      COUNT(*) as qsos
    FROM contacts c
    LEFT JOIN dxcc_entities de ON c.dxcc_entity_id = de.id
    ${whereClause}
    GROUP BY de.name, de.continent
    ORDER BY qsos DESC
  `;
  const countryDistribution = await query(countryDistributionQuery, params);

  // Continent distribution
  const continentDistributionQuery = `
    SELECT 
      COALESCE(de.continent, 'Unknown') as continent,
      COUNT(*) as qsos
    FROM contacts c
    LEFT JOIN dxcc_entities de ON c.dxcc_entity_id = de.id
    ${whereClause}
    GROUP BY de.continent
    ORDER BY qsos DESC
  `;
  const continentDistribution = await query(continentDistributionQuery, params);

  // Grid square activity
  const gridActivityQuery = `
    SELECT 
      SUBSTRING(c.grid_locator FROM 1 FOR 4) as grid_square,
      COUNT(*) as qsos
    FROM contacts c
    ${whereClause} AND c.grid_locator IS NOT NULL AND LENGTH(c.grid_locator) >= 4
    GROUP BY SUBSTRING(c.grid_locator FROM 1 FOR 4)
    ORDER BY qsos DESC
    LIMIT 50
  `;
  const gridActivity = await query(gridActivityQuery, params);

  return {
    countryDistribution: countryDistribution.rows.map(row => ({
      country: row.country || 'Unknown',
      continent: row.continent || 'Unknown',
      qsos: parseInt(row.qsos)
    })),
    continentDistribution: continentDistribution.rows.map(row => ({
      continent: row.continent,
      qsos: parseInt(row.qsos)
    })),
    gridActivity: gridActivity.rows.map(row => ({
      gridSquare: row.grid_square,
      qsos: parseInt(row.qsos)
    }))
  };
}

async function getComparativeAnalytics(whereClause: string, params: unknown[]) {
  // Year-over-year comparison
  const yearOverYearQuery = `
    SELECT 
      EXTRACT(YEAR FROM c.datetime) as year,
      EXTRACT(MONTH FROM c.datetime) as month,
      COUNT(*) as qsos
    FROM contacts c
    ${whereClause}
    GROUP BY EXTRACT(YEAR FROM c.datetime), EXTRACT(MONTH FROM c.datetime)
    ORDER BY year DESC, month
  `;
  const yearOverYear = await query(yearOverYearQuery, params);

  // Mode trends over time
  const modeTrendsQuery = `
    SELECT 
      EXTRACT(YEAR FROM c.datetime) as year,
      c.mode,
      COUNT(*) as qsos
    FROM contacts c
    ${whereClause}
    GROUP BY EXTRACT(YEAR FROM c.datetime), c.mode
    ORDER BY year DESC, qsos DESC
  `;
  const modeTrends = await query(modeTrendsQuery, params);

  return {
    yearOverYear: yearOverYear.rows.map(row => ({
      year: parseInt(row.year),
      month: parseInt(row.month),
      qsos: parseInt(row.qsos)
    })),
    modeTrends: modeTrends.rows.map(row => ({
      year: parseInt(row.year),
      mode: row.mode,
      qsos: parseInt(row.qsos)
    }))
  };
}

async function getHeatmapAnalytics(whereClause: string, params: unknown[]) {
  // Activity heatmap by hour and day of week
  const heatmapQuery = `
    SELECT 
      EXTRACT(HOUR FROM c.datetime) as hour,
      EXTRACT(DOW FROM c.datetime) as day_of_week,
      COUNT(*) as qsos
    FROM contacts c
    ${whereClause}
    GROUP BY EXTRACT(HOUR FROM c.datetime), EXTRACT(DOW FROM c.datetime)
    ORDER BY day_of_week, hour
  `;
  const heatmapData = await query(heatmapQuery, params);

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return {
    heatmapData: heatmapData.rows.map(row => ({
      hour: parseInt(row.hour),
      day: parseInt(row.day_of_week),
      dayName: dayNames[parseInt(row.day_of_week)],
      qsos: parseInt(row.qsos)
    }))
  };
}