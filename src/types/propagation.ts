// Propagation prediction types for Nextlog

export interface SolarActivity {
  id?: number;
  timestamp: Date;
  solar_flux_index: number; // 10.7cm Solar Flux (SFI)
  a_index: number; // Geomagnetic A-index (daily)
  k_index: number; // Geomagnetic K-index (3-hour)
  solar_wind_speed?: number; // km/s
  solar_wind_density?: number; // protons/cm³
  xray_class?: string; // Solar flare class (A, B, C, M, X)
  created_at?: Date;
  updated_at?: Date;
}

export interface BandCondition {
  band: string; // "80M", "40M", "20M", etc.
  condition: 'poor' | 'fair' | 'good' | 'excellent';
  confidence: number; // 0-100
  predicted_for: Date;
  updated_at: Date;
}

export interface PropagationForecast {
  id?: number;
  timestamp: Date;
  forecast_for: Date;
  band_conditions: BandCondition[];
  general_conditions: 'poor' | 'fair' | 'good' | 'excellent';
  notes?: string;
  source: string; // 'NOAA', 'manual', etc.
  created_at?: Date;
}

export interface PathAnalysis {
  from_locator: string;
  to_locator: string;
  distance_km: number;
  bearing: number;
  reverse_bearing: number;
  great_circle_path: Array<{ lat: number; lon: number }>;
  calculated_at: Date;
}

export interface PropagationAlert {
  id?: number;
  user_id: number;
  alert_type: 'solar_storm' | 'enhanced_propagation' | 'band_opening' | 'aurora';
  severity: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  is_active: boolean;
  expires_at?: Date;
  created_at: Date;
}

// NOAA Space Weather API response types
export interface NOAASpaceWeatherResponse {
  begin_time: string;
  time_tag: string;
  source: string;
  flux: number; // Solar flux 10.7cm
  observed: string;
}

export interface NOAAGeomagneticResponse {
  time_tag: string;
  kp_index: number;
  a_index: number;
  station_count: number;
}

// Ham radio band definitions
export const HF_BANDS = [
  { name: '160M', frequency_mhz: 1.8 },
  { name: '80M', frequency_mhz: 3.5 },
  { name: '60M', frequency_mhz: 5.3 },
  { name: '40M', frequency_mhz: 7.0 },
  { name: '30M', frequency_mhz: 10.1 },
  { name: '20M', frequency_mhz: 14.0 },
  { name: '17M', frequency_mhz: 18.1 },
  { name: '15M', frequency_mhz: 21.0 },
  { name: '12M', frequency_mhz: 24.9 },
  { name: '10M', frequency_mhz: 28.0 },
  { name: '6M', frequency_mhz: 50.0 }
] as const;

export type BandName = typeof HF_BANDS[number]['name'];