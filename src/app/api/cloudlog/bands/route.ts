// Cloudlog-compatible Bands API endpoint
// GET: Retrieve available amateur radio bands

import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey } from '@/lib/api-auth';
import { addCorsHeaders, createCorsPreflightResponse } from '@/lib/cors';
import { addRateLimitHeaders } from '@/lib/api-utils';

// Standard amateur radio bands with frequencies
const AMATEUR_BANDS = [
  { band: '2190M', freq_start: 0.1357, freq_end: 0.1378, wavelength: '2190 meters' },
  { band: '630M', freq_start: 0.472, freq_end: 0.479, wavelength: '630 meters' },
  { band: '560M', freq_start: 0.501, freq_end: 0.504, wavelength: '560 meters' },
  { band: '160M', freq_start: 1.8, freq_end: 2.0, wavelength: '160 meters' },
  { band: '80M', freq_start: 3.5, freq_end: 4.0, wavelength: '80 meters' },
  { band: '60M', freq_start: 5.06, freq_end: 5.45, wavelength: '60 meters' },
  { band: '40M', freq_start: 7.0, freq_end: 7.3, wavelength: '40 meters' },
  { band: '30M', freq_start: 10.1, freq_end: 10.15, wavelength: '30 meters' },
  { band: '20M', freq_start: 14.0, freq_end: 14.35, wavelength: '20 meters' },
  { band: '17M', freq_start: 18.068, freq_end: 18.168, wavelength: '17 meters' },
  { band: '15M', freq_start: 21.0, freq_end: 21.45, wavelength: '15 meters' },
  { band: '12M', freq_start: 24.89, freq_end: 24.99, wavelength: '12 meters' },
  { band: '10M', freq_start: 28.0, freq_end: 29.7, wavelength: '10 meters' },
  { band: '6M', freq_start: 50.0, freq_end: 54.0, wavelength: '6 meters' },
  { band: '4M', freq_start: 70.0, freq_end: 70.5, wavelength: '4 meters' },
  { band: '2M', freq_start: 144.0, freq_end: 148.0, wavelength: '2 meters' },
  { band: '1.25M', freq_start: 222.0, freq_end: 225.0, wavelength: '1.25 meters' },
  { band: '70CM', freq_start: 420.0, freq_end: 450.0, wavelength: '70 centimeters' },
  { band: '33CM', freq_start: 902.0, freq_end: 928.0, wavelength: '33 centimeters' },
  { band: '23CM', freq_start: 1240.0, freq_end: 1300.0, wavelength: '23 centimeters' },
  { band: '13CM', freq_start: 2300.0, freq_end: 2450.0, wavelength: '13 centimeters' },
  { band: '9CM', freq_start: 3300.0, freq_end: 3500.0, wavelength: '9 centimeters' },
  { band: '6CM', freq_start: 5650.0, freq_end: 5925.0, wavelength: '6 centimeters' },
  { band: '3CM', freq_start: 10000.0, freq_end: 10500.0, wavelength: '3 centimeters' },
  { band: '1.25CM', freq_start: 24000.0, freq_end: 24250.0, wavelength: '1.25 centimeters' },
  { band: '6MM', freq_start: 47000.0, freq_end: 47200.0, wavelength: '6 millimeters' },
  { band: '4MM', freq_start: 75500.0, freq_end: 81000.0, wavelength: '4 millimeters' },
  { band: '2.5MM', freq_start: 119980.0, freq_end: 120020.0, wavelength: '2.5 millimeters' },
  { band: '2MM', freq_start: 142000.0, freq_end: 149000.0, wavelength: '2 millimeters' },
  { band: '1MM', freq_start: 241000.0, freq_end: 250000.0, wavelength: '1 millimeter' }
];

// OPTIONS /api/cloudlog/bands - Handle CORS preflight requests
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
    const bandFilter = url.searchParams.get('band');
    const format = url.searchParams.get('format') || 'detailed';

    let bands = AMATEUR_BANDS;

    // Filter by specific band if requested
    if (bandFilter) {
      bands = bands.filter(b =>
        b.band.toUpperCase() === bandFilter.toUpperCase()
      );
    }

    let responseData;

    if (format === 'simple') {
      // Simple format - just band names
      responseData = bands.map(b => b.band);
    } else {
      // Detailed format - full band information
      responseData = bands.map(band => ({
        band: band.band,
        frequency_start_mhz: band.freq_start,
        frequency_end_mhz: band.freq_end,
        wavelength: band.wavelength,
        type: band.band.includes('M') ? 'HF/VHF/UHF' :
          band.band.includes('CM') ? 'Microwave' : 'Millimeter'
      }));
    }

    const response = NextResponse.json({
      success: true,
      bands: responseData,
      count: responseData.length,
      format: format
    });

    // Add rate limit headers
    addRateLimitHeaders(response, 999, auth.rateLimitPerHour);

    return addCorsHeaders(response);

  } catch (error) {
    console.error('Bands retrieval error:', error);
    const response = NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
    return addCorsHeaders(response);
  }
}