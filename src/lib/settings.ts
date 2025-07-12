// System settings management for NodeLog
import { query } from './db';

export interface SystemSetting {
  id: number;
  setting_key: string;
  setting_value: string;
  data_type: 'string' | 'number' | 'boolean' | 'json';
  category: string;
  description?: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  updated_by?: number;
}

export interface SettingValue {
  string: string;
  number: number;
  boolean: boolean;
  json: unknown;
}

// Default values for critical settings (fallbacks)
const DEFAULT_SETTINGS = {
  adif_max_file_size_mb: 10,
  adif_max_record_count: 5000,
  adif_batch_size: 50,
  adif_timeout_seconds: 25,
  app_name: 'NodeLog',
  app_description: 'Amateur Radio Contact Logging System',
  default_timezone: 'UTC',
  enable_registration: true,
  max_stations_per_user: 10,
  contact_pagination_default: 20
} as const;

/**
 * Get a system setting value with type safety
 */
export async function getSetting<T extends keyof typeof DEFAULT_SETTINGS>(
  key: T
): Promise<typeof DEFAULT_SETTINGS[T]> {
  try {
    const result = await query(
      'SELECT setting_value, data_type FROM system_settings WHERE setting_key = $1',
      [key]
    );

    if (result.rows.length === 0) {
      console.warn(`Setting ${key} not found, using default value`);
      return DEFAULT_SETTINGS[key];
    }

    const setting = result.rows[0];
    return parseSettingValue(setting.setting_value, setting.data_type) as typeof DEFAULT_SETTINGS[T];
  } catch (error) {
    console.error(`Error fetching setting ${key}:`, error);
    return DEFAULT_SETTINGS[key];
  }
}

/**
 * Get multiple settings at once
 */
export async function getSettings(keys: string[]): Promise<Record<string, unknown>> {
  try {
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(',');
    const result = await query(
      `SELECT setting_key, setting_value, data_type FROM system_settings WHERE setting_key IN (${placeholders})`,
      keys
    );

    const settings: Record<string, unknown> = {};
    
    // Add found settings
    result.rows.forEach(row => {
      settings[row.setting_key] = parseSettingValue(row.setting_value, row.data_type);
    });

    // Add defaults for missing settings
    keys.forEach(key => {
      if (!(key in settings) && key in DEFAULT_SETTINGS) {
        settings[key] = DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS];
      }
    });

    return settings;
  } catch (error) {
    console.error('Error fetching settings:', error);
    // Return defaults for all requested keys
    const defaults: Record<string, unknown> = {};
    keys.forEach(key => {
      if (key in DEFAULT_SETTINGS) {
        defaults[key] = DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS];
      }
    });
    return defaults;
  }
}

/**
 * Get all settings by category
 */
export async function getSettingsByCategory(category: string): Promise<SystemSetting[]> {
  try {
    const result = await query(
      'SELECT * FROM system_settings WHERE category = $1 ORDER BY setting_key',
      [category]
    );
    return result.rows;
  } catch (error) {
    console.error(`Error fetching settings for category ${category}:`, error);
    return [];
  }
}

/**
 * Get all settings (admin only)
 */
export async function getAllSettings(): Promise<SystemSetting[]> {
  try {
    const result = await query(
      'SELECT * FROM system_settings ORDER BY category, setting_key'
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching all settings:', error);
    return [];
  }
}

/**
 * Update a system setting
 */
export async function updateSetting(
  key: string,
  value: string | number | boolean,
  updatedBy?: number
): Promise<boolean> {
  try {
    const stringValue = String(value);
    const updateParams = updatedBy 
      ? [stringValue, updatedBy, key]
      : [stringValue, key];
    
    const updateQuery = updatedBy
      ? 'UPDATE system_settings SET setting_value = $1, updated_by = $2 WHERE setting_key = $3'
      : 'UPDATE system_settings SET setting_value = $1 WHERE setting_key = $2';

    const result = await query(updateQuery, updateParams);
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error(`Error updating setting ${key}:`, error);
    return false;
  }
}

/**
 * Create a new system setting
 */
export async function createSetting(
  key: string,
  value: string | number | boolean,
  dataType: SystemSetting['data_type'],
  category: string,
  description?: string,
  isPublic = false,
  createdBy?: number
): Promise<boolean> {
  try {
    const result = await query(
      `INSERT INTO system_settings 
       (setting_key, setting_value, data_type, category, description, is_public, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [key, String(value), dataType, category, description || null, isPublic, createdBy || null]
    );
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error(`Error creating setting ${key}:`, error);
    return false;
  }
}

/**
 * Delete a system setting
 */
export async function deleteSetting(key: string): Promise<boolean> {
  try {
    const result = await query(
      'DELETE FROM system_settings WHERE setting_key = $1',
      [key]
    );
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error(`Error deleting setting ${key}:`, error);
    return false;
  }
}

/**
 * Parse setting value based on data type
 */
function parseSettingValue(value: string, dataType: string): unknown {
  switch (dataType) {
    case 'number':
      const num = parseFloat(value);
      return isNaN(num) ? 0 : num;
    case 'boolean':
      return value.toLowerCase() === 'true';
    case 'json':
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    case 'string':
    default:
      return value;
  }
}

/**
 * Get ADIF import settings (convenience function)
 */
export async function getAdifImportSettings() {
  return await getSettings([
    'adif_max_file_size_mb',
    'adif_max_record_count', 
    'adif_batch_size',
    'adif_timeout_seconds'
  ]);
}