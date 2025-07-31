// DXCC Summary API endpoint
// Provides comprehensive DXCC statistics and overview

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { DXCCSummary, DXCCSummaryResponse, DXCCProgress, DXCC_BANDS, DXCCEntityProgress, DXCCAwardType } from '@/types/awards';

export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const stationId = searchParams.get('station_id');

    const summary = await calculateDXCCSummary({
      userId: parseInt(user.userId),
      stationId: stationId ? parseInt(stationId) : undefined
    });

    const response: DXCCSummaryResponse = {
      success: true,
      data: summary
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('DXCC summary error:', error);
    const response: DXCCSummaryResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    };
    return NextResponse.json(response, { status: 500 });
  }
}

interface DXCCSummaryParams {
  userId: number;
  stationId?: number;
}

async function calculateDXCCSummary(params: DXCCSummaryParams): Promise<DXCCSummary> {
  const { userId, stationId } = params;

  // Calculate overall DXCC progress (basic mixed mode)
  const overallProgress = await calculateBasicDXCCProgress(userId, stationId);

  // Calculate band-specific progress
  const bandProgress: Record<string, DXCCProgress> = {};
  for (const band of DXCC_BANDS) {
    bandProgress[band] = await calculateBandDXCCProgress(userId, stationId, band);
  }

  // Calculate mode-specific progress
  const modeProgress: Record<string, DXCCProgress> = {};
  const modes = ['Phone', 'CW', 'Digital', 'RTTY'];
  for (const mode of modes) {
    modeProgress[mode] = await calculateModeDXCCProgress(userId, stationId, mode.toLowerCase() as 'phone' | 'cw' | 'digital' | 'rtty');
  }

  // Get recent confirmations
  const recentConfirmations = await getRecentDXCCConfirmations(userId, stationId);

  // Calculate needed entities
  const neededEntities = await calculateNeededEntities(userId, stationId);

  // Get statistics
  const statistics = await getDXCCStatistics(userId, stationId);

  const summary: DXCCSummary = {
    overall_progress: overallProgress,
    band_progress: bandProgress,
    mode_progress: modeProgress,
    recent_confirmations: recentConfirmations,
    needed_entities: neededEntities,
    statistics
  };

  return summary;
}

async function calculateBasicDXCCProgress(userId: number, stationId?: number): Promise<DXCCProgress> {
  // Get all DXCC entities
  const entitiesResult = await query(`
    SELECT de.id, de.adif, de.name, de.prefix, de.continent, de.cq_zone, de.itu_zone, de.longitude, de.latitude
    FROM dxcc_entities de
    WHERE de.deleted = false OR de.deleted IS NULL
    ORDER BY de.name
  `);

  // Get worked entities for this user/station
  let contactQuery = `
    SELECT DISTINCT c.dxcc,
           MAX(c.datetime) as last_worked,
           MAX(CASE WHEN c.lotw_qsl_rcvd = 'Y' AND c.lotw_qsl_sent = 'Y' THEN c.datetime END) as last_confirmed,
           COUNT(*) as contact_count,
           BOOL_OR(c.lotw_qsl_rcvd = 'Y' AND c.lotw_qsl_sent = 'Y') as has_qsl
    FROM contacts c
    WHERE c.user_id = $1
      AND c.dxcc IS NOT NULL
  `;

  const queryParams: (string | number)[] = [userId];
  if (stationId) {
    contactQuery += ' AND c.station_id = $2';
    queryParams.push(stationId);
  }

  contactQuery += ' GROUP BY c.dxcc';

  const workedEntitiesResult = await query(contactQuery, queryParams);
  const workedEntitiesMap = new Map(
    workedEntitiesResult.rows.map(row => [row.dxcc, row])
  );

  const entities = entitiesResult.rows.map(entity => {
    const worked = workedEntitiesMap.get(entity.adif);
    return {
      entity_id: entity.id,
      adif: entity.adif,
      entity_name: entity.name,
      prefix: entity.prefix,
      continent: entity.continent && entity.continent.trim() ? entity.continent : 'Unknown',
      cq_zone: entity.cq_zone,
      itu_zone: entity.itu_zone,
      status: !worked ? 'needed' : (worked.has_qsl ? 'confirmed' : 'worked'),
      contact_count: worked?.contact_count || 0,
      last_worked_date: worked?.last_worked || undefined,
      last_confirmed_date: worked?.last_confirmed || undefined,
      qsl_received: worked?.has_qsl || false,
      longitude: entity.longitude,
      latitude: entity.latitude
    } as DXCCEntityProgress;
  });

  // Calculate by continent stats
  const byContinentStats: Record<string, { worked: number; confirmed: number; total: number }> = {};
  entities.forEach(entity => {
    const continent = entity.continent && entity.continent.trim() ? entity.continent : 'Unknown';
    if (!byContinentStats[continent]) {
      byContinentStats[continent] = { worked: 0, confirmed: 0, total: 0 };
    }
    byContinentStats[continent].total++;
    if (entity.status !== 'needed') {
      byContinentStats[continent].worked++;
    }
    if (entity.status === 'confirmed') {
      byContinentStats[continent].confirmed++;
    }
  });

  const totalEntities = entities.length;
  const workedEntities = entities.filter(e => e.status !== 'needed').length;
  const confirmedEntities = entities.filter(e => e.status === 'confirmed').length;

  return {
    award_type: 'basic',
    total_entities: totalEntities,
    worked_entities: workedEntities,
    confirmed_entities: confirmedEntities,
    needed_entities: totalEntities - workedEntities,
    progress_percentage: Math.round((workedEntities / totalEntities) * 100),
    confirmed_percentage: Math.round((confirmedEntities / totalEntities) * 100),
    entities,
    by_continent: byContinentStats,
    last_updated: new Date().toISOString()
  };
}

async function calculateBandDXCCProgress(userId: number, stationId: number | undefined, band: string): Promise<DXCCProgress> {
  // Similar to basic but with band filter
  const entitiesResult = await query(`
    SELECT de.id, de.adif, de.name, de.prefix, de.continent, de.cq_zone, de.itu_zone, de.longitude, de.latitude
    FROM dxcc_entities de
    WHERE de.deleted = false OR de.deleted IS NULL
    ORDER BY de.name
  `);

  let contactQuery = `
    SELECT DISTINCT c.dxcc,
           MAX(c.datetime) as last_worked,
           MAX(CASE WHEN c.lotw_qsl_rcvd = 'Y' AND c.lotw_qsl_sent = 'Y' THEN c.datetime END) as last_confirmed,
           COUNT(*) as contact_count,
           BOOL_OR(c.lotw_qsl_rcvd = 'Y' AND c.lotw_qsl_sent = 'Y') as has_qsl
    FROM contacts c
    WHERE c.user_id = $1
      AND c.dxcc IS NOT NULL
      AND UPPER(c.band) = $2
  `;

  const queryParams: (string | number)[] = [userId, band.toUpperCase()];
  if (stationId) {
    contactQuery += ' AND c.station_id = $3';
    queryParams.push(stationId);
  }

  contactQuery += ' GROUP BY c.dxcc';

  const workedEntitiesResult = await query(contactQuery, queryParams);
  const workedEntitiesMap = new Map(
    workedEntitiesResult.rows.map(row => [row.dxcc, row])
  );

  const entities = entitiesResult.rows.map(entity => {
    const worked = workedEntitiesMap.get(entity.adif);
    return {
      entity_id: entity.id,
      adif: entity.adif,
      entity_name: entity.name,
      prefix: entity.prefix,
      continent: entity.continent && entity.continent.trim() ? entity.continent : 'Unknown',
      cq_zone: entity.cq_zone,
      itu_zone: entity.itu_zone,
      status: !worked ? 'needed' : (worked.has_qsl ? 'confirmed' : 'worked'),
      contact_count: worked?.contact_count || 0,
      last_worked_date: worked?.last_worked || undefined,
      last_confirmed_date: worked?.last_confirmed || undefined,
      qsl_received: worked?.has_qsl || false,
      longitude: entity.longitude,
      latitude: entity.latitude
    } as DXCCEntityProgress;
  });

  const byContinentStats: Record<string, { worked: number; confirmed: number; total: number }> = {};
  entities.forEach(entity => {
    const continent = entity.continent && entity.continent.trim() ? entity.continent : 'Unknown';
    if (!byContinentStats[continent]) {
      byContinentStats[continent] = { worked: 0, confirmed: 0, total: 0 };
    }
    byContinentStats[continent].total++;
    if (entity.status !== 'needed') {
      byContinentStats[continent].worked++;
    }
    if (entity.status === 'confirmed') {
      byContinentStats[continent].confirmed++;
    }
  });

  const totalEntities = entities.length;
  const workedEntities = entities.filter(e => e.status !== 'needed').length;
  const confirmedEntities = entities.filter(e => e.status === 'confirmed').length;

  return {
    award_type: band.toLowerCase() as DXCCAwardType,
    band,
    total_entities: totalEntities,
    worked_entities: workedEntities,
    confirmed_entities: confirmedEntities,
    needed_entities: totalEntities - workedEntities,
    progress_percentage: Math.round((workedEntities / totalEntities) * 100),
    confirmed_percentage: Math.round((confirmedEntities / totalEntities) * 100),
    entities,
    by_continent: byContinentStats,
    last_updated: new Date().toISOString()
  };
}

async function calculateModeDXCCProgress(userId: number, stationId: number | undefined, modeType: 'phone' | 'cw' | 'digital' | 'rtty'): Promise<DXCCProgress> {
  const entitiesResult = await query(`
    SELECT de.id, de.adif, de.name, de.prefix, de.continent, de.cq_zone, de.itu_zone, de.longitude, de.latitude
    FROM dxcc_entities de
    WHERE de.deleted = false OR de.deleted IS NULL
    ORDER BY de.name
  `);

  let modeFilter = '';
  switch (modeType) {
    case 'phone':
      modeFilter = "AND UPPER(c.mode) IN ('SSB', 'FM', 'AM')";
      break;
    case 'cw':
      modeFilter = "AND UPPER(c.mode) = 'CW'";
      break;
    case 'digital':
      modeFilter = "AND UPPER(c.mode) IN ('PSK31', 'FT8', 'FT4', 'JT65', 'JT9', 'MFSK', 'OLIVIA', 'CONTESTIA')";
      break;
    case 'rtty':
      modeFilter = "AND UPPER(c.mode) = 'RTTY'";
      break;
  }

  let contactQuery = `
    SELECT DISTINCT c.dxcc,
           MAX(c.datetime) as last_worked,
           MAX(CASE WHEN c.lotw_qsl_rcvd = 'Y' AND c.lotw_qsl_sent = 'Y' THEN c.datetime END) as last_confirmed,
           COUNT(*) as contact_count,
           BOOL_OR(c.lotw_qsl_rcvd = 'Y' AND c.lotw_qsl_sent = 'Y') as has_qsl
    FROM contacts c
    WHERE c.user_id = $1
      AND c.dxcc IS NOT NULL
      ${modeFilter}
  `;

  const queryParams: (string | number)[] = [userId];
  if (stationId) {
    contactQuery += ' AND c.station_id = $2';
    queryParams.push(stationId);
  }

  contactQuery += ' GROUP BY c.dxcc';

  const workedEntitiesResult = await query(contactQuery, queryParams);
  const workedEntitiesMap = new Map(
    workedEntitiesResult.rows.map(row => [row.dxcc, row])
  );

  const entities = entitiesResult.rows.map(entity => {
    const worked = workedEntitiesMap.get(entity.adif);
    return {
      entity_id: entity.id,
      adif: entity.adif,
      entity_name: entity.name,
      prefix: entity.prefix,
      continent: entity.continent && entity.continent.trim() ? entity.continent : 'Unknown',
      cq_zone: entity.cq_zone,
      itu_zone: entity.itu_zone,
      status: !worked ? 'needed' : (worked.has_qsl ? 'confirmed' : 'worked'),
      contact_count: worked?.contact_count || 0,
      last_worked_date: worked?.last_worked || undefined,
      last_confirmed_date: worked?.last_confirmed || undefined,
      qsl_received: worked?.has_qsl || false,
      longitude: entity.longitude,
      latitude: entity.latitude
    } as DXCCEntityProgress;
  });

  const byContinentStats: Record<string, { worked: number; confirmed: number; total: number }> = {};
  entities.forEach(entity => {
    const continent = entity.continent && entity.continent.trim() ? entity.continent : 'Unknown';
    if (!byContinentStats[continent]) {
      byContinentStats[continent] = { worked: 0, confirmed: 0, total: 0 };
    }
    byContinentStats[continent].total++;
    if (entity.status !== 'needed') {
      byContinentStats[continent].worked++;
    }
    if (entity.status === 'confirmed') {
      byContinentStats[continent].confirmed++;
    }
  });

  const totalEntities = entities.length;
  const workedEntities = entities.filter(e => e.status !== 'needed').length;
  const confirmedEntities = entities.filter(e => e.status === 'confirmed').length;

  return {
    award_type: modeType,
    total_entities: totalEntities,
    worked_entities: workedEntities,
    confirmed_entities: confirmedEntities,
    needed_entities: totalEntities - workedEntities,
    progress_percentage: Math.round((workedEntities / totalEntities) * 100),
    confirmed_percentage: Math.round((confirmedEntities / totalEntities) * 100),
    entities,
    by_continent: byContinentStats,
    last_updated: new Date().toISOString()
  };
}

async function getRecentDXCCConfirmations(userId: number, stationId?: number) {
  let confirmQuery = `
    SELECT c.dxcc, de.name as entity_name, c.callsign, c.band, c.mode, c.datetime, 
           COALESCE(c.qsl_lotw_date, c.datetime) as confirmed_date
    FROM contacts c
    JOIN dxcc_entities de ON c.dxcc = de.adif
    WHERE c.user_id = $1
      AND c.dxcc IS NOT NULL
      AND c.lotw_qsl_rcvd = 'Y' AND c.lotw_qsl_sent = 'Y'
  `;

  const queryParams: (string | number)[] = [userId];
  if (stationId) {
    confirmQuery += ' AND c.station_id = $2';
    queryParams.push(stationId);
  }

  confirmQuery += ' ORDER BY COALESCE(c.qsl_lotw_date, c.datetime) DESC LIMIT 10';

  const result = await query(confirmQuery, queryParams);
  return result.rows.map(row => ({
    id: 0, // Not needed for recent confirmations
    user_id: userId,
    station_id: stationId,
    entity_id: row.dxcc,
    contact_id: 0, // Not needed for recent confirmations
    award_type: 'basic' as DXCCAwardType,
    mode: row.mode,
    qsl_received: true,
    confirmed_date: row.confirmed_date, // Keep as string for JSON serialization
    created_at: row.datetime // Keep as string for JSON serialization
  }));
}

async function calculateNeededEntities(userId: number, stationId?: number) {
  // Get all entities
  const allEntitiesResult = await query(`
    SELECT de.adif FROM dxcc_entities de WHERE de.deleted = false OR de.deleted IS NULL
  `);
  const allEntities = allEntitiesResult.rows.map(row => row.adif);

  // Get worked entities (all bands/modes)
  let workedQuery = `
    SELECT DISTINCT dxcc FROM contacts
    WHERE user_id = $1 AND dxcc IS NOT NULL
  `;
  const queryParams: (string | number)[] = [userId];
  if (stationId) {
    workedQuery += ' AND station_id = $2';
    queryParams.push(stationId);
  }

  const workedResult = await query(workedQuery, queryParams);
  const workedEntities = new Set(workedResult.rows.map(row => row.dxcc));

  const needed = allEntities.filter(entity => !workedEntities.has(entity));

  // Calculate by band and mode
  const byBand: Record<string, number[]> = {};
  const byMode: Record<string, number[]> = {};
  const byContinent: Record<string, number[]> = {};

  for (const band of DXCC_BANDS) {
    const bandWorkedResult = await query(`
      SELECT DISTINCT dxcc FROM contacts
      WHERE user_id = $1 AND dxcc IS NOT NULL AND UPPER(band) = $2
      ${stationId ? 'AND station_id = $3' : ''}
    `, stationId ? [userId, band, stationId] : [userId, band]);
    
    const bandWorked = new Set(bandWorkedResult.rows.map(row => row.dxcc));
    byBand[band] = allEntities.filter(entity => !bandWorked.has(entity));
  }

  const modes = ['Phone', 'CW', 'Digital', 'RTTY'];
  for (const mode of modes) {
    let modeFilter = '';
    switch (mode.toLowerCase()) {
      case 'phone':
        modeFilter = "AND UPPER(mode) IN ('SSB', 'FM', 'AM')";
        break;
      case 'cw':
        modeFilter = "AND UPPER(mode) = 'CW'";
        break;
      case 'digital':
        modeFilter = "AND UPPER(mode) IN ('PSK31', 'FT8', 'FT4', 'JT65', 'JT9', 'MFSK', 'OLIVIA', 'CONTESTIA')";
        break;
      case 'rtty':
        modeFilter = "AND UPPER(mode) = 'RTTY'";
        break;
    }

    const modeWorkedResult = await query(`
      SELECT DISTINCT dxcc FROM contacts
      WHERE user_id = $1 AND dxcc IS NOT NULL ${modeFilter}
      ${stationId ? 'AND station_id = $2' : ''}
    `, stationId ? [userId, stationId] : [userId]);
    
    const modeWorked = new Set(modeWorkedResult.rows.map(row => row.dxcc));
    byMode[mode] = allEntities.filter(entity => !modeWorked.has(entity));
  }

  // By continent
  const continents = ['NA', 'SA', 'EU', 'AS', 'AF', 'OC', 'AN'];
  for (const continent of continents) {
    const continentWorkedResult = await query(`
      SELECT DISTINCT c.dxcc FROM contacts c
      JOIN dxcc_entities de ON c.dxcc = de.adif
      WHERE c.user_id = $1 AND c.dxcc IS NOT NULL AND de.continent = $2
      ${stationId ? 'AND c.station_id = $3' : ''}
    `, stationId ? [userId, continent, stationId] : [userId, continent]);
    
    const continentWorked = new Set(continentWorkedResult.rows.map(row => row.dxcc));
    
    const continentEntitiesResult = await query(`
      SELECT de.adif FROM dxcc_entities de WHERE de.continent = $1 AND (de.deleted = false OR de.deleted IS NULL)
    `, [continent]);
    const continentEntities = continentEntitiesResult.rows.map(row => row.adif);
    
    byContinent[continent] = continentEntities.filter(entity => !continentWorked.has(entity));
  }

  return {
    all: needed,
    by_band: byBand,
    by_mode: byMode,
    by_continent: byContinent
  };
}

async function getDXCCStatistics(userId: number, stationId?: number) {
  // Basic statistics
  let statsQuery = `
    SELECT 
      COUNT(DISTINCT dxcc) as entities_worked,
      COUNT(DISTINCT CASE WHEN lotw_qsl_rcvd = 'Y' AND lotw_qsl_sent = 'Y' THEN dxcc END) as entities_confirmed,
      de.continent,
      COUNT(*) as contact_count
    FROM contacts c
    JOIN dxcc_entities de ON c.dxcc = de.adif
    WHERE c.user_id = $1
      AND c.dxcc IS NOT NULL
  `;

  const queryParams: (string | number)[] = [userId];
  if (stationId) {
    statsQuery += ' AND c.station_id = $2';
    queryParams.push(stationId);
  }

  statsQuery += ' GROUP BY de.continent ORDER BY contact_count DESC';

  const statsResult = await query(statsQuery, queryParams);
  
  const totalEntitiesWorked = statsResult.rows.reduce((sum, row) => sum + parseInt(row.entities_worked), 0);
  const totalEntitiesConfirmed = statsResult.rows.reduce((sum, row) => sum + parseInt(row.entities_confirmed), 0);
  
  const mostWorked = statsResult.rows[0] || { continent: 'None', contact_count: 0 };
  
  // Get rarest entity (least worked)
  const rarestResult = await query(`
    SELECT de.name, COUNT(*) as contact_count
    FROM contacts c
    JOIN dxcc_entities de ON c.dxcc = de.adif
    WHERE c.user_id = $1 AND c.dxcc IS NOT NULL
    ${stationId ? 'AND c.station_id = $2' : ''}
    GROUP BY de.name
    ORDER BY contact_count ASC, de.name ASC
    LIMIT 1
  `, stationId ? [userId, stationId] : [userId]);
  
  const rarest = rarestResult.rows[0] || { name: 'None', contact_count: 0 };

  return {
    total_dxcc_awards: 0, // TODO: Calculate completed awards
    completed_awards: 0, // TODO: Calculate completed awards
    entities_worked_total: totalEntitiesWorked,
    entities_confirmed_total: totalEntitiesConfirmed,
    most_worked_continent: {
      continent: mostWorked.continent,
      count: mostWorked.contact_count
    },
    rarest_entity: {
      entity: rarest.name,
      count: rarest.contact_count
    }
  };
}