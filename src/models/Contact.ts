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
  // QRZ QSL fields
  qrz_qsl_sent?: string;
  qrz_qsl_rcvd?: string;
  qrz_qsl_sent_date?: Date;
  qrz_qsl_rcvd_date?: Date;
  // QRZ sync fields
  qrz_sync_status?: 'not_synced' | 'synced' | 'error' | 'already_exists';
  qrz_sync_date?: Date;
  qrz_logbook_id?: number;
  qrz_sync_error?: string;
  // Additional fields
  qso_date_off?: Date;
  time_off?: string;
  operator?: string;
  distance?: number;
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

  static async updateQrzQsl(
    id: number, 
    qslSent?: 'Y' | 'N' | 'R' | 'Q',
    qslRcvd?: 'Y' | 'N' | 'R' | 'Q'
  ): Promise<ContactData | null> {
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (qslSent !== undefined) {
      updates.push(`qrz_qsl_sent = $${paramCount}`);
      values.push(qslSent);
      paramCount++;
      
      if (qslSent === 'Y') {
        updates.push(`qrz_qsl_sent_date = CURRENT_DATE`);
      }
    }
    
    if (qslRcvd !== undefined) {
      updates.push(`qrz_qsl_rcvd = $${paramCount}`);
      values.push(qslRcvd);
      paramCount++;
      
      if (qslRcvd === 'Y') {
        updates.push(`qrz_qsl_rcvd_date = CURRENT_DATE`);
      }
    }
    
    if (updates.length === 0) {
      return null;
    }
    
    values.push(id);
    const sql = `
      UPDATE contacts 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    const result = await query(sql, values);
    return result.rows[0] || null;
  }

  static async findQrzNotSent(userId: number, limit?: number): Promise<ContactData[]> {
    let sql = `
      SELECT * FROM contacts 
      WHERE user_id = $1 AND (qrz_qsl_sent IS NULL OR qrz_qsl_sent != 'Y')
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

  static async findQrzSentNotConfirmed(userId: number, limit?: number): Promise<ContactData[]> {
    let sql = `
      SELECT * FROM contacts 
      WHERE user_id = $1 AND qrz_qsl_sent = 'Y' AND (qrz_qsl_rcvd IS NULL OR qrz_qsl_rcvd != 'Y')
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

  // Helper function to match QSO records by callsign, date, and time
  static matchQSO(contact: ContactData, qrzQSO: { call: string; qso_date: string; time_on: string }): boolean {
    if (!contact.callsign || !qrzQSO.call) return false;
    
    // Normalize callsigns for comparison
    const contactCall = contact.callsign.toUpperCase().trim();
    const qrzCall = qrzQSO.call.toUpperCase().trim();
    
    if (contactCall !== qrzCall) return false;
    
    // Compare dates
    const contactDate = new Date(contact.datetime).toISOString().split('T')[0].replace(/-/g, '');
    const qrzDate = qrzQSO.qso_date.replace(/-/g, '');
    
    if (contactDate !== qrzDate) return false;
    
    // Compare times (within a few minutes tolerance)
    const contactTime = new Date(contact.datetime).toISOString().split('T')[1].substring(0, 5).replace(':', '');
    const qrzTime = qrzQSO.time_on.replace(':', '');
    
    // Allow 5 minute tolerance
    const contactMinutes = parseInt(contactTime.substring(0, 2)) * 60 + parseInt(contactTime.substring(2));
    const qrzMinutes = parseInt(qrzTime.substring(0, 2)) * 60 + parseInt(qrzTime.substring(2));
    
    return Math.abs(contactMinutes - qrzMinutes) <= 5;
  }

  // QRZ sync status management
  static async updateQrzSyncStatus(
    id: number, 
    status: 'not_synced' | 'synced' | 'error' | 'already_exists',
    logbookId?: number,
    error?: string
  ): Promise<ContactData | null> {
    const updates = ['qrz_sync_status = $2', 'qrz_sync_date = NOW()'];
    const values: (number | string)[] = [id, status];
    let paramCount = 3;

    if (logbookId !== undefined) {
      updates.push(`qrz_logbook_id = $${paramCount}`);
      values.push(logbookId);
      paramCount++;
    }

    if (error !== undefined) {
      updates.push(`qrz_sync_error = $${paramCount}`);
      values.push(error);
      paramCount++;
    } else if (status === 'synced' || status === 'already_exists') {
      // Clear error on successful sync
      updates.push('qrz_sync_error = NULL');
    }

    const sql = `
      UPDATE contacts 
      SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING *
    `;

    const result = await query(sql, values);
    return result.rows[0] || null;
  }
}