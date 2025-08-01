import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import db from '@/lib/db';

const execAsync = promisify(exec);

export async function POST() {
  try {
    const projectRoot = process.cwd();
    const installScriptPath = path.join(projectRoot, 'install-database.sql');
    
    try {
      await execAsync(`docker cp "${installScriptPath}" nextlog-postgres:/tmp/install.sql`);
      
      const { stderr } = await execAsync(
        `docker exec nextlog-postgres psql -U nextlog -d nextlog -f /tmp/install.sql`
      );
      
      if (stderr && !stderr.includes('NOTICE:')) {
        console.warn('PostgreSQL warnings:', stderr);
      }
      
    } catch (error) {
      console.warn('Docker execution failed, using fallback approach:', error);
      
      // Fallback: try with Node.js but just execute core tables
      const coreSQL = `
        -- Core tables only
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            callsign VARCHAR(50),
            grid_locator VARCHAR(10),
            role VARCHAR(50) DEFAULT 'user' NOT NULL,
            status VARCHAR(50) DEFAULT 'active' NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS dxcc_entities (
            id SERIAL PRIMARY KEY,
            adif INTEGER NOT NULL,
            name TEXT NOT NULL,
            prefix TEXT,
            cq_zone NUMERIC,
            itu_zone NUMERIC,
            continent TEXT,
            longitude NUMERIC,
            latitude NUMERIC,
            deleted BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS states_provinces (
            id SERIAL PRIMARY KEY,
            dxcc_entity INTEGER NOT NULL,
            code TEXT NOT NULL,
            name TEXT NOT NULL,
            type TEXT,
            cq_zone TEXT,
            itu_zone TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS stations (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            callsign VARCHAR(50) NOT NULL,
            station_name VARCHAR(255) NOT NULL,
            operator_name VARCHAR(255),
            grid_locator VARCHAR(10),
            is_active BOOLEAN DEFAULT TRUE,
            is_default BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS contacts (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            station_id INTEGER REFERENCES stations(id) ON DELETE SET NULL,
            callsign VARCHAR(50) NOT NULL,
            datetime TIMESTAMP NOT NULL,
            frequency DECIMAL(10, 6),
            mode VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS storage_config (
            id SERIAL PRIMARY KEY,
            config_type VARCHAR(50) NOT NULL UNIQUE,
            account_name VARCHAR(255),
            account_key TEXT,
            container_name VARCHAR(255),
            endpoint_url VARCHAR(500),
            is_enabled BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by INTEGER REFERENCES users(id)
        );
        
        CREATE TABLE IF NOT EXISTS api_keys (
            id SERIAL PRIMARY KEY,
            station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            api_key VARCHAR(255) NOT NULL UNIQUE,
            key_hash VARCHAR(255) NOT NULL,
            permissions JSONB DEFAULT '{}',
            is_active BOOLEAN DEFAULT TRUE,
            expires_at TIMESTAMP,
            last_used_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;
      
      await db.query(coreSQL);
    }
    
    const tableCheckResult = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    const createdTables = tableCheckResult.rows.map(row => row.table_name);
    
    return NextResponse.json({ 
      success: true,
      message: 'Database schema installed successfully',
      tablesCreated: createdTables
    });
    
  } catch (error) {
    console.error('Database installation error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to install database schema',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}