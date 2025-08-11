import { query } from '@/lib/db';

export interface ContactData {
  id: number;
  user_id: number;
  station_id?: number;
  callsign: string;
  name?: string;
  frequency: number;
  mode: string;
  band: string;
  datetime: Date;
  rst_sent?: string;
  rst_received?: string;
  qth?: string;
  grid_locator?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  // DXCC and zone fields
  country?: string;
  dxcc?: number;
  cont?: string;
  cqz?: number;
  ituz?: number;
  state?: string;
  cnty?: string;
  // QSL fields
  qsl_rcvd?: string;
  qsl_sent?: string;
  qsl_via?: string;
  eqsl_qsl_rcvd?: string;
  eqsl_qsl_sent?: string;
  // LoTW fields
  lotw_qsl_rcvd?: string;
  lotw_qsl_sent?: string;
  qsl_lotw?: boolean;
  qsl_lotw_date?: Date;
  lotw_match_status?: 'confirmed' | 'partial' | 'mismatch' | null;
  // Additional fields
  qso_date_off?: Date;
  time_off?: string;
  operator?: string;
  distance?: number;
  // QRZ sync fields
  qrz_sync_status?: 'not_synced' | 'synced' | 'error' | 'already_exists';
  qrz_sync_date?: Date;
  qrz_logbook_id?: number;
  qrz_sync_error?: string;
  created_at: Date;
  updated_at: Date;
}

export class Contact {
  static async create(contactData: {
    user_id: number;
    station_id?: number;
    callsign: string;
    name?: string;
    frequency: number;
    mode: string;
    band: string;
    datetime: Date;
    rst_sent?: string;
    rst_received?: string;
    qth?: string;
    grid_locator?: string;
    latitude?: number;
    longitude?: number;
    notes?: string;
  }): Promise<ContactData> {
    const {
      user_id,
      station_id,
      callsign,
      name,
      frequency,
      mode,
      band,
      datetime,
      rst_sent,
      rst_received,
      qth,
      grid_locator,
      latitude,
      longitude,
      notes
    } = contactData;
    
    const sql = `
      INSERT INTO contacts (
        user_id, station_id, callsign, name, frequency, mode, band, datetime,
        rst_sent, rst_received, qth, grid_locator, latitude, longitude, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;
    
    const result = await query(sql, [
      user_id,
      station_id || null,
      callsign.toUpperCase().trim(),
      name ? name.trim() : null,
      frequency,
      mode.toUpperCase().trim(),
      band.toUpperCase().trim(),
      datetime,
      rst_sent ? rst_sent.trim() : null,
      rst_received ? rst_received.trim() : null,
      qth ? qth.trim() : null,
      grid_locator ? grid_locator.toUpperCase().trim() : null,
      latitude || null,
      longitude || null,
      notes ? notes.trim() : null
    ]);
    
    return result.rows[0];
  }

  static async findByUserId(userId: number, limit?: number, offset?: number): Promise<ContactData[]> {
    let sql = 'SELECT * FROM contacts WHERE user_id = $1 ORDER BY datetime DESC';
    const params = [userId];
    
    if (limit) {
      sql += ` LIMIT $${params.length + 1}`;
      params.push(limit);
    }
    
    if (offset) {
      sql += ` OFFSET $${params.length + 1}`;
      params.push(offset);
    }
    
    const result = await query(sql, params);
    return result.rows;
  }

  static async findById(id: number): Promise<ContactData | null> {
    const sql = 'SELECT * FROM contacts WHERE id = $1';
    const result = await query(sql, [id]);
    
    return result.rows[0] || null;
  }

  static async update(id: number, contactData: Partial<ContactData>): Promise<ContactData | null> {
    const fields = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(contactData)) {
      if (value !== undefined && key !== 'id' && key !== 'created_at' && key !== 'updated_at') {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (fields.length === 0) {
      return null;
    }

    values.push(id);
    const sql = `
      UPDATE contacts 
      SET ${fields.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(sql, values);
    return result.rows[0] || null;
  }

  static async delete(id: number): Promise<boolean> {
    const sql = 'DELETE FROM contacts WHERE id = $1';
    const result = await query(sql, [id]);
    
    return (result.rowCount ?? 0) > 0;
  }

  static async countByUserId(userId: number): Promise<number> {
    const sql = 'SELECT COUNT(*) FROM contacts WHERE user_id = $1';
    const result = await query(sql, [userId]);
    
    return parseInt(result.rows[0].count);
  }

  static async countByUserIdSince(userId: number, since: string): Promise<number> {
    const sql = 'SELECT COUNT(*) FROM contacts WHERE user_id = $1 AND datetime >= $2';
    const result = await query(sql, [userId, since]);
    
    return parseInt(result.rows[0].count);
  }

  static async findByStationId(stationId: number, limit?: number, offset?: number): Promise<ContactData[]> {
    let sql = 'SELECT * FROM contacts WHERE station_id = $1 ORDER BY datetime DESC';
    const params = [stationId];
    
    if (limit) {
      sql += ` LIMIT $${params.length + 1}`;
      params.push(limit);
    }
    
    if (offset) {
      sql += ` OFFSET $${params.length + 1}`;
      params.push(offset);
    }
    
    const result = await query(sql, params);
    return result.rows;
  }

  static async findByUserIdAndStationId(userId: number, stationId: number, limit?: number, offset?: number): Promise<ContactData[]> {
    let sql = 'SELECT * FROM contacts WHERE user_id = $1 AND station_id = $2 ORDER BY datetime DESC';
    const params = [userId, stationId];
    
    if (limit) {
      sql += ` LIMIT $${params.length + 1}`;
      params.push(limit);
    }
    
    if (offset) {
      sql += ` OFFSET $${params.length + 1}`;
      params.push(offset);
    }
    
    const result = await query(sql, params);
    return result.rows;
  }

  static async countByStationId(stationId: number): Promise<number> {
    const sql = 'SELECT COUNT(*) FROM contacts WHERE station_id = $1';
    const result = await query(sql, [stationId]);
    
    return parseInt(result.rows[0].count);
  }

  static async findWithStation(userId: number, limit?: number, offset?: number): Promise<(ContactData & { station?: { id: number; callsign: string; station_name: string } })[]> {
    let sql = `
      SELECT 
        c.*,
        s.id as station_id,
        s.callsign as station_callsign,
        s.station_name as station_name
      FROM contacts c
      LEFT JOIN stations s ON c.station_id = s.id
      WHERE c.user_id = $1
      ORDER BY c.datetime DESC
    `;
    const params = [userId];
    
    if (limit) {
      sql += ` LIMIT $${params.length + 1}`;
      params.push(limit);
    }
    
    if (offset) {
      sql += ` OFFSET $${params.length + 1}`;
      params.push(offset);
    }
    
    const result = await query(sql, params);
    return result.rows.map(row => ({
      ...row,
      station: row.station_id ? {
        id: row.station_id,
        callsign: row.station_callsign,
        station_name: row.station_name
      } : undefined
    }));
  }

  static async updateQrzSyncStatus(
    id: number, 
    status: 'not_synced' | 'synced' | 'error' | 'already_exists',
    qrz_logbook_id?: number,
    error?: string
  ): Promise<ContactData | null> {
    const sql = `
      UPDATE contacts 
      SET qrz_sync_status = $1, qrz_sync_date = CURRENT_TIMESTAMP, qrz_logbook_id = $2, qrz_sync_error = $3
      WHERE id = $4
      RETURNING *
    `;
    
    const result = await query(sql, [status, qrz_logbook_id || null, error || null, id]);
    return result.rows[0] || null;
  }

  static async findNotSynced(userId: number, limit?: number): Promise<ContactData[]> {
    let sql = `
      SELECT * FROM contacts 
      WHERE user_id = $1 AND (qrz_sync_status = 'not_synced' OR qrz_sync_status = 'error')
      ORDER BY datetime DESC
    `;
    const params = [userId];
    
    if (limit) {
      sql += ` LIMIT $${params.length + 1}`;
      params.push(limit);
    }
    
    const result = await query(sql, params);
    return result.rows;
  }
}