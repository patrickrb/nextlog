import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

// Force this route to use Node.js runtime instead of Edge
export const runtime = 'nodejs';

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

function parseDate(dateStr: string): string {
  // NG3K uses format like "2025 Nov01" or "2025 Nov 01"
  try {
    const cleaned = dateStr.trim().replace(/-/g, ' ');
    const parts = cleaned.split(/\s+/);

    const monthMap: { [key: string]: string } = {
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
      'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
      'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };

    if (parts.length >= 2) {
      // Check if first part is a 4-digit year (new format: "2025 Nov01")
      if (parts[0].length === 4 && !isNaN(Number(parts[0]))) {
        const year = parts[0];
        const month = parts[1];
        const day = parts.length > 2 ? parts[2].padStart(2, '0') : parts[1].slice(3).padStart(2, '0');
        const monthNum = monthMap[month.slice(0, 3)] || '01';
        return `${year}-${monthNum}-${day}`;
      }
      // Old format: "29 Nov 25" or "29 Nov 2025"
      else if (parts.length >= 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1];
        const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        const monthNum = monthMap[month] || '01';
        return `${year}-${monthNum}-${day}`;
      }
    }
  } catch (e) {
    console.error('Error parsing date:', dateStr, e);
  }
  return new Date().toISOString().split('T')[0];
}

function extractBandsAndModes(info: string): { bands?: string; modes?: string } {
  const result: { bands?: string; modes?: string } = {};

  // Extract bands (patterns like "160-10m", "80-10m", "40-6m", etc.)
  const bandMatch = info.match(/\b(\d{1,3}[-–]\d{1,2}m|\d{1,3}m[-–]\d{1,2}m)\b/i);
  if (bandMatch) {
    result.bands = bandMatch[1];
  }

  // Extract modes (CW, SSB, FT8, FT4, RTTY, etc.)
  const modePatterns = ['CW', 'SSB', 'FT8', 'FT4', 'RTTY', 'PSK', 'SSTV', 'FM', 'DIGITAL'];
  const foundModes: string[] = [];

  for (const mode of modePatterns) {
    if (new RegExp(`\\b${mode}\\b`, 'i').test(info)) {
      foundModes.push(mode);
    }
  }

  if (foundModes.length > 0) {
    result.modes = foundModes.join(', ');
  }

  return result;
}

async function fetchDXpeditionData(): Promise<DXpedition[]> {
  try {
    // Check cache first
    const now = Date.now();
    if (cachedData && (now - cacheTimestamp) < CACHE_DURATION) {
      return cachedData;
    }

    // Fetch data from NG3K
    // Data source: https://ng3k.com/misc/adxo.html
    const response = await fetch('https://ng3k.com/misc/adxo.html', {
      headers: {
        'User-Agent': 'NextLog DXpedition Widget (https://github.com/yourusername/nextlog)'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch NG3K data: ${response.status}`);
    }

    const html = await response.text();

    // Use node-html-parser for better Next.js compatibility
    const { parse } = await import('node-html-parser');
    const root = parse(html);
    const dxpeditions: DXpedition[] = [];
    const currentDate = new Date();

    // Find the table with DXpedition data
    const rows = root.querySelectorAll('table tr');

    for (const row of rows) {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 6) {
        try {
          const startDateText = cells[0].text.trim();
          const endDateText = cells[1].text.trim();
          const dxcc = cells[2].text.trim();
          const callsignRaw = cells[3].text.trim();
          const qslVia = cells[4].text.trim();
          const info = cells[5].text.trim(); // Info column is the 6th column (index 5)

          // Extract callsign (remove [spots] if present)
          const callsign = callsignRaw.replace(/\s*\[spots\]\s*/g, '').trim();

          // Skip rows without valid data or header rows
          if (!startDateText || !callsign || startDateText.includes('Start') || startDateText.includes('Date')) {
            continue;
          }

          const startDate = parseDate(startDateText);
          const endDate = parseDate(endDateText);

          // Extract bands and modes from info
          const { bands, modes } = extractBandsAndModes(info);

          // Determine status
          const start = new Date(startDate);
          const end = new Date(endDate);
          let status: 'upcoming' | 'active' | 'completed';

          if (currentDate >= start && currentDate <= end) {
            status = 'active';
          } else if (currentDate > end) {
            status = 'completed';
          } else {
            status = 'upcoming';
          }

          dxpeditions.push({
            callsign,
            dxcc,
            startDate,
            endDate,
            bands,
            modes,
            qslVia: qslVia || undefined,
            info: info || undefined,
            status
          });
        } catch (e) {
          console.error('Error parsing row:', e);
        }
      }
    }

    // Update cache
    cachedData = dxpeditions;
    cacheTimestamp = Date.now();

    return dxpeditions;
  } catch (error) {
    console.error('Error fetching DXpedition data:', error);
    // Return cached data if available, even if stale
    if (cachedData) {
      console.log('Using stale cache due to fetch error');
      return cachedData;
    }
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