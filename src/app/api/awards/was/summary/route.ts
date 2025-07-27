// WAS Summary API endpoint
// Provides comprehensive WAS statistics and overview

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { WASSummary, WASSummaryResponse, WASProgress, WAS_BANDS, WASStateProgress, WASAwardType } from '@/types/awards';

export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const stationId = searchParams.get('station_id');

    const summary = await calculateWASSummary({
      userId: parseInt(user.userId),
      stationId: stationId ? parseInt(stationId) : undefined
    });

    const response: WASSummaryResponse = {
      success: true,
      data: summary
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('WAS summary error:', error);
    const response: WASSummaryResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    };
    return NextResponse.json(response, { status: 500 });
  }
}

interface WASummaryParams {
  userId: number;
  stationId?: number;
}

async function calculateWASSummary(params: WASummaryParams): Promise<WASSummary> {
  const { userId, stationId } = params;

  // Calculate overall WAS progress (basic mixed mode)
  const overallProgress = await calculateBasicWASProgress(userId, stationId);

  // Calculate band-specific progress
  const bandProgress: Record<string, WASProgress> = {};
  for (const band of WAS_BANDS) {
    bandProgress[band] = await calculateBandWASProgress(userId, stationId, band);
  }

  // Calculate mode-specific progress
  const modeProgress: Record<string, WASProgress> = {};
  const modes = ['Phone', 'CW', 'Digital', 'RTTY'];
  for (const mode of modes) {
    modeProgress[mode] = await calculateModeWASProgress(userId, stationId, mode.toLowerCase() as 'phone' | 'cw' | 'digital' | 'rtty');
  }

  // Get recent confirmations
  const recentConfirmations = await getRecentWASConfirmations(userId, stationId);

  // Calculate needed states
  const neededStates = await calculateNeededStates(userId, stationId);

  // Get statistics
  const statistics = await getWASStatistics(userId, stationId);

  const summary: WASSummary = {
    overall_progress: overallProgress,
    band_progress: bandProgress,
    mode_progress: modeProgress,
    recent_confirmations: recentConfirmations,
    needed_states: neededStates,
    statistics
  };

  return summary;
}

async function calculateBasicWASProgress(userId: number, stationId?: number): Promise<WASProgress> {
  // Get all US states
  const statesResult = await query(`
    SELECT code, name 
    FROM states_provinces 
    WHERE dxcc_entity IN (6, 110, 291)
    ORDER BY name
  `);

  // Get worked states for this user/station
  let contactQuery = `
    SELECT DISTINCT c.state,
           MAX(c.datetime) as last_worked,
           MAX(CASE WHEN c.lotw_qsl_rcvd = 'Y' AND c.lotw_qsl_sent = 'Y' THEN c.datetime END) as last_confirmed,
           COUNT(*) as contact_count,
           BOOL_OR(c.lotw_qsl_rcvd = 'Y' AND c.lotw_qsl_sent = 'Y') as has_qsl
    FROM contacts c
    WHERE c.user_id = $1
      AND c.state IS NOT NULL
      AND c.state != ''
      AND c.dxcc IN (6, 110, 291)
  `;

  const queryParams: (string | number)[] = [userId];
  if (stationId) {
    contactQuery += ' AND c.station_id = $2';
    queryParams.push(stationId);
  }

  contactQuery += ' GROUP BY c.state';

  const workedStatesResult = await query(contactQuery, queryParams);
  const workedStatesMap = new Map(
    workedStatesResult.rows.map(row => [row.state.toUpperCase(), row])
  );

  const states = statesResult.rows.map(state => {
    const worked = workedStatesMap.get(state.code);
    return {
      state_code: state.code,
      state_name: state.name,
      status: !worked ? 'needed' : (worked.has_qsl ? 'confirmed' : 'worked'),
      contact_count: worked?.contact_count || 0,
      last_worked_date: worked?.last_worked ? new Date(worked.last_worked) : undefined,
      last_confirmed_date: worked?.last_confirmed ? new Date(worked.last_confirmed) : undefined,
      qsl_received: worked?.has_qsl || false
    } as WASStateProgress;
  });

  const totalStates = states.length;
  const workedStates = states.filter(s => s.status !== 'needed').length;
  const confirmedStates = states.filter(s => s.status === 'confirmed').length;

  return {
    award_type: 'basic',
    total_states: totalStates,
    worked_states: workedStates,
    confirmed_states: confirmedStates,
    needed_states: totalStates - workedStates,
    progress_percentage: Math.round((workedStates / totalStates) * 100),
    confirmed_percentage: Math.round((confirmedStates / totalStates) * 100),
    states,
    last_updated: new Date()
  };
}

async function calculateBandWASProgress(userId: number, stationId: number | undefined, band: string): Promise<WASProgress> {
  // Similar to basic but with band filter
  const statesResult = await query(`
    SELECT code, name 
    FROM states_provinces 
    WHERE dxcc_entity IN (6, 110, 291)
    ORDER BY name
  `);

  let contactQuery = `
    SELECT DISTINCT c.state,
           MAX(c.datetime) as last_worked,
           MAX(CASE WHEN c.lotw_qsl_rcvd = 'Y' AND c.lotw_qsl_sent = 'Y' THEN c.datetime END) as last_confirmed,
           COUNT(*) as contact_count,
           BOOL_OR(c.lotw_qsl_rcvd = 'Y' AND c.lotw_qsl_sent = 'Y') as has_qsl
    FROM contacts c
    WHERE c.user_id = $1
      AND c.state IS NOT NULL
      AND c.state != ''
      AND c.dxcc IN (6, 110, 291)
      AND UPPER(c.band) = $2
  `;

  const queryParams: (string | number)[] = [userId, band.toUpperCase()];
  if (stationId) {
    contactQuery += ' AND c.station_id = $3';
    queryParams.push(stationId);
  }

  contactQuery += ' GROUP BY c.state';

  const workedStatesResult = await query(contactQuery, queryParams);
  const workedStatesMap = new Map(
    workedStatesResult.rows.map(row => [row.state.toUpperCase(), row])
  );

  const states = statesResult.rows.map(state => {
    const worked = workedStatesMap.get(state.code);
    return {
      state_code: state.code,
      state_name: state.name,
      status: !worked ? 'needed' : (worked.has_qsl ? 'confirmed' : 'worked'),
      contact_count: worked?.contact_count || 0,
      last_worked_date: worked?.last_worked ? new Date(worked.last_worked) : undefined,
      last_confirmed_date: worked?.last_confirmed ? new Date(worked.last_confirmed) : undefined,
      qsl_received: worked?.has_qsl || false
    } as WASStateProgress;
  });

  const totalStates = states.length;
  const workedStates = states.filter(s => s.status !== 'needed').length;
  const confirmedStates = states.filter(s => s.status === 'confirmed').length;

  return {
    award_type: band.toLowerCase() as WASAwardType,
    band,
    total_states: totalStates,
    worked_states: workedStates,
    confirmed_states: confirmedStates,
    needed_states: totalStates - workedStates,
    progress_percentage: Math.round((workedStates / totalStates) * 100),
    confirmed_percentage: Math.round((confirmedStates / totalStates) * 100),
    states,
    last_updated: new Date()
  };
}

async function calculateModeWASProgress(userId: number, stationId: number | undefined, modeType: 'phone' | 'cw' | 'digital' | 'rtty'): Promise<WASProgress> {
  const statesResult = await query(`
    SELECT code, name 
    FROM states_provinces 
    WHERE dxcc_entity IN (6, 110, 291)
    ORDER BY name
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
    SELECT DISTINCT c.state,
           MAX(c.datetime) as last_worked,
           MAX(CASE WHEN c.lotw_qsl_rcvd = 'Y' AND c.lotw_qsl_sent = 'Y' THEN c.datetime END) as last_confirmed,
           COUNT(*) as contact_count,
           BOOL_OR(c.lotw_qsl_rcvd = 'Y' AND c.lotw_qsl_sent = 'Y') as has_qsl
    FROM contacts c
    WHERE c.user_id = $1
      AND c.state IS NOT NULL
      AND c.state != ''
      AND c.dxcc IN (6, 110, 291)
      ${modeFilter}
  `;

  const queryParams: (string | number)[] = [userId];
  if (stationId) {
    contactQuery += ' AND c.station_id = $2';
    queryParams.push(stationId);
  }

  contactQuery += ' GROUP BY c.state';

  const workedStatesResult = await query(contactQuery, queryParams);
  const workedStatesMap = new Map(
    workedStatesResult.rows.map(row => [row.state.toUpperCase(), row])
  );

  const states = statesResult.rows.map(state => {
    const worked = workedStatesMap.get(state.code);
    return {
      state_code: state.code,
      state_name: state.name,
      status: !worked ? 'needed' : (worked.has_qsl ? 'confirmed' : 'worked'),
      contact_count: worked?.contact_count || 0,
      last_worked_date: worked?.last_worked ? new Date(worked.last_worked) : undefined,
      last_confirmed_date: worked?.last_confirmed ? new Date(worked.last_confirmed) : undefined,
      qsl_received: worked?.has_qsl || false
    } as WASStateProgress;
  });

  const totalStates = states.length;
  const workedStates = states.filter(s => s.status !== 'needed').length;
  const confirmedStates = states.filter(s => s.status === 'confirmed').length;

  return {
    award_type: modeType,
    total_states: totalStates,
    worked_states: workedStates,
    confirmed_states: confirmedStates,
    needed_states: totalStates - workedStates,
    progress_percentage: Math.round((workedStates / totalStates) * 100),
    confirmed_percentage: Math.round((confirmedStates / totalStates) * 100),
    states,
    last_updated: new Date()
  };
}

async function getRecentWASConfirmations(userId: number, stationId?: number) {
  let confirmQuery = `
    SELECT c.state, c.callsign, c.band, c.mode, c.datetime, 
           COALESCE(c.qsl_lotw_date, c.datetime) as confirmed_date
    FROM contacts c
    WHERE c.user_id = $1
      AND c.state IS NOT NULL
      AND c.state != ''
      AND c.dxcc IN (6, 110, 291)
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
    state_code: row.state,
    contact_id: 0, // Not needed for recent confirmations
    award_type: 'basic' as WASAwardType,
    mode: row.mode,
    qsl_received: true,
    confirmed_date: new Date(row.confirmed_date),
    created_at: new Date(row.datetime)
  }));
}

async function calculateNeededStates(userId: number, stationId?: number) {
  // Get all states
  const allStatesResult = await query(`
    SELECT code FROM states_provinces WHERE dxcc_entity IN (6, 110, 291)
  `);
  const allStates = allStatesResult.rows.map(row => row.code);

  // Get worked states (all bands/modes)
  let workedQuery = `
    SELECT DISTINCT state FROM contacts
    WHERE user_id = $1 AND state IS NOT NULL AND state != '' AND dxcc IN (6, 110, 291)
  `;
  const queryParams: (string | number)[] = [userId];
  if (stationId) {
    workedQuery += ' AND station_id = $2';
    queryParams.push(stationId);
  }

  const workedResult = await query(workedQuery, queryParams);
  const workedStates = new Set(workedResult.rows.map(row => row.state.toUpperCase()));

  const needed = allStates.filter(state => !workedStates.has(state));

  // Calculate by band and mode
  const byBand: Record<string, string[]> = {};
  const byMode: Record<string, string[]> = {};

  for (const band of WAS_BANDS) {
    const bandWorkedResult = await query(`
      SELECT DISTINCT state FROM contacts
      WHERE user_id = $1 AND state IS NOT NULL AND state != '' 
        AND dxcc IN (6, 110, 291) AND UPPER(band) = $2
      ${stationId ? 'AND station_id = $3' : ''}
    `, stationId ? [userId, band, stationId] : [userId, band]);
    
    const bandWorked = new Set(bandWorkedResult.rows.map(row => row.state.toUpperCase()));
    byBand[band] = allStates.filter(state => !bandWorked.has(state));
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
      SELECT DISTINCT state FROM contacts
      WHERE user_id = $1 AND state IS NOT NULL AND state != '' 
        AND dxcc IN (6, 110, 291) ${modeFilter}
      ${stationId ? 'AND station_id = $2' : ''}
    `, stationId ? [userId, stationId] : [userId]);
    
    const modeWorked = new Set(modeWorkedResult.rows.map(row => row.state.toUpperCase()));
    byMode[mode] = allStates.filter(state => !modeWorked.has(state));
  }

  return {
    all: needed,
    by_band: byBand,
    by_mode: byMode
  };
}

async function getWASStatistics(userId: number, stationId?: number) {
  // Basic statistics
  let statsQuery = `
    SELECT 
      COUNT(DISTINCT state) as states_worked,
      COUNT(DISTINCT CASE WHEN lotw_qsl_rcvd = 'Y' AND lotw_qsl_sent = 'Y' THEN state END) as states_confirmed,
      state,
      COUNT(*) as contact_count
    FROM contacts c
    WHERE c.user_id = $1
      AND c.state IS NOT NULL
      AND c.state != ''
      AND c.dxcc IN (6, 110, 291)
  `;

  const queryParams: (string | number)[] = [userId];
  if (stationId) {
    statsQuery += ' AND c.station_id = $2';
    queryParams.push(stationId);
  }

  statsQuery += ' GROUP BY state ORDER BY contact_count DESC';

  const statsResult = await query(statsQuery, queryParams);
  
  const totalStatesWorked = statsResult.rows.length;
  const totalStatesConfirmed = statsResult.rows.filter(row => row.states_confirmed > 0).length;
  
  const mostWorked = statsResult.rows[0] || { state: 'None', contact_count: 0 };
  const leastWorked = statsResult.rows[statsResult.rows.length - 1] || { state: 'None', contact_count: 0 };

  return {
    total_was_awards: 0, // TODO: Calculate completed awards
    completed_awards: 0, // TODO: Calculate completed awards
    states_worked_total: totalStatesWorked,
    states_confirmed_total: totalStatesConfirmed,
    most_worked_state: {
      state: mostWorked.state,
      count: mostWorked.contact_count
    },
    rarest_state: {
      state: leastWorked.state,
      count: leastWorked.contact_count
    }
  };
}