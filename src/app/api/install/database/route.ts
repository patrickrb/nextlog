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
      
      // Fallback: try with Node.js but execute complete schema
      const coreSQL = `
        -- No enum needed for QRZ sync - we use qrz_qsl_sent/qrz_qsl_rcvd fields like LoTW
        
        -- Core tables with all fields
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            callsign VARCHAR(50),
            grid_locator VARCHAR(10),
            qrz_username VARCHAR(255),
            qrz_password VARCHAR(255),
            qrz_auto_sync BOOLEAN DEFAULT FALSE,
            role VARCHAR(50) DEFAULT 'user' NOT NULL,
            status VARCHAR(50) DEFAULT 'active' NOT NULL,
            last_login TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            
            CONSTRAINT valid_role CHECK (role IN ('user', 'admin', 'moderator')),
            CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'suspended'))
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
            qth_name VARCHAR(255),
            street_address VARCHAR(255),
            city VARCHAR(100),
            county VARCHAR(100),
            state_province VARCHAR(100),
            postal_code VARCHAR(20),
            country VARCHAR(100),
            dxcc_entity_code INTEGER,
            grid_locator VARCHAR(10),
            latitude DECIMAL(10, 8),
            longitude DECIMAL(11, 8),
            itu_zone INTEGER,
            cq_zone INTEGER,
            power_watts INTEGER,
            rig_info TEXT,
            antenna_info TEXT,
            station_equipment TEXT,
            qrz_username VARCHAR(255),
            qrz_password VARCHAR(255),
            qrz_api_key VARCHAR(255),
            qrz_auto_sync BOOLEAN DEFAULT FALSE,
            lotw_username VARCHAR(255),
            club_callsign VARCHAR(50),
            lotw_password VARCHAR(255),
            lotw_p12_cert BYTEA,
            lotw_cert_created_at TIMESTAMP,
            is_active BOOLEAN DEFAULT TRUE,
            is_default BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            
            CONSTRAINT unique_default_station_per_user UNIQUE (user_id, is_default) DEFERRABLE INITIALLY DEFERRED
        );
        
        CREATE TABLE IF NOT EXISTS contacts (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            station_id INTEGER REFERENCES stations(id) ON DELETE SET NULL,
            callsign VARCHAR(50) NOT NULL,
            name VARCHAR(255),
            frequency DECIMAL(10, 6),
            mode VARCHAR(50),
            band VARCHAR(20),
            datetime TIMESTAMP NOT NULL,
            rst_sent VARCHAR(10),
            rst_received VARCHAR(10),
            qth VARCHAR(255),
            grid_locator VARCHAR(10),
            latitude DECIMAL(10, 8),
            longitude DECIMAL(11, 8),
            country VARCHAR(100),
            dxcc INTEGER,
            cont VARCHAR(10),
            cqz INTEGER,
            ituz INTEGER,
            state VARCHAR(50),
            cnty VARCHAR(100),
            qsl_rcvd VARCHAR(10),
            qsl_sent VARCHAR(10),
            qsl_via VARCHAR(255),
            eqsl_qsl_rcvd VARCHAR(10),
            eqsl_qsl_sent VARCHAR(10),
            lotw_qsl_rcvd VARCHAR(10),
            lotw_qsl_sent VARCHAR(10),
            
            -- QRZ QSL tracking (matches LoTW pattern)
            qrz_qsl_sent VARCHAR(10),
            qrz_qsl_rcvd VARCHAR(10),
            qrz_qsl_sent_date DATE,
            qrz_qsl_rcvd_date DATE,
            
            -- Additional QSO data
            qso_date_off DATE,
            time_off TIME,
            operator VARCHAR(50),
            distance DECIMAL(10, 2),
            notes TEXT,
            qsl_lotw BOOLEAN DEFAULT FALSE,
            qsl_lotw_date DATE,
            lotw_match_status VARCHAR(20) CHECK (lotw_match_status IN ('confirmed', 'partial', 'mismatch', null)),
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
            key_name VARCHAR(255) NOT NULL,
            api_key VARCHAR(255) NOT NULL UNIQUE,
            key_hash VARCHAR(255) NOT NULL,
            permissions JSONB DEFAULT '{"read": true, "write": false, "delete": false}',
            is_active BOOLEAN DEFAULT TRUE,
            read_only BOOLEAN DEFAULT FALSE,
            last_used_at TIMESTAMP,
            usage_count INTEGER DEFAULT 0,
            total_requests INTEGER DEFAULT 0,
            rate_limit_per_hour INTEGER DEFAULT 1000,
            expires_at TIMESTAMP,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS admin_audit_log (
            id SERIAL PRIMARY KEY,
            admin_user_id INTEGER NOT NULL REFERENCES users(id),
            action VARCHAR(100) NOT NULL,
            target_type VARCHAR(50),
            target_id INTEGER,
            old_values JSONB,
            new_values JSONB,
            ip_address INET,
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS system_settings (
            id SERIAL PRIMARY KEY,
            setting_key VARCHAR(255) NOT NULL UNIQUE,
            setting_value TEXT NOT NULL,
            data_type VARCHAR(50) NOT NULL DEFAULT 'string',
            category VARCHAR(100) NOT NULL DEFAULT 'general',
            description TEXT,
            is_public BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_by INTEGER REFERENCES users(id)
        );
        
        CREATE TABLE IF NOT EXISTS qsl_images (
            id SERIAL PRIMARY KEY,
            contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            image_type VARCHAR(10) NOT NULL CHECK (image_type IN ('front', 'back')),
            filename VARCHAR(255) NOT NULL,
            original_filename VARCHAR(255) NOT NULL,
            file_size INTEGER NOT NULL,
            mime_type VARCHAR(100) NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/jpg', 'image/png', 'image/webp')),
            storage_path VARCHAR(500) NOT NULL,
            storage_url VARCHAR(500),
            storage_type VARCHAR(20) DEFAULT 'azure_blob' CHECK (storage_type IN ('azure_blob', 'aws_s3')),
            width INTEGER,
            height INTEGER,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (contact_id, image_type)
        );
        
        -- Create indexes for QRZ QSL fields
        CREATE INDEX IF NOT EXISTS idx_contacts_qrz_qsl_sent ON contacts(qrz_qsl_sent);
        CREATE INDEX IF NOT EXISTS idx_contacts_qrz_qsl_rcvd ON contacts(qrz_qsl_rcvd);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
        CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
        CREATE INDEX IF NOT EXISTS idx_users_callsign ON users(callsign);
        CREATE INDEX IF NOT EXISTS idx_stations_user_id ON stations(user_id);
        CREATE INDEX IF NOT EXISTS idx_stations_callsign ON stations(callsign);
        CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
        CREATE INDEX IF NOT EXISTS idx_contacts_station_id ON contacts(station_id);
        CREATE INDEX IF NOT EXISTS idx_contacts_callsign ON contacts(callsign);
        CREATE INDEX IF NOT EXISTS idx_contacts_datetime ON contacts(datetime DESC);
        CREATE INDEX IF NOT EXISTS idx_contacts_band ON contacts(band);
        CREATE INDEX IF NOT EXISTS idx_contacts_mode ON contacts(mode);
        CREATE INDEX IF NOT EXISTS idx_contacts_dxcc ON contacts(dxcc);
        CREATE INDEX IF NOT EXISTS idx_storage_config_type ON storage_config(config_type);
        CREATE INDEX IF NOT EXISTS idx_storage_config_enabled ON storage_config(is_enabled);
        CREATE INDEX IF NOT EXISTS idx_audit_log_admin_user ON admin_audit_log(admin_user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_log_action ON admin_audit_log(action);
        CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON admin_audit_log(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_audit_log_target ON admin_audit_log(target_type, target_id);
        
        -- Create trigger function for updated_at
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        
        -- Create triggers for updated_at
        CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        CREATE TRIGGER update_stations_updated_at BEFORE UPDATE ON stations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        CREATE TRIGGER update_storage_config_updated_at BEFORE UPDATE ON storage_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        CREATE TRIGGER update_qsl_images_updated_at BEFORE UPDATE ON qsl_images FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
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