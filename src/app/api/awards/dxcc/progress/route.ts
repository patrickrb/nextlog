// DXCC Progress API endpoint
// Calculates and returns DXCC progress for a user/station

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { DXCCProgress, DXCCProgressRequest, DXCCProgressResponse, DXCCAwardType, DXCCEntityProgress, DXCCStatus } from '@/types/awards';

export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const stationId = searchParams.get('station_id');
    const awardType = searchParams.get('award_type') as DXCCAwardType || 'basic';
    const band = searchParams.get('band') || undefined;
    const mode = searchParams.get('mode') || undefined;

    // Build the query to get DXCC progress
    const dxccProgress = await calculateDXCCProgress({
      userId: parseInt(user.userId),
      stationId: stationId ? parseInt(stationId) : undefined,
      awardType,
      band,
      mode
    });

    const response: DXCCProgressResponse = {
      success: true,
      data: dxccProgress
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('DXCC progress error:', error);
    const response: DXCCProgressResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    };
    return NextResponse.json(response, { status: 500 });
  }
}

interface DXCCCalculationParams {
  userId: number;
  stationId?: number;
  awardType: DXCCAwardType;
  band?: string;
  mode?: string;
}

async function calculateDXCCProgress(params: DXCCCalculationParams): Promise<DXCCProgress> {
  const { userId, stationId, awardType, band, mode } = params;

  // Get all DXCC entities (excluding deleted ones)
  const entitiesResult = await query(`
    SELECT id, adif, name, prefix, continent, cq_zone, itu_zone, longitude, latitude
    FROM dxcc_entities 
    WHERE deleted = false OR deleted IS NULL
    ORDER BY name
  `);

  const allEntities = entitiesResult.rows;

  // Build contact query based on award type
  let contactQuery = `
    SELECT DISTINCT ON (c.dxcc) 
      c.dxcc,
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
      AND c.dxcc IS NOT NULL
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

  // Order by most recent contact per entity
  contactQuery += ` ORDER BY c.dxcc, c.datetime DESC`;

  const contactsResult = await query(contactQuery, queryParams);
  const contacts = contactsResult.rows;

  // Create a map of entity contacts
  const entityContacts = new Map(
    contacts.map(contact => [contact.dxcc, contact])
  );

  // Calculate by continent stats
  const byContinentStats: Record<string, { worked: number; confirmed: number; total: number }> = {};

  // Calculate progress for each entity
  const entityProgress: DXCCEntityProgress[] = allEntities.map(entity => {
    const contact = entityContacts.get(entity.adif);
    
    // Initialize continent stats if not exists (handle null/undefined/empty continents)
    const continent = entity.continent && entity.continent.trim() ? entity.continent : 'Unknown';
    if (!byContinentStats[continent]) {
      byContinentStats[continent] = { worked: 0, confirmed: 0, total: 0 };
    }
    byContinentStats[continent].total++;
    
    if (!contact) {
      return {
        entity_id: entity.id,
        adif: entity.adif,
        entity_name: entity.name,
        prefix: entity.prefix,
        continent: entity.continent && entity.continent.trim() ? entity.continent : 'Unknown',
        cq_zone: entity.cq_zone,
        itu_zone: entity.itu_zone,
        status: 'needed' as DXCCStatus,
        contact_count: 0,
        qsl_received: false,
        longitude: entity.longitude,
        latitude: entity.latitude
      };
    }

    const isConfirmed = contact.lotw_qsl_rcvd === 'Y' && contact.lotw_qsl_sent === 'Y';
    
    byContinentStats[continent].worked++;
    if (isConfirmed) {
      byContinentStats[continent].confirmed++;
    }
    
    return {
      entity_id: entity.id,
      adif: entity.adif,
      entity_name: entity.name,
      prefix: entity.prefix,
      continent: entity.continent && entity.continent.trim() ? entity.continent : 'Unknown',
      cq_zone: entity.cq_zone,
      itu_zone: entity.itu_zone,
      status: isConfirmed ? 'confirmed' : 'worked' as DXCCStatus,
      contact_count: 1, // We're using DISTINCT ON, so always 1 per entity
      last_worked_date: contact.datetime,
      last_confirmed_date: isConfirmed && contact.qsl_lotw_date ? contact.qsl_lotw_date : undefined,
      qsl_received: isConfirmed,
      contact_id: contact.id,
      callsign: contact.callsign,
      band: contact.band,
      mode: contact.mode,
      longitude: entity.longitude,
      latitude: entity.latitude
    };
  });

  // Calculate totals
  const totalEntities = allEntities.length;
  const workedEntities = entityProgress.filter(e => e.status !== 'needed').length;
  const confirmedEntities = entityProgress.filter(e => e.status === 'confirmed').length;
  const neededEntities = totalEntities - workedEntities;

  const progress: DXCCProgress = {
    award_type: awardType,
    band,
    total_entities: totalEntities,
    worked_entities: workedEntities,
    confirmed_entities: confirmedEntities,
    needed_entities: neededEntities,
    progress_percentage: Math.round((workedEntities / totalEntities) * 100),
    confirmed_percentage: Math.round((confirmedEntities / totalEntities) * 100),
    entities: entityProgress,
    by_continent: byContinentStats,
    last_updated: new Date().toISOString()
  };

  return progress;
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: DXCCProgressRequest = await request.json();
    const { station_id, award_type = 'basic', band, mode } = body;

    const dxccProgress = await calculateDXCCProgress({
      userId: parseInt(user.userId),
      stationId: station_id,
      awardType: award_type,
      band,
      mode
    });

    const response: DXCCProgressResponse = {
      success: true,
      data: dxccProgress
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('DXCC progress POST error:', error);
    const response: DXCCProgressResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    };
    return NextResponse.json(response, { status: 500 });
  }
}