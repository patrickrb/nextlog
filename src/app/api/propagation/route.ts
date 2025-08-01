import { NextResponse } from 'next/server';
import { Propagation } from '@/models/Propagation';

/**
 * Get current propagation conditions
 */
export async function GET() {
  try {
    // Get latest solar activity
    const solarActivity = await Propagation.getLatestSolarActivity();
    
    // Get current band conditions
    const bandConditions = await Propagation.getCurrentBandConditions();
    
    // Get current forecast
    const forecast = await Propagation.getCurrentForecast();
    
    return NextResponse.json({
      success: true,
      solar_activity: solarActivity,
      band_conditions: bandConditions,
      forecast: forecast,
      updated_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Propagation data fetch error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      solar_activity: null,
      band_conditions: [],
      forecast: null
    }, { status: 500 });
  }
}