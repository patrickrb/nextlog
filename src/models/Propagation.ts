import { query } from '@/lib/db';
import { SolarActivity, PropagationForecast, BandCondition, PropagationAlert } from '@/types/propagation';

export class Propagation {
  /**
   * Save solar activity data
   */
  static async saveSolarActivity(data: Omit<SolarActivity, 'id' | 'created_at' | 'updated_at'>): Promise<SolarActivity> {
    const sql = `
      INSERT INTO solar_activity (
        timestamp, solar_flux_index, a_index, k_index, 
        solar_wind_speed, solar_wind_density, xray_class
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (timestamp) DO UPDATE SET
        solar_flux_index = EXCLUDED.solar_flux_index,
        a_index = EXCLUDED.a_index,
        k_index = EXCLUDED.k_index,
        solar_wind_speed = EXCLUDED.solar_wind_speed,
        solar_wind_density = EXCLUDED.solar_wind_density,
        xray_class = EXCLUDED.xray_class,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    const result = await query(sql, [
      data.timestamp,
      data.solar_flux_index,
      data.a_index,
      data.k_index,
      data.solar_wind_speed || null,
      data.solar_wind_density || null,
      data.xray_class || null
    ]);
    
    return result.rows[0];
  }

  /**
   * Get latest solar activity data
   */
  static async getLatestSolarActivity(): Promise<SolarActivity | null> {
    const sql = `
      SELECT * FROM solar_activity 
      ORDER BY timestamp DESC 
      LIMIT 1
    `;
    
    const result = await query(sql);
    return result.rows[0] || null;
  }

  /**
   * Get solar activity for a date range
   */
  static async getSolarActivityRange(startDate: Date, endDate: Date): Promise<SolarActivity[]> {
    const sql = `
      SELECT * FROM solar_activity 
      WHERE timestamp BETWEEN $1 AND $2
      ORDER BY timestamp ASC
    `;
    
    const result = await query(sql, [startDate, endDate]);
    return result.rows;
  }

  /**
   * Save propagation forecast
   */
  static async savePropagationForecast(data: Omit<PropagationForecast, 'id' | 'created_at'>): Promise<PropagationForecast> {
    const sql = `
      INSERT INTO propagation_forecasts (
        timestamp, forecast_for, band_conditions, general_conditions, notes, source
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const result = await query(sql, [
      data.timestamp,
      data.forecast_for,
      JSON.stringify(data.band_conditions),
      data.general_conditions,
      data.notes || null,
      data.source
    ]);
    
    const forecast = result.rows[0];
    forecast.band_conditions = JSON.parse(forecast.band_conditions);
    return forecast;
  }

  /**
   * Get current propagation forecast
   */
  static async getCurrentForecast(): Promise<PropagationForecast | null> {
    const sql = `
      SELECT * FROM propagation_forecasts 
      WHERE forecast_for >= CURRENT_TIMESTAMP
      ORDER BY forecast_for ASC 
      LIMIT 1
    `;
    
    const result = await query(sql);
    if (result.rows[0]) {
      const forecast = result.rows[0];
      forecast.band_conditions = JSON.parse(forecast.band_conditions);
      return forecast;
    }
    return null;
  }

  /**
   * Get band conditions for current time
   */
  static async getCurrentBandConditions(): Promise<BandCondition[]> {
    const forecast = await this.getCurrentForecast();
    if (forecast && forecast.band_conditions) {
      return forecast.band_conditions;
    }
    
    // Return default conditions if no forecast available
    const defaultBands = ['160M', '80M', '40M', '30M', '20M', '17M', '15M', '12M', '10M', '6M'];
    return defaultBands.map(band => ({
      band,
      condition: 'fair' as const,
      confidence: 50,
      predicted_for: new Date(),
      updated_at: new Date()
    }));
  }

  /**
   * Create propagation alert
   */
  static async createAlert(data: Omit<PropagationAlert, 'id' | 'created_at'>): Promise<PropagationAlert> {
    const sql = `
      INSERT INTO propagation_alerts (
        user_id, alert_type, severity, title, message, is_active, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const result = await query(sql, [
      data.user_id,
      data.alert_type,
      data.severity,
      data.title,
      data.message,
      data.is_active,
      data.expires_at || null
    ]);
    
    return result.rows[0];
  }

  /**
   * Get active alerts for user
   */
  static async getActiveAlerts(userId: number): Promise<PropagationAlert[]> {
    const sql = `
      SELECT * FROM propagation_alerts 
      WHERE user_id = $1 
        AND is_active = true 
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      ORDER BY created_at DESC
    `;
    
    const result = await query(sql, [userId]);
    return result.rows;
  }

  /**
   * Calculate simple band conditions based on solar activity
   */
  static calculateBandConditions(solarActivity: SolarActivity): BandCondition[] {
    const bands = ['160M', '80M', '40M', '30M', '20M', '17M', '15M', '12M', '10M', '6M'];
    const now = new Date();
    
    return bands.map(band => {
      let condition: BandCondition['condition'] = 'fair';
      let confidence = 50;
      
      // Simple algorithm based on solar flux and geomagnetic activity
      const sfi = solarActivity.solar_flux_index;
      const kIndex = solarActivity.k_index;
      
      // High bands (10M-15M) favor high solar flux
      if (['10M', '12M', '15M'].includes(band)) {
        if (sfi > 150 && kIndex < 3) {
          condition = 'excellent';
          confidence = 85;
        } else if (sfi > 120 && kIndex < 4) {
          condition = 'good';
          confidence = 75;
        } else if (sfi < 80 || kIndex > 5) {
          condition = 'poor';
          confidence = 70;
        }
      }
      
      // Mid bands (17M-30M) are most reliable
      if (['17M', '20M', '30M'].includes(band)) {
        if (kIndex < 3) {
          condition = 'good';
          confidence = 80;
        } else if (kIndex > 5) {
          condition = 'fair';
          confidence = 65;
        }
        if (sfi > 120) confidence += 10;
      }
      
      // Low bands (40M-160M) favor low geomagnetic activity
      if (['40M', '80M', '160M'].includes(band)) {
        if (kIndex < 2) {
          condition = 'good';
          confidence = 75;
        } else if (kIndex > 4) {
          condition = 'poor';
          confidence = 70;
        }
      }
      
      return {
        band,
        condition,
        confidence,
        predicted_for: now,
        updated_at: now
      };
    });
  }
}