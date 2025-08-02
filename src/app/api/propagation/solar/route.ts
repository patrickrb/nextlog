import { NextResponse } from 'next/server';
import { Propagation } from '@/models/Propagation';
import { SolarActivity } from '@/types/propagation';

/**
 * Fetch solar activity data from NOAA Space Weather API
 */
export async function GET() {
  try {
    // Fetch solar flux data from NOAA
    const solarFluxResponse = await fetch(
      'https://services.swpc.noaa.gov/json/solar-cycle/solar-cycle-indices.json',
      { next: { revalidate: 3600 } } // Cache for 1 hour
    );
    
    if (!solarFluxResponse.ok) {
      throw new Error('Failed to fetch solar flux data');
    }
    
    const solarFluxData = await solarFluxResponse.json();
    
    // Fetch geomagnetic data from NOAA
    const geomagResponse = await fetch(
      'https://services.swpc.noaa.gov/json/planetary_k_index_1m.json',
      { next: { revalidate: 3600 } } // Cache for 1 hour
    );
    
    if (!geomagResponse.ok) {
      throw new Error('Failed to fetch geomagnetic data');
    }
    
    const geomagData = await geomagResponse.json();
    
    // Process the latest data
    const latestSolarFlux = solarFluxData[solarFluxData.length - 1];
    const latestGeomag = geomagData[geomagData.length - 1];
    
    if (!latestSolarFlux || !latestGeomag) {
      throw new Error('No recent space weather data available');
    }
    
    // Create solar activity record
    const solarActivity = {
      timestamp: new Date(latestSolarFlux.time_tag || latestGeomag.time_tag),
      solar_flux_index: parseFloat(latestSolarFlux.observed || latestSolarFlux.predicted || '100'),
      a_index: parseFloat(latestGeomag.a_running || '10'),
      k_index: parseFloat(latestGeomag.kp || '2')
      // solar_wind_speed, solar_wind_density, xray_class are optional and not available in free API
    };
    
    // Save to database
    const savedActivity = await Propagation.saveSolarActivity(solarActivity);
    
    // Calculate band conditions
    const bandConditions = Propagation.calculateBandConditions(savedActivity);
    
    // Save forecast
    const forecast = await Propagation.savePropagationForecast({
      timestamp: new Date(),
      forecast_for: new Date(),
      band_conditions: bandConditions,
      general_conditions: calculateGeneralConditions(savedActivity),
      notes: 'Automated forecast based on NOAA space weather data',
      source: 'NOAA'
    });
    
    return NextResponse.json({
      success: true,
      solar_activity: savedActivity,
      band_conditions: bandConditions,
      forecast: forecast,
      updated_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Solar data fetch error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      solar_activity: null,
      band_conditions: [],
      forecast: null
    }, { status: 500 });
  }
}

/**
 * Calculate general propagation conditions
 */
function calculateGeneralConditions(solarActivity: SolarActivity): 'poor' | 'fair' | 'good' | 'excellent' {
  const sfi = solarActivity.solar_flux_index;
  const kIndex = solarActivity.k_index;
  
  if (sfi > 150 && kIndex < 2) return 'excellent';
  if (sfi > 120 && kIndex < 3) return 'good';
  if (sfi < 80 || kIndex > 5) return 'poor';
  return 'fair';
}