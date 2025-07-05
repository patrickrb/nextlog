import pool from '../lib/db';

export interface IUser {
  id: number;
  email: string;
  password: string;
  name: string;
  callsign?: string;
  grid_locator?: string;
  created_at: Date;
  updated_at: Date;
}

export class User {
  static async create(userData: {
    email: string;
    password: string;
    name: string;
    callsign?: string;
    grid_locator?: string;
  }): Promise<IUser> {
    const { email, password, name, callsign, grid_locator } = userData;
    
    const query = `
      INSERT INTO users (email, password, name, callsign, grid_locator)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      email.toLowerCase().trim(),
      password,
      name.trim(),
      callsign ? callsign.toUpperCase().trim() : null,
      grid_locator ? grid_locator.toUpperCase().trim() : null
    ]);
    
    return result.rows[0];
  }

  static async findByEmail(email: string): Promise<IUser | null> {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await pool.query(query, [email.toLowerCase().trim()]);
    
    return result.rows[0] || null;
  }

  static async findById(id: number): Promise<IUser | null> {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await pool.query(query, [id]);
    
    return result.rows[0] || null;
  }

  static async update(id: number, userData: Partial<IUser>): Promise<IUser | null> {
    const fields = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(userData)) {
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
      UPDATE users 
      SET ${fields.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  static async delete(id: number): Promise<boolean> {
    const query = 'DELETE FROM users WHERE id = $1';
    const result = await pool.query(query, [id]);
    
    return result.rowCount > 0;
  }
}