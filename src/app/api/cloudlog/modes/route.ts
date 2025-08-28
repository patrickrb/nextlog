// Cloudlog-compatible Modes API endpoint
// GET: Retrieve available amateur radio modes

import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey } from '@/lib/api-auth';
import { addCorsHeaders, createCorsPreflightResponse } from '@/lib/cors';

// Standard amateur radio modes organized by category
const AMATEUR_MODES = {
  'Phone': [
    { mode: 'SSB', name: 'Single Sideband', category: 'Phone' },
    { mode: 'USB', name: 'Upper Sideband', category: 'Phone' },
    { mode: 'LSB', name: 'Lower Sideband', category: 'Phone' },
    { mode: 'FM', name: 'Frequency Modulation', category: 'Phone' },
    { mode: 'AM', name: 'Amplitude Modulation', category: 'Phone' },
    { mode: 'PM', name: 'Phase Modulation', category: 'Phone' },
    { mode: 'FREEDV', name: 'FreeDV Digital Voice', category: 'Phone' }
  ],
  'CW': [
    { mode: 'CW', name: 'Continuous Wave', category: 'CW' }
  ],
  'Digital': [
    { mode: 'FT8', name: 'FT8', category: 'Digital' },
    { mode: 'FT4', name: 'FT4', category: 'Digital' },
    { mode: 'PSK31', name: 'Phase Shift Keying 31', category: 'Digital' },
    { mode: 'PSK63', name: 'Phase Shift Keying 63', category: 'Digital' },
    { mode: 'PSK125', name: 'Phase Shift Keying 125', category: 'Digital' },
    { mode: 'RTTY', name: 'Radio Teletype', category: 'Digital' },
    { mode: 'JT65', name: 'JT65', category: 'Digital' },
    { mode: 'JT9', name: 'JT9', category: 'Digital' },
    { mode: 'MFSK', name: 'Multi-FSK', category: 'Digital' },
    { mode: 'OLIVIA', name: 'Olivia', category: 'Digital' },
    { mode: 'CONTESTIA', name: 'Contestia', category: 'Digital' },
    { mode: 'THOR', name: 'THOR', category: 'Digital' },
    { mode: 'DOMINO', name: 'DominoEX', category: 'Digital' },
    { mode: 'HELL', name: 'Hellschreiber', category: 'Digital' },
    { mode: 'FLDIGI', name: 'FLDIGI', category: 'Digital' },
    { mode: 'WINMOR', name: 'WINMOR', category: 'Digital' },
    { mode: 'PACKET', name: 'Packet Radio', category: 'Digital' },
    { mode: 'PACTOR', name: 'PACTOR', category: 'Digital' },
    { mode: 'MT63', name: 'MT63', category: 'Digital' },
    { mode: 'PSK', name: 'Phase Shift Keying', category: 'Digital' },
    { mode: 'QPSK', name: 'Quadrature PSK', category: 'Digital' },
    { mode: 'FSK', name: 'Frequency Shift Keying', category: 'Digital' },
    { mode: 'MSK', name: 'Minimum Shift Keying', category: 'Digital' },
    { mode: 'GMSK', name: 'Gaussian MSK', category: 'Digital' }
  ],
  'Image': [
    { mode: 'SSTV', name: 'Slow Scan TV', category: 'Image' },
    { mode: 'FAX', name: 'Facsimile', category: 'Image' },
    { mode: 'ATV', name: 'Amateur Television', category: 'Image' }
  ],
  'Other': [
    { mode: 'UNKNOWN', name: 'Unknown Mode', category: 'Other' },
    { mode: 'OTHER', name: 'Other Mode', category: 'Other' }
  ]
};

// OPTIONS /api/cloudlog/modes - Handle CORS preflight requests
export async function OPTIONS() {
  return createCorsPreflightResponse();
}

export async function GET(request: NextRequest) {
  const authResult = await verifyApiKey(request);
  
  if (!authResult.success) {
    const response = NextResponse.json({
      success: false,
      error: authResult.error
    }, { status: authResult.statusCode || 500 });
    return addCorsHeaders(response);
  }

  const auth = authResult.auth!;
  const url = new URL(request.url);
  
  try {
    const modeFilter = url.searchParams.get('mode');
    const format = url.searchParams.get('format') || 'detailed';

    // Flatten all modes into a single array
    let allModes: string[] = [];
    Object.entries(AMATEUR_MODES).forEach(([, modes]) => {
      const modeNames = modes.map(mode => mode.mode);
      allModes = allModes.concat(modeNames);
    });

    // Apply filters
    if (modeFilter) {
      allModes = allModes.filter(m => 
        m.toUpperCase() === modeFilter.toUpperCase()
      );
    }

    // Category filter doesn't apply to flattened mode names
    // Skip category filter when modes are flattened

    let responseData;
    
    if (format === 'simple') {
      // Simple format - just mode names
      responseData = allModes;
    } else if (format === 'categories') {
      // Organized by categories
      responseData = AMATEUR_MODES;
    } else {
      // Detailed format - need to rebuild full mode information
      responseData = [];
      Object.entries(AMATEUR_MODES).forEach(([category, modes]) => {
        modes.forEach(mode => {
          if (!modeFilter || mode.mode.toUpperCase() === modeFilter.toUpperCase()) {
            responseData.push({
              mode: mode.mode,
              name: mode.name,
              category: category,
              digital: category === 'Digital',
              phone: category === 'Phone',
              cw: category === 'CW',
              image: category === 'Image'
            });
          }
        });
      });
    }

    const response = NextResponse.json({
      success: true,
      modes: responseData,
      count: Array.isArray(responseData) ? responseData.length : Object.keys(responseData).length,
      format: format,
      categories: Object.keys(AMATEUR_MODES)
    });

    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', auth.rateLimitPerHour.toString());
    response.headers.set('X-RateLimit-Remaining', '999'); // TODO: Get actual remaining
    
    return addCorsHeaders(response);

  } catch (error) {
    console.error('Modes retrieval error:', error);
    const response = NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
    return addCorsHeaders(response);
  }
}