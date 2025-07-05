import pool from '../lib/db';

export interface IContact {
  id: number;
  user_id: number;
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
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

export class Contact {
  static async create(contactData: {
    user_id: number;
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
    notes?: string;
  }): Promise<IContact> {
    const {
      user_id,
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
      notes
    } = contactData;
    
    const query = `
      INSERT INTO contacts (
        user_id, callsign, name, frequency, mode, band, datetime,
        rst_sent, rst_received, qth, grid_locator, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      user_id,
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
      notes ? notes.trim() : null
    ]);
    
    return result.rows[0];
  }

  static async findByUserId(userId: number, limit?: number, offset?: number): Promise<IContact[]> {
    let query = 'SELECT * FROM contacts WHERE user_id = $1 ORDER BY datetime DESC';
    const params = [userId];
    
    if (limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(limit);
    }
    
    if (offset) {
      query += ` OFFSET $${params.length + 1}`;
      params.push(offset);
    }
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  static async findById(id: number): Promise<IContact | null> {
    const query = 'SELECT * FROM contacts WHERE id = $1';
    const result = await pool.query(query, [id]);
    
    return result.rows[0] || null;
  }

  static async update(id: number, contactData: Partial<IContact>): Promise<IContact | null> {
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
    const query = `
      UPDATE contacts 
      SET ${fields.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  static async delete(id: number): Promise<boolean> {
    const query = 'DELETE FROM contacts WHERE id = $1';
    const result = await pool.query(query, [id]);
    
    return result.rowCount > 0;
  }

  static async countByUserId(userId: number): Promise<number> {
    const query = 'SELECT COUNT(*) FROM contacts WHERE user_id = $1';
    const result = await pool.query(query, [userId]);
    
    return parseInt(result.rows[0].count);
  }
}