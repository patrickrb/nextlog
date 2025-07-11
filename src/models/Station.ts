import { query, getClient } from '@/lib/db';

export interface StationData {
  id: number;
  user_id: number;
  callsign: string;
  station_name: string;
  operator_name?: string;
  qth_name?: string;
  street_address?: string;
  city?: string;
  county?: string;
  state_province?: string;
  postal_code?: string;
  country?: string;
  dxcc_entity_code?: number;
  grid_locator?: string;
  latitude?: number;
  longitude?: number;
  itu_zone?: number;
  cq_zone?: number;
  power_watts?: number;
  rig_info?: string;
  antenna_info?: string;
  station_equipment?: string;
  is_active: boolean;
  is_default: boolean;
  qrz_api_key?: string;
  club_callsign?: string;
  created_at: string;
  updated_at: string;
}
export interface StationStats {
  totalContacts: number;
  countries: number;
  modes: number;
  bands: number;
}

export interface StationModel {
  create(userId: number, data: CreateStationData): Promise<StationData>;
  findByUserId(userId: number): Promise<StationData[]>;
  findById(id: number): Promise<StationData | null>;
  findByUserIdAndId(userId: number, id: number): Promise<StationData | null>;
  findDefaultByUserId(userId: number): Promise<StationData | null>;
  update(id: number, data: Partial<CreateStationData>): Promise<StationData | null>;
  delete(id: number): Promise<boolean>;
  setDefault(userId: number, stationId: number): Promise<boolean>;
  getActiveStations(userId: number): Promise<StationData[]>;
  getStationStats(userId: number, stationId: number): Promise<StationStats>;
}
export interface CreateStationData {
  callsign: string;
  station_name: string;
  operator_name?: string;
  qth_name?: string;
  street_address?: string;
  city?: string;
  county?: string;
  state_province?: string;
  postal_code?: string;
  country?: string;
  dxcc_entity_code?: number;
  grid_locator?: string;
  latitude?: number;
  longitude?: number;
  itu_zone?: number;
  cq_zone?: number;
  power_watts?: number;
  rig_info?: string;
  antenna_info?: string;
  station_equipment?: string;
  is_active?: boolean;
  is_default?: boolean;
  qrz_api_key?: string;
  lotw_username?: string;
  club_callsign?: string;
}

/* Removed redundant UpdateStationData interface. Use Partial<CreateStationData> directly. */

export class Station {
  static async create(userId: number, data: CreateStationData): Promise<StationData> {
    const sqlQuery = `
      INSERT INTO stations (
        user_id, callsign, station_name, operator_name, qth_name,
        street_address, city, county, state_province, postal_code,
        country, dxcc_entity_code, grid_locator, latitude, longitude,
        itu_zone, cq_zone, power_watts, rig_info, antenna_info,
        station_equipment, is_active, is_default, qrz_api_key,
        club_callsign
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
      ) RETURNING *
    `;

    const values = [
      userId,
      data.callsign,
      data.station_name,
      data.operator_name || null,
      data.qth_name || null,
      data.street_address || null,
      data.city || null,
      data.county || null,
      data.state_province || null,
      data.postal_code || null,
      data.country || null,
      data.dxcc_entity_code || null,
      data.grid_locator || null,
      data.latitude || null,
      data.longitude || null,
      data.itu_zone || null,
      data.cq_zone || null,
      data.power_watts || null,
      data.rig_info || null,
      data.antenna_info || null,
      data.station_equipment || null,
      data.is_active !== undefined ? data.is_active : true,
      data.is_default !== undefined ? data.is_default : false,
      data.qrz_api_key || null,
      data.club_callsign || null,
    ];

    const result = await query(sqlQuery, values);
    return result.rows[0];
  }

  static async findByUserId(userId: number): Promise<StationData[]> {
    const sqlQuery = `
      SELECT * FROM stations 
      WHERE user_id = $1 
      ORDER BY is_default DESC, station_name ASC
    `;
    const result = await query(sqlQuery, [userId]);
    return result.rows;
  }

  static async findById(id: number): Promise<StationData | null> {
    const sqlQuery = 'SELECT * FROM stations WHERE id = $1';
    const result = await query(sqlQuery, [id]);
    return result.rows[0] || null;
  }

  static async findByUserIdAndId(userId: number, id: number): Promise<StationData | null> {
    const sqlQuery = 'SELECT * FROM stations WHERE user_id = $1 AND id = $2';
    const result = await query(sqlQuery, [userId, id]);
    return result.rows[0] || null;
  }

  static async findDefaultByUserId(userId: number): Promise<StationData | null> {
    const sqlQuery = 'SELECT * FROM stations WHERE user_id = $1 AND is_default = true';
    const result = await query(sqlQuery, [userId]);
    return result.rows[0] || null;
  }

  static async update(id: number, data: Partial<CreateStationData>): Promise<StationData | null> {
    const fields: string[] = [];
    const values = [];
    let paramCount = 1;

    // Build dynamic update query
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return null;
    }

    const sqlQuery = `
      UPDATE stations 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *
    `;
    values.push(id);

    const result = await query(sqlQuery, values);
    return result.rows[0] || null;
  }

  static async delete(id: number): Promise<boolean> {
    const sqlQuery = 'DELETE FROM stations WHERE id = $1';
    const result = await query(sqlQuery, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  static async setDefault(userId: number, stationId: number): Promise<boolean> {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Unset all defaults for this user
      await client.query(
        'UPDATE stations SET is_default = false WHERE user_id = $1',
        [userId]
      );

      // Set the new default
      const result = await client.query(
        'UPDATE stations SET is_default = true WHERE user_id = $1 AND id = $2',
        [userId, stationId]
      );

      await client.query('COMMIT');
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getActiveStations(userId: number): Promise<StationData[]> {
    const sqlQuery = `
      SELECT * FROM stations 
      WHERE user_id = $1 AND is_active = true 
      ORDER BY is_default DESC, station_name ASC
    `;
    const result = await query(sqlQuery, [userId]);
    return result.rows;
  }

  static async getStationStats(userId: number, stationId: number): Promise<{
    totalContacts: number;
    countries: number;
    modes: number;
    bands: number;
  }> {
    const sqlQuery = `
      SELECT 
        COUNT(*) as total_contacts,
        COUNT(DISTINCT qth) as countries,
        COUNT(DISTINCT mode) as modes,
        COUNT(DISTINCT band) as bands
      FROM contacts 
      WHERE user_id = $1 AND station_id = $2
    `;
    const result = await query(sqlQuery, [userId, stationId]);
    const row = result.rows[0];
    
    return {
      totalContacts: parseInt(row.total_contacts) || 0,
      countries: parseInt(row.countries) || 0,
      modes: parseInt(row.modes) || 0,
      bands: parseInt(row.bands) || 0,
    };
  }
}