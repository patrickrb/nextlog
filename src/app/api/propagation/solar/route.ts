import { NextResponse } from 'next/server';
import { Propagation } from '@/models/Propagation';
import { SolarActivity } from '@/types/propagation';

/**
 * Fetch solar activity data from NOAA Space Weather API
 */
export async function GET() {
  try {
    // Try to fetch from NOAA APIs
    let solarActivity: SolarActivity;
    let dataSource = 'NOAA';
    
    try {
      // Fetch solar flux data from NOAA
      const solarFluxResponse = await fetch(
        'https://services.swpc.noaa.gov/json/solar-cycle/solar-cycle-indices.json',
        { next: { revalidate: 3600 } } // Cache for 1 hour
      );
      
      // Fetch geomagnetic data from NOAA
      const geomagResponse = await fetch(
        'https://services.swpc.noaa.gov/json/planetary_k_index_1m.json',
        { next: { revalidate: 3600 } } // Cache for 1 hour
      );
      
      if (!solarFluxResponse.ok || !geomagResponse.ok) {
        throw new Error('NOAA API not responding');
      }
      
      const solarFluxData = await solarFluxResponse.json();
      const geomagData = await geomagResponse.json();
      
      // Process the latest data
      const latestSolarFlux = solarFluxData[solarFluxData.length - 1];
      const latestGeomag = geomagData[geomagData.length - 1];
      
      if (!latestSolarFlux || !latestGeomag) {
        throw new Error('No recent space weather data available from NOAA');
      }
      
      // Create solar activity record from NOAA data
      solarActivity = {
        timestamp: new Date(latestSolarFlux.time_tag || latestGeomag.time_tag),
        solar_flux_index: parseFloat(latestSolarFlux.observed || latestSolarFlux.predicted || '100'),
        a_index: parseFloat(latestGeomag.a_running || '10'),
        k_index: parseFloat(latestGeomag.kp || '2')
        // solar_wind_speed, solar_wind_density, xray_class are optional and not available in free API
      };
      
    } catch (noaaError) {
      console.warn('NOAA API unavailable, using realistic simulated data:', noaaError);
      // Fall back to simulated realistic data
      solarActivity = Propagation.generateRealisticSolarActivity();
      dataSource = 'Simulated';
    }
    
    // Try to save to database, but continue if database is unavailable
    let savedActivity = solarActivity;
    let forecast = null;
    let databaseAvailable = true;
    
    try {
      savedActivity = await Propagation.saveSolarActivity(solarActivity);
      
      // Save forecast
      forecast = await Propagation.savePropagationForecast({
        timestamp: new Date(),
        forecast_for: new Date(),
        band_conditions: Propagation.calculateBandConditions(savedActivity),
        general_conditions: calculateGeneralConditions(savedActivity),
        notes: `Automated forecast based on ${dataSource} space weather data`,
        source: dataSource
      });
    } catch (dbError) {
      console.warn('Database unavailable, using in-memory data only:', dbError);
      databaseAvailable = false;
      // Add IDs and timestamps for consistency
      savedActivity = {
        ...solarActivity,
        id: Math.floor(Math.random() * 1000000),
        created_at: new Date(),
        updated_at: new Date()
      };
    }
    
    // Calculate band conditions
    const bandConditions = Propagation.calculateBandConditions(savedActivity);
    
    return NextResponse.json({
      success: true,
      solar_activity: savedActivity,
      band_conditions: bandConditions,
      forecast: forecast,
      data_source: databaseAvailable ? dataSource : `${dataSource} (No DB)`,
      updated_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Solar data fetch error:', error);
    
    // If everything fails, provide fallback data
    try {
      const fallbackSolarActivity = Propagation.generateRealisticSolarActivity();
      const fallbackBandConditions = Propagation.generateRealisticFallbackConditions();
      
      return NextResponse.json({
        success: true,
        solar_activity: {
          ...fallbackSolarActivity,
          id: Math.floor(Math.random() * 1000000),
          created_at: new Date(),
          updated_at: new Date()
        },
        band_conditions: fallbackBandConditions,
        forecast: null,
        data_source: 'Fallback',
        updated_at: new Date().toISOString()
      });
    } catch (fallbackError) {
      console.error('Even fallback failed:', fallbackError);
      
      return NextResponse.json({
        success: false,
        error: 'Unable to generate propagation data',
        solar_activity: null,
        band_conditions: [],
        forecast: null
      }, { status: 500 });
    }
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