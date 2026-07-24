import { query } from '@/lib/db';
import { buildContactUpdate } from '@/lib/contact-update';

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
  // Additional fields
  qso_date_off?: Date;
  time_off?: string;
  operator?: string;
  distance?: number;
  // Transmit power for this QSO, in watts (ADIF TX_PWR). Distinct from the
  // station's default power — a single station may run different power per QSO.
  tx_pwr?: number;
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
    distance?: number;
    tx_pwr?: number;
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
      distance,
      tx_pwr,
      notes
    } = contactData;

    const sql = `
      INSERT INTO contacts (
        user_id, station_id, callsign, name, frequency, mode, band, datetime,
        rst_sent, rst_received, qth, grid_locator, latitude, longitude, distance,
        tx_pwr, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
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
      distance ?? null,
      tx_pwr ?? null,
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
    // Only ever writes columns from a fixed allowlist (see @/lib/contact-update).
    // The PUT route passes the raw request body straight in, so filtering here
    // prevents a caller from reassigning the QSO's owner (user_id) or injecting
    // SQL through a crafted key — both were possible when every key was
    // interpolated as a column name.
    const { fields, values } = buildContactUpdate(contactData as Record<string, unknown>);

    if (fields.length === 0) {
      return null;
    }

    values.push(id);
    const sql = `
      UPDATE contacts
      SET ${fields.join(', ')}
      WHERE id = $${values.length}
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

  /**
   * Aggregates contacts per band since a given timestamp. Returns a map keyed
   * by band string ('20m', '40m', etc.). Used by the dashboard band activity strip.
   */
  static async getBandActivity(userId: number, since: string): Promise<Record<string, number>> {
    const sql = `
      SELECT band, COUNT(*)::int AS count
      FROM contacts
      WHERE user_id = $1 AND datetime >= $2 AND band IS NOT NULL
      GROUP BY band
    `;
    const result = await query(sql, [userId, since]);
    const activity: Record<string, number> = {};
    for (const row of result.rows) {
      activity[row.band as string] = row.count as number;
    }
    return activity;
  }

  /**
   * Counts QSOs that have a confirmed QSL via any source (LoTW, QRZ, paper, eQSL).
   * Used by the dashboard QSL Confirmed stat card.
   */
  static async countConfirmedByUserId(userId: number): Promise<number> {
    const sql = `
      SELECT COUNT(*)::int AS count
      FROM contacts
      WHERE user_id = $1 AND (
        qsl_lotw = true
        OR lotw_qsl_rcvd = 'Y'
        OR qrz_qsl_rcvd = 'Y'
        OR qsl_rcvd = 'Y'
        OR eqsl_qsl_rcvd = 'Y'
      )
    `;
    const result = await query(sql, [userId]);
    return result.rows[0]?.count ?? 0;
  }

  /**
   * Counts distinct DXCC entities worked. Used by the dashboard DXCC stat card.
   */
  static async countDxccByUserId(userId: number): Promise<number> {
    const sql = `
      SELECT COUNT(DISTINCT dxcc)::int AS count
      FROM contacts
      WHERE user_id = $1 AND dxcc IS NOT NULL
    `;
    const result = await query(sql, [userId]);
    return result.rows[0]?.count ?? 0;
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

  static async findByCallsignAndUserId(userId: number, callsign: string, limit?: number): Promise<ContactData[]> {
    let sql = `
      SELECT * FROM contacts 
      WHERE user_id = $1 AND UPPER(callsign) = UPPER($2) 
      ORDER BY datetime DESC
    `;
    const params = [userId, callsign];
    
    if (limit) {
      sql += ` LIMIT $${params.length + 1}`;
      params.push(limit);
    }
    
    const result = await query(sql, params);
    return result.rows;
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

  // Contacts pending QRZ upload: never sent (NULL/'N'), previously failed
  // ('R' — retried on every sweep), or modified since upload ('M'). Excludes
  // 'I' (permanently ignored) and 'Q' (queued elsewhere).
  static async findQrzNotSent(userId: number, limit?: number, stationId?: number): Promise<ContactData[]> {
    let sql = `
      SELECT * FROM contacts
      WHERE user_id = $1 AND (qrz_qsl_sent IS NULL OR qrz_qsl_sent IN ('N', 'R', 'M'))
    `;
    const params = [userId];

    if (stationId !== undefined) {
      sql += ` AND station_id = $${params.length + 1}`;
      params.push(stationId);
    }

    sql += ` ORDER BY datetime DESC`;

    if (limit) {
      sql += ` LIMIT $${params.length + 1}`;
      params.push(limit);
    }

    const result = await query(sql, params);
    return result.rows;
  }

  // Flag a contact for re-upload after its core QSO fields changed: services
  // that already shipped it ('Y') get wavelog's 'M' (modified) marker, which
  // the QRZ path re-uploads with OPTION=REPLACE and the LoTW path re-signs.
  static async flagForReupload(id: number): Promise<void> {
    await query(
      `UPDATE contacts SET
         qrz_qsl_sent = CASE WHEN qrz_qsl_sent = 'Y' THEN 'M' ELSE qrz_qsl_sent END,
         lotw_qsl_sent = CASE WHEN lotw_qsl_sent = 'Y' THEN 'M' ELSE lotw_qsl_sent END,
         updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
  }

  static async findQrzSentNotConfirmed(userId: number, limit?: number, stationId?: number): Promise<ContactData[]> {
    let sql = `
      SELECT * FROM contacts
      WHERE user_id = $1 AND qrz_qsl_sent = 'Y' AND (qrz_qsl_rcvd IS NULL OR qrz_qsl_rcvd != 'Y')
    `;
    const params = [userId];

    if (stationId !== undefined) {
      sql += ` AND station_id = $${params.length + 1}`;
      params.push(stationId);
    }

    sql += ` ORDER BY datetime DESC`;

    if (limit) {
      sql += ` LIMIT $${params.length + 1}`;
      params.push(limit);
    }

    const result = await query(sql, params);
    return result.rows;
  }

}