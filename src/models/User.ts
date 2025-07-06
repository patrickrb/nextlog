import pool from '../lib/db';
import { encrypt, decrypt } from '../lib/crypto';

export interface IUser {
  id: number;
  email: string;
  password: string;
  name: string;
  callsign?: string;
  grid_locator?: string;
  qrz_username?: string;
  qrz_password?: string;
  created_at: Date;
  updated_at: Date;
}

export class User {
  static getDecryptedQrzPassword(user: IUser): string | null {
    return user.qrz_password ? decrypt(user.qrz_password) : null;
  }
  static async create(userData: {
    email: string;
    password: string;
    name: string;
    callsign?: string;
    grid_locator?: string;
    qrz_username?: string;
    qrz_password?: string;
  }): Promise<IUser> {
    const { email, password, name, callsign, grid_locator, qrz_username, qrz_password } = userData;
    
    const query = `
      INSERT INTO users (email, password, name, callsign, grid_locator, qrz_username, qrz_password)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      email.toLowerCase().trim(),
      password,
      name.trim(),
      callsign ? callsign.toUpperCase().trim() : null,
      grid_locator ? grid_locator.toUpperCase().trim() : null,
      qrz_username ? qrz_username.trim() : null,
      qrz_password ? encrypt(qrz_password.trim()) : null
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
        if (key === 'qrz_password' && value) {
          values.push(encrypt(value as string));
        } else {
          values.push(value);
        }
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
    
    return (result.rowCount ?? 0) > 0;
  }
}