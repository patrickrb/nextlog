// WAS Progress API endpoint
// Calculates and returns WAS progress for a user/station

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { WASProgress, WASProgressRequest, WASProgressResponse, WASAwardType, WASStateProgress, WASStatus } from '@/types/awards';

export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const stationId = searchParams.get('station_id');
    const awardType = searchParams.get('award_type') as WASAwardType || 'basic';
    const band = searchParams.get('band') || undefined;
    const mode = searchParams.get('mode') || undefined;

    // Build the query to get WAS progress
    const wasProgress = await calculateWASProgress({
      userId: parseInt(user.userId),
      stationId: stationId ? parseInt(stationId) : undefined,
      awardType,
      band,
      mode
    });

    const response: WASProgressResponse = {
      success: true,
      data: wasProgress
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('WAS progress error:', error);
    const response: WASProgressResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    };
    return NextResponse.json(response, { status: 500 });
  }
}

interface WASCalculationParams {
  userId: number;
  stationId?: number;
  awardType: WASAwardType;
  band?: string;
  mode?: string;
}

async function calculateWASProgress(params: WASCalculationParams): Promise<WASProgress> {
  const { userId, stationId, awardType, band, mode } = params;

  // Get all US states
  const statesResult = await query(`
    SELECT code, name, dxcc_entity 
    FROM states_provinces 
    WHERE dxcc_entity IN (6, 110, 291)  -- Alaska, Hawaii, US
    ORDER BY name
  `);

  const allStates = statesResult.rows;

  // Build contact query based on award type
  let contactQuery = `
    SELECT DISTINCT ON (c.state) 
      c.state,
      c.id,
      c.callsign,
      c.band,
      c.mode,
      c.datetime,
      c.qsl_rcvd,
      c.lotw_qsl_rcvd,
      c.lotw_qsl_sent,
      c.qsl_lotw_date
    FROM contacts c
    WHERE c.user_id = $1
      AND c.state IS NOT NULL
      AND c.state != ''
      AND c.dxcc IN (6, 110, 291)  -- US entities only
  `;

  const queryParams: (string | number)[] = [userId];
  let paramIndex = 2;

  // Add station filter if specified
  if (stationId) {
    contactQuery += ` AND c.station_id = $${paramIndex}`;
    queryParams.push(stationId);
    paramIndex++;
  }

  // Add band filter based on award type
  if (awardType.endsWith('m') || band) {
    const targetBand = band || awardType.toUpperCase().replace('M', 'M');
    contactQuery += ` AND UPPER(c.band) = $${paramIndex}`;
    queryParams.push(targetBand);
    paramIndex++;
  }

  // Add mode filter based on award type
  if (awardType === 'phone') {
    contactQuery += ` AND UPPER(c.mode) IN ('SSB', 'FM', 'AM')`;
  } else if (awardType === 'cw') {
    contactQuery += ` AND UPPER(c.mode) = 'CW'`;
  } else if (awardType === 'digital') {
    contactQuery += ` AND UPPER(c.mode) IN ('PSK31', 'FT8', 'FT4', 'JT65', 'JT9', 'MFSK', 'OLIVIA', 'CONTESTIA')`;
  } else if (awardType === 'rtty') {
    contactQuery += ` AND UPPER(c.mode) = 'RTTY'`;
  } else if (mode) {
    contactQuery += ` AND UPPER(c.mode) = $${paramIndex}`;
    queryParams.push(mode.toUpperCase());
    paramIndex++;
  }

  // Order by most recent contact per state
  contactQuery += ` ORDER BY c.state, c.datetime DESC`;

  const contactsResult = await query(contactQuery, queryParams);
  const contacts = contactsResult.rows;

  // Create a map of state contacts
  const stateContacts = new Map(
    contacts.map(contact => [contact.state.toUpperCase(), contact])
  );

  // Calculate progress for each state
  const stateProgress: WASStateProgress[] = allStates.map(state => {
    const contact = stateContacts.get(state.code);
    
    if (!contact) {
      return {
        state_code: state.code,
        state_name: state.name,
        status: 'needed' as WASStatus,
        contact_count: 0,
        qsl_received: false
      };
    }

    const isConfirmed = contact.lotw_qsl_rcvd === 'Y' && contact.lotw_qsl_sent === 'Y';
    
    return {
      state_code: state.code,
      state_name: state.name,
      status: isConfirmed ? 'confirmed' : 'worked' as WASStatus,
      contact_count: 1, // We're using DISTINCT ON, so always 1 per state
      last_worked_date: new Date(contact.datetime),
      last_confirmed_date: isConfirmed && contact.qsl_lotw_date ? new Date(contact.qsl_lotw_date) : undefined,
      qsl_received: isConfirmed,
      contact_id: contact.id,
      callsign: contact.callsign,
      band: contact.band,
      mode: contact.mode
    };
  });

  // Calculate totals
  const totalStates = allStates.length;
  const workedStates = stateProgress.filter(s => s.status !== 'needed').length;
  const confirmedStates = stateProgress.filter(s => s.status === 'confirmed').length;
  const neededStates = totalStates - workedStates;

  const progress: WASProgress = {
    award_type: awardType,
    band,
    total_states: totalStates,
    worked_states: workedStates,
    confirmed_states: confirmedStates,
    needed_states: neededStates,
    progress_percentage: Math.round((workedStates / totalStates) * 100),
    confirmed_percentage: Math.round((confirmedStates / totalStates) * 100),
    states: stateProgress,
    last_updated: new Date()
  };

  return progress;
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: WASProgressRequest = await request.json();
    const { station_id, award_type = 'basic', band, mode } = body;

    const wasProgress = await calculateWASProgress({
      userId: parseInt(user.userId),
      stationId: station_id,
      awardType: award_type,
      band,
      mode
    });

    const response: WASProgressResponse = {
      success: true,
      data: wasProgress
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('WAS progress POST error:', error);
    const response: WASProgressResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    };
    return NextResponse.json(response, { status: 500 });
  }
}