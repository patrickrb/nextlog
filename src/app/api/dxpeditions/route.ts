import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

interface DXpedition {
  callsign: string;
  dxcc: string;
  startDate: string;
  endDate: string;
  bands?: string;
  modes?: string;
  qslVia?: string;
  info?: string;
  status: 'upcoming' | 'active' | 'completed';
}

// Cache for DXpedition data to avoid excessive requests
let cachedData: DXpedition[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

async function fetchDXpeditionData(): Promise<DXpedition[]> {
  try {
    // Check cache first
    const now = Date.now();
    if (cachedData && (now - cacheTimestamp) < CACHE_DURATION) {
      return cachedData;
    }

    // Since ng3k.com doesn't have an API, we'll create some sample data
    // In a real implementation, you could scrape their page or use another data source
    const currentDate = new Date();
    const sampleDXpeditions: DXpedition[] = [
      {
        callsign: 'VP8STI',
        dxcc: 'South Sandwich Islands',
        startDate: '2025-08-15',
        endDate: '2025-08-28',
        bands: '160-10m',
        modes: 'CW, SSB, FT8',
        qslVia: 'M0OXO',
        info: 'Major DXpedition to VP8',
        status: 'upcoming'
      },
      {
        callsign: 'FT4TA',
        dxcc: 'Tromelin Island',
        startDate: '2025-07-20',
        endDate: '2025-07-30',
        bands: '80-10m',
        modes: 'CW, SSB, FT8, FT4',
        qslVia: 'F6ARC',
        info: 'Tromelin Island DXpedition',
        status: 'active'
      },
      {
        callsign: 'E51AND',
        dxcc: 'South Cook Islands',
        startDate: '2025-09-10',
        endDate: '2025-09-25',
        bands: '160-6m',
        modes: 'CW, SSB, FT8',
        qslVia: 'JA1XGI',
        info: 'Rarotonga operation',
        status: 'upcoming'
      },
      {
        callsign: 'J28AA',
        dxcc: 'Djibouti',
        startDate: '2025-08-01',
        endDate: '2025-08-14',
        bands: '40-10m',
        modes: 'CW, SSB, FT8',
        qslVia: 'IK2DUW',
        info: 'Multi-operator expedition',
        status: 'upcoming'
      },
      {
        callsign: 'T32AZ',
        dxcc: 'East Kiribati',
        startDate: '2025-10-05',
        endDate: '2025-10-20',
        bands: '80-10m',
        modes: 'CW, SSB, RTTY, FT8',
        qslVia: 'JA1XGI',
        info: 'Christmas Island DXpedition',
        status: 'upcoming'
      },
      {
        callsign: '3Y0J',
        dxcc: 'Bouvet Island',
        startDate: '2025-01-15',
        endDate: '2025-01-20',
        bands: '80-10m',
        modes: 'CW, SSB, FT8',
        qslVia: 'LA2XPA',
        info: 'Bouvet Island expedition (completed)',
        status: 'completed'
      }
    ];

    // Dynamically determine status based on current date
    const updatedDXpeditions = sampleDXpeditions.map(dx => {
      const startDate = new Date(dx.startDate);
      const endDate = new Date(dx.endDate);
      
      if (currentDate >= startDate && currentDate <= endDate) {
        return { ...dx, status: 'active' as const };
      } else if (currentDate > endDate) {
        return { ...dx, status: 'completed' as const };
      } else {
        return { ...dx, status: 'upcoming' as const };
      }
    });

    // Update cache
    cachedData = updatedDXpeditions;
    cacheTimestamp = Date.now();

    return updatedDXpeditions;
  } catch (error) {
    console.error('Error fetching DXpedition data:', error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status') || 'all';

    let dxpeditions = await fetchDXpeditionData();

    // Filter by status if specified
    if (status !== 'all') {
      dxpeditions = dxpeditions.filter(dx => dx.status === status);
    }

    // Sort by start date
    dxpeditions.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    // Apply limit
    if (limit > 0) {
      dxpeditions = dxpeditions.slice(0, limit);
    }

    return NextResponse.json({
      dxpeditions,
      lastUpdated: new Date(cacheTimestamp).toISOString()
    });

  } catch (error) {
    console.error('Error in DXpeditions API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}