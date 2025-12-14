-- Nextlog Database Installation Script
-- Complete schema with all tables including LOTW integration, QRZ sync, and reference data
-- This script creates all tables, indexes, functions, triggers, and loads reference data

-- No enum needed for QRZ sync - we use qrz_qsl_sent/qrz_qsl_rcvd fields like LoTW

-- Create users table
CREATE TABLE users (
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

-- Create stations table
CREATE TABLE stations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Core station information
    callsign VARCHAR(50) NOT NULL,
    station_name VARCHAR(255) NOT NULL,
    operator_name VARCHAR(255),
    
    -- Location data
    qth_name VARCHAR(255),
    street_address VARCHAR(255),
    city VARCHAR(100),
    county VARCHAR(100),
    state_province VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),
    dxcc_entity_code INTEGER,
    
    -- Grid and zone information
    grid_locator VARCHAR(10),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    itu_zone INTEGER,
    cq_zone INTEGER,
    
    -- Station technical details
    power_watts INTEGER,
    rig_info TEXT,
    antenna_info TEXT,
    station_equipment TEXT,
    
    -- Station status and settings
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    
    -- Integration settings
    qrz_username VARCHAR(255),
    qrz_password VARCHAR(255),
    qrz_api_key VARCHAR(255),
    qrz_auto_sync BOOLEAN DEFAULT FALSE,
    lotw_username VARCHAR(255),
    club_callsign VARCHAR(50),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure each user has only one default station
    CONSTRAINT unique_default_station_per_user UNIQUE (user_id, is_default) DEFERRABLE INITIALLY DEFERRED
);

-- Create contacts table
CREATE TABLE contacts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    station_id INTEGER REFERENCES stations(id) ON DELETE SET NULL,
    
    -- Core contact information
    callsign VARCHAR(50) NOT NULL,
    name VARCHAR(255),
    frequency DECIMAL(10, 6),
    mode VARCHAR(50),
    band VARCHAR(20),
    datetime TIMESTAMP NOT NULL,
    rst_sent VARCHAR(10),
    rst_received VARCHAR(10),
    
    -- Location and geographic data
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
    
    -- QSL information
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
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create DXCC entities table
CREATE TABLE dxcc_entities (
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

-- Create states/provinces table
CREATE TABLE states_provinces (
    id SERIAL PRIMARY KEY,
    dxcc_entity INTEGER NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT,
    cq_zone TEXT,
    itu_zone TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create storage configuration table
CREATE TABLE storage_config (
    id SERIAL PRIMARY KEY,
    config_type VARCHAR(50) NOT NULL UNIQUE,
    account_name VARCHAR(255),
    account_key TEXT, -- Encrypted
    container_name VARCHAR(255),
    endpoint_url VARCHAR(500),
    is_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    
    CONSTRAINT valid_config_type CHECK (config_type IN ('azure_blob', 'aws_s3', 'local_storage'))
);

-- Create API keys table
CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- API key details
    key_name VARCHAR(255) NOT NULL,
    api_key VARCHAR(255) NOT NULL UNIQUE,
    key_hash VARCHAR(255) NOT NULL,
    
    -- Permissions and status
    permissions JSONB DEFAULT '{"read": true, "write": false, "delete": false}',
    is_active BOOLEAN DEFAULT TRUE,
    read_only BOOLEAN DEFAULT FALSE,
    
    -- Usage tracking
    last_used_at TIMESTAMP,
    usage_count INTEGER DEFAULT 0,
    total_requests INTEGER DEFAULT 0,
    
    -- Rate limiting
    rate_limit_per_hour INTEGER DEFAULT 1000,
    
    -- Expiration
    expires_at TIMESTAMP,
    
    -- Metadata
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create admin audit log table
CREATE TABLE admin_audit_log (
    id SERIAL PRIMARY KEY,
    admin_user_id INTEGER NOT NULL REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50), -- 'user', 'storage_config', etc.
    target_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_callsign ON users(callsign);

CREATE INDEX idx_stations_user_id ON stations(user_id);
CREATE INDEX idx_stations_callsign ON stations(callsign);
CREATE INDEX idx_stations_is_default ON stations(is_default);
CREATE INDEX idx_stations_is_active ON stations(is_active);
CREATE INDEX idx_stations_grid_locator ON stations(grid_locator);
CREATE INDEX idx_stations_country ON stations(country);
CREATE INDEX idx_stations_dxcc_entity ON stations(dxcc_entity_code);

CREATE INDEX idx_contacts_user_id ON contacts(user_id);
CREATE INDEX idx_contacts_station_id ON contacts(station_id);
CREATE INDEX idx_contacts_callsign ON contacts(callsign);
CREATE INDEX idx_contacts_datetime ON contacts(datetime DESC);
CREATE INDEX idx_contacts_frequency ON contacts(frequency);
CREATE INDEX idx_contacts_mode ON contacts(mode);
CREATE INDEX idx_contacts_band ON contacts(band);
CREATE INDEX idx_contacts_qrz_qsl_sent ON contacts(qrz_qsl_sent);
CREATE INDEX idx_contacts_qrz_qsl_rcvd ON contacts(qrz_qsl_rcvd);

CREATE INDEX idx_storage_config_type ON storage_config(config_type);
CREATE INDEX idx_storage_config_enabled ON storage_config(is_enabled);

CREATE INDEX idx_api_keys_station_id ON api_keys(station_id);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_api_key ON api_keys(api_key);
CREATE INDEX idx_api_keys_is_active ON api_keys(is_active);
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at);
CREATE INDEX idx_api_keys_last_used_at ON api_keys(last_used_at DESC);

CREATE INDEX idx_audit_log_admin_user ON admin_audit_log(admin_user_id);
CREATE INDEX idx_audit_log_action ON admin_audit_log(action);
CREATE INDEX idx_audit_log_created_at ON admin_audit_log(created_at DESC);
CREATE INDEX idx_audit_log_target ON admin_audit_log(target_type, target_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to ensure only one default station per user
CREATE OR REPLACE FUNCTION ensure_single_default_station()
RETURNS TRIGGER AS $$
BEGIN
    -- If setting a station as default, unset all other defaults for this user
    IF NEW.is_default = TRUE THEN
        UPDATE stations 
        SET is_default = FALSE 
        WHERE user_id = NEW.user_id AND id != NEW.id;
    END IF;
    
    -- If no default station exists for user, make this one default
    IF NOT EXISTS (SELECT 1 FROM stations WHERE user_id = NEW.user_id AND is_default = TRUE AND id != NEW.id) THEN
        NEW.is_default = TRUE;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to set default station for contacts
CREATE OR REPLACE FUNCTION set_default_station_for_contact()
RETURNS TRIGGER AS $$
BEGIN
    -- If no station_id is provided, use the user's default station
    IF NEW.station_id IS NULL THEN
        SELECT id INTO NEW.station_id 
        FROM stations 
        WHERE user_id = NEW.user_id AND is_default = TRUE
        LIMIT 1;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stations_updated_at 
    BEFORE UPDATE ON stations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at 
    BEFORE UPDATE ON contacts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for default station management
CREATE TRIGGER ensure_single_default_station_trigger
    BEFORE INSERT OR UPDATE ON stations
    FOR EACH ROW EXECUTE FUNCTION ensure_single_default_station();

-- Create trigger to auto-assign default station to contacts
CREATE TRIGGER set_default_station_for_contact_trigger
    BEFORE INSERT ON contacts
    FOR EACH ROW EXECUTE FUNCTION set_default_station_for_contact();

-- Create trigger for storage config updated_at
CREATE TRIGGER update_storage_config_updated_at 
    BEFORE UPDATE ON storage_config 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for API keys updated_at
CREATE TRIGGER update_api_keys_updated_at 
    BEFORE UPDATE ON api_keys 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to generate API keys
CREATE OR REPLACE FUNCTION generate_api_key()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..64 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create function to update last_login timestamp
CREATE OR REPLACE FUNCTION update_last_login()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_login = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update last_login on successful authentication
-- Note: This would be called manually from the application login logic

-- Print success message
-- Create qsl_images table for QSL card image uploads
CREATE TABLE qsl_images (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Image metadata
    image_type VARCHAR(10) NOT NULL CHECK (image_type IN ('front', 'back')),
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/jpg', 'image/png', 'image/webp')),
    
    -- Storage information
    storage_path VARCHAR(500) NOT NULL,
    storage_url VARCHAR(500),
    storage_type VARCHAR(20) DEFAULT 'azure_blob' CHECK (storage_type IN ('azure_blob', 'aws_s3', 'local_storage')),
    
    -- Image dimensions (optional, for display optimization)
    width INTEGER,
    height INTEGER,
    
    -- Metadata
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure only one front and one back image per contact
    UNIQUE (contact_id, image_type)
);

-- Create indexes for qsl_images table
CREATE INDEX idx_qsl_images_contact_id ON qsl_images(contact_id);
CREATE INDEX idx_qsl_images_user_id ON qsl_images(user_id);
CREATE INDEX idx_qsl_images_type ON qsl_images(image_type);
CREATE INDEX idx_qsl_images_created_at ON qsl_images(created_at DESC);

-- Create trigger for qsl_images updated_at
CREATE TRIGGER update_qsl_images_updated_at
    BEFORE UPDATE ON qsl_images
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create LoTW credentials table for certificate management
-- Create LoTW credentials table
CREATE TABLE lotw_credentials (
    id SERIAL PRIMARY KEY,
    station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    callsign VARCHAR(50) NOT NULL,
    p12_cert BYTEA NOT NULL,
    cert_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cert_expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for active certificates lookup
CREATE INDEX idx_lotw_credentials_station_active ON lotw_credentials(station_id, is_active);

-- Create LoTW upload logs table
CREATE TABLE lotw_upload_logs (
    id SERIAL PRIMARY KEY,
    station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Upload details
    qso_count INTEGER NOT NULL DEFAULT 0,
    date_from DATE,
    date_to DATE,
    file_hash VARCHAR(64), -- SHA-256 hash of uploaded ADIF
    file_size_bytes INTEGER,
    
    -- Status and timing
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Results
    success_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    error_message TEXT,
    lotw_response TEXT,
    
    -- Metadata
    upload_method VARCHAR(20) DEFAULT 'manual' CHECK (upload_method IN ('manual', 'automatic', 'scheduled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create LoTW download logs table  
CREATE TABLE lotw_download_logs (
    id SERIAL PRIMARY KEY,
    station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Download details
    date_from DATE,
    date_to DATE,
    qso_count INTEGER DEFAULT 0,
    
    -- Status and timing
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Results
    confirmations_found INTEGER DEFAULT 0,
    confirmations_matched INTEGER DEFAULT 0,
    confirmations_unmatched INTEGER DEFAULT 0,
    error_message TEXT,
    
    -- Metadata
    download_method VARCHAR(20) DEFAULT 'manual' CHECK (download_method IN ('manual', 'automatic', 'scheduled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create LoTW job queue table for background processing
CREATE TABLE lotw_job_queue (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(20) NOT NULL CHECK (job_type IN ('upload', 'download')),
    station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Job parameters (JSON)
    job_params JSONB,
    
    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    is_running BOOLEAN DEFAULT FALSE,
    
    -- Timing
    scheduled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Results and retry logic
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    result JSONB,
    
    -- Priority (lower number = higher priority)
    priority INTEGER DEFAULT 5,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add LoTW fields to stations table
ALTER TABLE stations ADD COLUMN lotw_password VARCHAR(255);
ALTER TABLE stations ADD COLUMN lotw_p12_cert BYTEA;
ALTER TABLE stations ADD COLUMN lotw_cert_created_at TIMESTAMP;

-- Add LoTW fields to contacts table
ALTER TABLE contacts ADD COLUMN qsl_lotw BOOLEAN DEFAULT FALSE;
ALTER TABLE contacts ADD COLUMN qsl_lotw_date DATE;
ALTER TABLE contacts ADD COLUMN lotw_match_status VARCHAR(20) CHECK (lotw_match_status IN ('confirmed', 'partial', 'mismatch', null));

-- Add third party services field to users table
ALTER TABLE users ADD COLUMN third_party_services JSONB DEFAULT '{}';

-- Create indexes for LoTW tables
CREATE INDEX idx_lotw_credentials_station_id ON lotw_credentials(station_id);
CREATE INDEX idx_lotw_credentials_callsign ON lotw_credentials(callsign);
CREATE INDEX idx_lotw_credentials_is_active ON lotw_credentials(is_active);

CREATE INDEX idx_lotw_upload_logs_station_id ON lotw_upload_logs(station_id);
CREATE INDEX idx_lotw_upload_logs_user_id ON lotw_upload_logs(user_id);
CREATE INDEX idx_lotw_upload_logs_status ON lotw_upload_logs(status);
CREATE INDEX idx_lotw_upload_logs_started_at ON lotw_upload_logs(started_at DESC);

CREATE INDEX idx_lotw_download_logs_station_id ON lotw_download_logs(station_id);
CREATE INDEX idx_lotw_download_logs_user_id ON lotw_download_logs(user_id);
CREATE INDEX idx_lotw_download_logs_status ON lotw_download_logs(status);
CREATE INDEX idx_lotw_download_logs_started_at ON lotw_download_logs(started_at DESC);

CREATE INDEX idx_lotw_job_queue_status ON lotw_job_queue(status);
CREATE INDEX idx_lotw_job_queue_job_type ON lotw_job_queue(job_type);
CREATE INDEX idx_lotw_job_queue_station_id ON lotw_job_queue(station_id);
CREATE INDEX idx_lotw_job_queue_scheduled_at ON lotw_job_queue(scheduled_at);
CREATE INDEX idx_lotw_job_queue_priority ON lotw_job_queue(priority);
CREATE INDEX idx_lotw_job_queue_is_running ON lotw_job_queue(is_running);

CREATE INDEX idx_contacts_qsl_lotw ON contacts(qsl_lotw);
CREATE INDEX idx_contacts_qsl_lotw_date ON contacts(qsl_lotw_date);
CREATE INDEX idx_contacts_lotw_match_status ON contacts(lotw_match_status);

-- Create triggers for LoTW tables
CREATE TRIGGER update_lotw_credentials_updated_at 
    BEFORE UPDATE ON lotw_credentials 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lotw_job_queue_updated_at 
    BEFORE UPDATE ON lotw_job_queue 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Load DXCC entities reference data
\echo 'Loading complete DXCC entities data...'

-- Load complete DXCC entities dataset using external file
-- This requires the scripts directory to be accessible
DO $$
BEGIN
    -- Try to load from external file if available
    RAISE NOTICE 'Loading DXCC entities from external file...';
END $$;

-- For Docker/container environments, use embedded sample data
-- Insert essential DXCC entities for basic functionality
INSERT INTO dxcc_entities (adif, name, prefix, cq_zone, itu_zone, continent, longitude, latitude, deleted) VALUES
(2, 'Abu Ail Is', 'A1', NULL, NULL, NULL, NULL, NULL, FALSE)
,(3, 'Afghanistan', 'YA', 21.0, 40.0, 'AS', 65.0, 33.0, FALSE)
,(4, 'Agalega & St Brandon Islands', '3B7', NULL, NULL, NULL, NULL, NULL, FALSE)
,(5, 'Aland Islands', 'OH0', NULL, NULL, NULL, NULL, NULL, FALSE)
,(6, 'Alaska', 'KL7', 1.0, 1.0, 'NA', -149.5, 64.2, FALSE)
,(7, 'Albania', 'ZA', NULL, NULL, NULL, NULL, NULL, FALSE)
,(8, 'Aldabra', 'VQ9/A', NULL, NULL, NULL, NULL, NULL, FALSE)
,(400, 'Algeria', '7X', NULL, NULL, NULL, NULL, NULL, FALSE)
,(9, 'American Samoa', 'KH8', NULL, NULL, NULL, NULL, NULL, FALSE)
,(10, 'Amsterdam & St Paul Islands', 'FT5Z', NULL, NULL, NULL, NULL, NULL, FALSE)
,(11, 'Andaman & Nicobar Islands', 'VU4', NULL, NULL, NULL, NULL, NULL, FALSE)
,(203, 'Andorra', 'C31', NULL, NULL, NULL, NULL, NULL, FALSE)
,(401, 'Angola', 'D2', NULL, NULL, NULL, NULL, NULL, FALSE)
,(12, 'Anguilla', 'VP2E', NULL, NULL, NULL, NULL, NULL, FALSE)
,(195, 'Annobon', '3C0', NULL, NULL, NULL, NULL, NULL, FALSE)
,(13, 'Antarctica', 'CE9', NULL, NULL, NULL, NULL, NULL, FALSE)
,(94, 'Antigua & Barbuda', 'V2', NULL, NULL, NULL, NULL, NULL, FALSE)
,(100, 'Argentina', 'LU', 13.0, 14.0, 'SA', -64.0, -34.0, FALSE)
,(14, 'Armenia', 'EK', NULL, NULL, NULL, NULL, NULL, FALSE)
,(91, 'Aruba', 'P4', NULL, NULL, NULL, NULL, NULL, FALSE)
,(205, 'Ascension Island', 'ZD8', NULL, NULL, NULL, NULL, NULL, FALSE)
,(15, 'Asiatic Russia', 'UA0', NULL, NULL, NULL, NULL, NULL, FALSE)
,(508, 'Austral Islands', 'FO/A', NULL, NULL, NULL, NULL, NULL, FALSE)
,(150, 'Australia', 'VK', NULL, NULL, NULL, NULL, NULL, FALSE)
,(206, 'Austria', 'OE', NULL, NULL, NULL, NULL, NULL, FALSE)
,(17, 'Aves Island', 'YV0', NULL, NULL, NULL, NULL, NULL, FALSE)
,(18, 'Azerbaijan', '4J', NULL, NULL, NULL, NULL, NULL, FALSE)
,(149, 'Azores', 'CU', NULL, NULL, NULL, NULL, NULL, FALSE)
,(60, 'Bahamas', 'C6A', NULL, NULL, NULL, NULL, NULL, FALSE)
,(304, 'Bahrain', 'A9', NULL, NULL, NULL, NULL, NULL, FALSE)
,(19, 'Bajo Nuevo', 'HK0', NULL, NULL, NULL, NULL, NULL, FALSE)
,(20, 'Baker Howland Islands', 'KH1', NULL, NULL, NULL, NULL, NULL, FALSE)
,(21, 'Balearic Islands', 'EA6', NULL, NULL, NULL, NULL, NULL, FALSE)
,(490, 'Banaba Island', 'T33', NULL, NULL, NULL, NULL, NULL, FALSE)
,(305, 'Bangladesh', 'S2', NULL, NULL, NULL, NULL, NULL, FALSE)
,(62, 'Barbados', '8P', NULL, NULL, NULL, NULL, NULL, FALSE)
,(27, 'Belarus', 'EU', NULL, NULL, NULL, NULL, NULL, FALSE)
,(209, 'Belgium', 'ON', NULL, NULL, NULL, NULL, NULL, FALSE)
,(66, 'Belize', 'V3', NULL, NULL, NULL, NULL, NULL, FALSE)
,(416, 'Benin', 'TY', NULL, NULL, NULL, NULL, NULL, FALSE)
,(64, 'Bermuda', 'VP9', NULL, NULL, NULL, NULL, NULL, FALSE)
,(306, 'Bhutan', 'A5', NULL, NULL, NULL, NULL, NULL, FALSE)
,(23, 'Blenheim Reef', '1B', NULL, NULL, NULL, NULL, NULL, FALSE)
,(104, 'Bolivia', 'CP', NULL, NULL, NULL, NULL, NULL, FALSE)
,(520, 'Bonaire', 'PJ4', NULL, NULL, NULL, NULL, NULL, FALSE)
,(85, 'Bonaire, Curacao (neth Antilles)', 'PJ2/D', NULL, NULL, NULL, NULL, NULL, FALSE)
,(501, 'Bosnia-herzegovina', 'E7', NULL, NULL, NULL, NULL, NULL, FALSE)
,(402, 'Botswana', 'A2', NULL, NULL, NULL, NULL, NULL, FALSE)
,(24, 'Bouvet Island', '3Y/B', NULL, NULL, NULL, NULL, NULL, FALSE)
,(108, 'Brazil', 'PY', NULL, NULL, NULL, NULL, NULL, FALSE)
,(25, 'British North Borneo', 'ZC5', NULL, NULL, NULL, NULL, NULL, FALSE)
,(26, 'British Somaliland', 'VQ6', NULL, NULL, NULL, NULL, NULL, FALSE)
,(65, 'British Virgin Islands', 'VP2V', NULL, NULL, NULL, NULL, NULL, FALSE)
,(345, 'Brunei', 'V8', NULL, NULL, NULL, NULL, NULL, FALSE)
,(212, 'Bulgaria', 'LZ', NULL, NULL, NULL, NULL, NULL, FALSE)
,(480, 'Burkina Faso', 'XT', NULL, NULL, NULL, NULL, NULL, FALSE)
,(404, 'Burundi', '9U', NULL, NULL, NULL, NULL, NULL, FALSE)
,(312, 'Cambodia', 'XU', NULL, NULL, NULL, NULL, NULL, FALSE)
,(406, 'Cameroon', 'TJ', NULL, NULL, NULL, NULL, NULL, FALSE)
,(1, 'Canada', 'VE', NULL, NULL, NULL, NULL, NULL, FALSE)
,(28, 'Canal Zone', 'KZ5', NULL, NULL, NULL, NULL, NULL, FALSE)
,(29, 'Canary Islands', 'EA8', NULL, NULL, NULL, NULL, NULL, FALSE)
,(409, 'Cape Verde', 'D4', NULL, NULL, NULL, NULL, NULL, FALSE)
,(69, 'Cayman Islands', 'ZF', NULL, NULL, NULL, NULL, NULL, FALSE)
,(30, 'Celebe & Molucca Islands', 'PK6', NULL, NULL, NULL, NULL, NULL, FALSE)
,(408, 'Central African Republic', 'TL', NULL, NULL, NULL, NULL, NULL, FALSE)
,(31, 'Central Kiribati', 'T31', NULL, NULL, NULL, NULL, NULL, FALSE)
,(32, 'Ceuta & Melilla', 'EA9', NULL, NULL, NULL, NULL, NULL, FALSE)
,(410, 'Chad', 'TT', NULL, NULL, NULL, NULL, NULL, FALSE)
,(33, 'Chagos Islands', 'VQ9', NULL, NULL, NULL, NULL, NULL, FALSE)
,(34, 'Chatham Island', 'ZL7', NULL, NULL, NULL, NULL, NULL, FALSE)
,(512, 'Chesterfield Islands', 'FK/C', NULL, NULL, NULL, NULL, NULL, FALSE)
,(112, 'Chile', 'CE', NULL, NULL, NULL, NULL, NULL, FALSE)
,(318, 'China', 'BY', NULL, NULL, NULL, NULL, NULL, FALSE)
,(35, 'Christmas Island', 'VK9X', NULL, NULL, NULL, NULL, NULL, FALSE)
,(36, 'Clipperton Island', 'FO/C', NULL, NULL, NULL, NULL, NULL, FALSE)
,(38, 'Cocos (keeling) Island', 'VK9C', NULL, NULL, NULL, NULL, NULL, FALSE)
,(37, 'Cocos Island', 'TI9', NULL, NULL, NULL, NULL, NULL, FALSE)
,(116, 'Colombia', 'HK', NULL, NULL, NULL, NULL, NULL, FALSE)
,(39, 'Comoro Islands', 'FH8', NULL, NULL, NULL, NULL, NULL, FALSE)
,(411, 'Comoros', 'D6', NULL, NULL, NULL, NULL, NULL, FALSE)
,(489, 'Conway Reef', '3D2/C', NULL, NULL, NULL, NULL, NULL, FALSE)
,(214, 'Corsica', 'TK', NULL, NULL, NULL, NULL, NULL, FALSE)
,(308, 'Costa Rica', 'TI', NULL, NULL, NULL, NULL, NULL, FALSE)
,(428, 'Cote D''ivoire', 'TU', NULL, NULL, NULL, NULL, NULL, FALSE)
,(40, 'Crete', 'SV9', NULL, NULL, NULL, NULL, NULL, FALSE)
,(497, 'Croatia', '9A', NULL, NULL, NULL, NULL, NULL, FALSE)
,(41, 'Crozet Island', 'FT5/W', NULL, NULL, NULL, NULL, NULL, FALSE)
,(70, 'Cuba', 'CO', NULL, NULL, NULL, NULL, NULL, FALSE)
,(517, 'Curacao', 'PJ2', NULL, NULL, NULL, NULL, NULL, FALSE)
,(215, 'Cyprus', '5B', NULL, NULL, NULL, NULL, NULL, FALSE)
,(503, 'Czech Republic', 'OK', NULL, NULL, NULL, NULL, NULL, FALSE)
,(218, 'Czechoslovakia', 'OK/D', NULL, NULL, NULL, NULL, NULL, FALSE)
,(42, 'Damao, Diu', 'CR8/D', NULL, NULL, NULL, NULL, NULL, FALSE)
,(414, 'Dem. Rep. Of The Congo', '9Q', NULL, NULL, NULL, NULL, NULL, FALSE)
,(221, 'Denmark', 'OZ', NULL, NULL, NULL, NULL, NULL, FALSE)
,(43, 'Desecheo Island', 'KP5', NULL, NULL, NULL, NULL, NULL, FALSE)
,(44, 'Desroches', 'VQ9/D', NULL, NULL, NULL, NULL, NULL, FALSE)
,(382, 'Djibouti', 'J2', NULL, NULL, NULL, NULL, NULL, FALSE)
,(45, 'Dodecanese', 'SV5', NULL, NULL, NULL, NULL, NULL, FALSE)
,(95, 'Dominica', 'J7', NULL, NULL, NULL, NULL, NULL, FALSE)
,(72, 'Dominican Republic', 'HI', NULL, NULL, NULL, NULL, NULL, FALSE)
,(344, 'Dprk (north Korea)', 'P5', NULL, NULL, NULL, NULL, NULL, FALSE)
,(513, 'Ducie Island', 'VP6/D', NULL, NULL, NULL, NULL, NULL, FALSE)
,(46, 'East Malaysia', '9M6', NULL, NULL, NULL, NULL, NULL, FALSE)
,(47, 'Easter Island', 'CE0Y', NULL, NULL, NULL, NULL, NULL, FALSE)
,(48, 'Eastern Kiribati', 'T32', NULL, NULL, NULL, NULL, NULL, FALSE)
,(120, 'Ecuador', 'HC', NULL, NULL, NULL, NULL, NULL, FALSE)
,(478, 'Egypt', 'SU', NULL, NULL, NULL, NULL, NULL, FALSE)
,(74, 'El Salvador', 'YS', NULL, NULL, NULL, NULL, NULL, FALSE)
,(223, 'England', 'G', NULL, NULL, NULL, NULL, NULL, FALSE)
,(49, 'Equatorial Guinea', '3C', NULL, NULL, NULL, NULL, NULL, FALSE)
,(51, 'Eritrea', 'E3', NULL, NULL, NULL, NULL, NULL, FALSE)
,(52, 'Estonia', 'ES', NULL, NULL, NULL, NULL, NULL, FALSE)
,(53, 'Ethiopia', 'ET', NULL, NULL, NULL, NULL, NULL, FALSE)
,(54, 'European Russia', 'UA', NULL, NULL, NULL, NULL, NULL, FALSE)
,(141, 'Falkland Islands', 'VP8', NULL, NULL, NULL, NULL, NULL, FALSE)
,(222, 'Faroe Islands', 'OY', NULL, NULL, NULL, NULL, NULL, FALSE)
,(55, 'Farquhar', 'VQ9/F', NULL, NULL, NULL, NULL, NULL, FALSE)
,(230, 'Federal Republic Of Germany', 'DL', 14.0, 28.0, 'EU', 10.0, 51.0, FALSE)
,(56, 'Fernando De Noronha', 'PY0F', NULL, NULL, NULL, NULL, NULL, FALSE)
,(176, 'Fiji Islands', '3D2', NULL, NULL, NULL, NULL, NULL, FALSE)
,(224, 'Finland', 'OH', NULL, NULL, NULL, NULL, NULL, FALSE)
,(227, 'France', 'F', NULL, NULL, NULL, NULL, NULL, FALSE)
,(61, 'Franz Josef Land', 'R1F', NULL, NULL, NULL, NULL, NULL, FALSE)
,(57, 'French Equatorial Africa', 'FQ8', NULL, NULL, NULL, NULL, NULL, FALSE)
,(63, 'French Guiana', 'FY', NULL, NULL, NULL, NULL, NULL, FALSE)
,(67, 'French India', 'FN8', NULL, NULL, NULL, NULL, NULL, FALSE)
,(58, 'French Indo-china', 'FI8', NULL, NULL, NULL, NULL, NULL, FALSE)
,(175, 'French Polynesia', 'FO', NULL, NULL, NULL, NULL, NULL, FALSE)
,(59, 'French West Africa', 'FF', NULL, NULL, NULL, NULL, NULL, FALSE)
,(420, 'Gabon', 'TR', NULL, NULL, NULL, NULL, NULL, FALSE)
,(71, 'Galapagos Islands', 'HC8', NULL, NULL, NULL, NULL, NULL, FALSE)
,(75, 'Georgia', '4L', NULL, NULL, NULL, NULL, NULL, FALSE)
,(229, 'German Democratic Republic', 'DM', NULL, NULL, NULL, NULL, NULL, FALSE)
,(81, 'Germany', 'DL/D', NULL, NULL, NULL, NULL, NULL, FALSE)
,(93, 'Geyser Reef', '1G', NULL, NULL, NULL, NULL, NULL, FALSE)
,(424, 'Ghana', '9G', NULL, NULL, NULL, NULL, NULL, FALSE)
,(233, 'Gibraltar', 'ZB2', NULL, NULL, NULL, NULL, NULL, FALSE)
,(99, 'Glorioso Island', 'FT/G', NULL, NULL, NULL, NULL, NULL, FALSE)
,(101, 'Goa', 'CR8/G', NULL, NULL, NULL, NULL, NULL, FALSE)
,(102, 'Gold Coast Togoland', 'ZD4', NULL, NULL, NULL, NULL, NULL, FALSE)
,(236, 'Greece', 'SV', NULL, NULL, NULL, NULL, NULL, FALSE)
,(237, 'Greenland', 'OX', NULL, NULL, NULL, NULL, NULL, FALSE)
,(77, 'Grenada', 'J3', NULL, NULL, NULL, NULL, NULL, FALSE)
,(79, 'Guadeloupe', 'FG', NULL, NULL, NULL, NULL, NULL, FALSE)
,(103, 'Guam', 'KH2', NULL, NULL, NULL, NULL, NULL, FALSE)
,(105, 'Guantanamo Bay', 'KG4', NULL, NULL, NULL, NULL, NULL, FALSE)
,(76, 'Guatemala', 'TG', NULL, NULL, NULL, NULL, NULL, FALSE)
,(106, 'Guernsey', 'GU', NULL, NULL, NULL, NULL, NULL, FALSE)
,(107, 'Guinea', '3XA', NULL, NULL, NULL, NULL, NULL, FALSE)
,(109, 'Guinea-bissau', 'J5', NULL, NULL, NULL, NULL, NULL, FALSE)
,(129, 'Guyana', '8R', NULL, NULL, NULL, NULL, NULL, FALSE)
,(78, 'Haiti', 'HH', NULL, NULL, NULL, NULL, NULL, FALSE)
,(110, 'Hawaii', 'KH6', NULL, NULL, NULL, NULL, NULL, FALSE)
,(111, 'Heard Island', 'VK0H', NULL, NULL, NULL, NULL, NULL, FALSE)
,(80, 'Honduras', 'HR', NULL, NULL, NULL, NULL, NULL, FALSE)
,(321, 'Hong Kong', 'VR', NULL, NULL, NULL, NULL, NULL, FALSE)
,(239, 'Hungary', 'HA', NULL, NULL, NULL, NULL, NULL, FALSE)
,(242, 'Iceland', 'TF', NULL, NULL, NULL, NULL, NULL, FALSE)
,(113, 'Ifni', 'EA9/I', NULL, NULL, NULL, NULL, NULL, FALSE)
,(324, 'India', 'VU', NULL, NULL, NULL, NULL, NULL, FALSE)
,(327, 'Indonesia', 'YB', NULL, NULL, NULL, NULL, NULL, FALSE)
,(330, 'Iran', 'EP', NULL, NULL, NULL, NULL, NULL, FALSE)
,(333, 'Iraq', 'YI', NULL, NULL, NULL, NULL, NULL, FALSE)
,(245, 'Ireland', 'EI', NULL, NULL, NULL, NULL, NULL, FALSE)
,(114, 'Isle Of Man', 'GD', NULL, NULL, NULL, NULL, NULL, FALSE)
,(336, 'Israel', '4X', NULL, NULL, NULL, NULL, NULL, FALSE)
,(115, 'Italian Somali', 'I5', NULL, NULL, NULL, NULL, NULL, FALSE)
,(248, 'Italy', 'I', NULL, NULL, NULL, NULL, NULL, FALSE)
,(117, 'Itu Hq', '4U1ITU', NULL, NULL, NULL, NULL, NULL, FALSE)
,(82, 'Jamaica', '6Y', NULL, NULL, NULL, NULL, NULL, FALSE)
,(118, 'Jan Mayen', 'JX', NULL, NULL, NULL, NULL, NULL, FALSE)
,(339, 'Japan', 'JA', NULL, NULL, NULL, NULL, NULL, FALSE)
,(119, 'Java', 'PK1', NULL, NULL, NULL, NULL, NULL, FALSE)
,(122, 'Jersey', 'GJ', NULL, NULL, NULL, NULL, NULL, FALSE)
,(123, 'Johnston Island', 'KH3', NULL, NULL, NULL, NULL, NULL, FALSE)
,(342, 'Jordan', 'JY', NULL, NULL, NULL, NULL, NULL, FALSE)
,(124, 'Juan De Nova, Europa', 'FT/J', NULL, NULL, NULL, NULL, NULL, FALSE)
,(125, 'Juan Fernandez Islands', 'CE0Z', NULL, NULL, NULL, NULL, NULL, FALSE)
,(126, 'Kaliningrad', 'UA2', NULL, NULL, NULL, NULL, NULL, FALSE)
,(127, 'Kamaran Islands', 'VS9K', NULL, NULL, NULL, NULL, NULL, FALSE)
,(128, 'Karelo-finn Rep', 'UN1', NULL, NULL, NULL, NULL, NULL, FALSE)
,(130, 'Kazakhstan', 'UN', NULL, NULL, NULL, NULL, NULL, FALSE)
,(430, 'Kenya', '5Z', NULL, NULL, NULL, NULL, NULL, FALSE)
,(131, 'Kerguelen Island', 'FT5/X', NULL, NULL, NULL, NULL, NULL, FALSE)
,(133, 'Kermadec Island', 'ZL8', NULL, NULL, NULL, NULL, NULL, FALSE)
,(468, 'Kingdom Of Eswatini', '3DA', NULL, NULL, NULL, NULL, NULL, FALSE)
,(134, 'Kingman Reef', 'KH5K', NULL, NULL, NULL, NULL, NULL, FALSE)
,(138, 'Kure Island', 'KH7K', NULL, NULL, NULL, NULL, NULL, FALSE)
,(139, 'Kuria Muria Island', 'VS9H', NULL, NULL, NULL, NULL, NULL, FALSE)
,(348, 'Kuwait', '9K', NULL, NULL, NULL, NULL, NULL, FALSE)
,(68, 'Kuwait/saudi Arabia Neut. Zone', '8Z5', NULL, NULL, NULL, NULL, NULL, FALSE)
,(135, 'Kyrgyzstan', 'EX', NULL, NULL, NULL, NULL, NULL, FALSE)
,(142, 'Lakshadweep Islands', 'VU7', NULL, NULL, NULL, NULL, NULL, FALSE)
,(143, 'Laos', 'XW', NULL, NULL, NULL, NULL, NULL, FALSE)
,(145, 'Latvia', 'YL', NULL, NULL, NULL, NULL, NULL, FALSE)
,(354, 'Lebanon', 'OD', NULL, NULL, NULL, NULL, NULL, FALSE)
,(432, 'Lesotho', '7P', NULL, NULL, NULL, NULL, NULL, FALSE)
,(434, 'Liberia', 'EL', NULL, NULL, NULL, NULL, NULL, FALSE)
,(436, 'Libya', '5A', NULL, NULL, NULL, NULL, NULL, FALSE)
,(251, 'Liechtenstein', 'HB0', NULL, NULL, NULL, NULL, NULL, FALSE)
,(146, 'Lithuania', 'LY', NULL, NULL, NULL, NULL, NULL, FALSE)
,(147, 'Lord Howe Island', 'VK9L', NULL, NULL, NULL, NULL, NULL, FALSE)
,(254, 'Luxembourg', 'LX', NULL, NULL, NULL, NULL, NULL, FALSE)
,(152, 'Macao', 'XX9', NULL, NULL, NULL, NULL, NULL, FALSE)
,(153, 'Macquarie Island', 'VK0M', NULL, NULL, NULL, NULL, NULL, FALSE)
,(438, 'Madagascar', '5R', NULL, NULL, NULL, NULL, NULL, FALSE)
,(256, 'Madeira Islands', 'CT3', NULL, NULL, NULL, NULL, NULL, FALSE)
,(440, 'Malawi', '7Q', NULL, NULL, NULL, NULL, NULL, FALSE)
,(155, 'Malaya', 'VS2', NULL, NULL, NULL, NULL, NULL, FALSE)
,(159, 'Maldives', '8Q', NULL, NULL, NULL, NULL, NULL, FALSE)
,(442, 'Mali', 'TZ', NULL, NULL, NULL, NULL, NULL, FALSE)
,(161, 'Malpelo Island', 'HK0/M', NULL, NULL, NULL, NULL, NULL, FALSE)
,(257, 'Malta', '9H', NULL, NULL, NULL, NULL, NULL, FALSE)
,(151, 'Malyj Vysotskij Island', 'R1M', NULL, NULL, NULL, NULL, NULL, FALSE)
,(164, 'Manchuria', 'C9', NULL, NULL, NULL, NULL, NULL, FALSE)
,(166, 'Mariana Islands', 'KH0', NULL, NULL, NULL, NULL, NULL, FALSE)
,(167, 'Market Reef', 'OJ0', NULL, NULL, NULL, NULL, NULL, FALSE)
,(509, 'Marquesas Islands', 'FO/M', NULL, NULL, NULL, NULL, NULL, FALSE)
,(168, 'Marshall Islands', 'V7', NULL, NULL, NULL, NULL, NULL, FALSE)
,(84, 'Martinique', 'FM', NULL, NULL, NULL, NULL, NULL, FALSE)
,(444, 'Mauritania', '5T', NULL, NULL, NULL, NULL, NULL, FALSE)
,(165, 'Mauritius Island', '3B8', NULL, NULL, NULL, NULL, NULL, FALSE)
,(169, 'Mayotte', 'FH', NULL, NULL, NULL, NULL, NULL, FALSE)
,(171, 'Mellish Reef', 'VK9M', NULL, NULL, NULL, NULL, NULL, FALSE)
,(50, 'Mexico', 'XE', NULL, NULL, NULL, NULL, NULL, FALSE)
,(173, 'Micronesia', 'V6', NULL, NULL, NULL, NULL, NULL, FALSE)
,(174, 'Midway Island', 'KH4', NULL, NULL, NULL, NULL, NULL, FALSE)
,(177, 'Minami Torishima', 'JD/M', NULL, NULL, NULL, NULL, NULL, FALSE)
,(178, 'Minerva Reef', '1M', NULL, NULL, NULL, NULL, NULL, FALSE)
,(179, 'Moldova', 'ER', NULL, NULL, NULL, NULL, NULL, FALSE)
,(260, 'Monaco', '3A', NULL, NULL, NULL, NULL, NULL, FALSE)
,(363, 'Mongolia', 'JT', NULL, NULL, NULL, NULL, NULL, FALSE)
,(514, 'Montenegro', '4O', NULL, NULL, NULL, NULL, NULL, FALSE)
,(96, 'Montserrat', 'VP2M', NULL, NULL, NULL, NULL, NULL, FALSE)
,(446, 'Morocco', 'CN', NULL, NULL, NULL, NULL, NULL, FALSE)
,(180, 'Mount Athos', 'SV/A', NULL, NULL, NULL, NULL, NULL, FALSE)
,(181, 'Mozambique', 'C9', NULL, NULL, NULL, NULL, NULL, FALSE)
,(309, 'Myanmar', 'XZ', NULL, NULL, NULL, NULL, NULL, FALSE)
,(464, 'Namibia', 'V5', NULL, NULL, NULL, NULL, NULL, FALSE)
,(157, 'Nauru', 'C21', NULL, NULL, NULL, NULL, NULL, FALSE)
,(182, 'Navassa Island', 'KP1', NULL, NULL, NULL, NULL, NULL, FALSE)
,(369, 'Nepal', '9N', NULL, NULL, NULL, NULL, NULL, FALSE)
,(263, 'Netherlands', 'PA', NULL, NULL, NULL, NULL, NULL, FALSE)
,(183, 'Netherlands Borneo', 'PK5', NULL, NULL, NULL, NULL, NULL, FALSE)
,(184, 'Netherlands New Guinea', 'JZ0', NULL, NULL, NULL, NULL, NULL, FALSE)
,(162, 'New Caledonia', 'FK', NULL, NULL, NULL, NULL, NULL, FALSE)
,(170, 'New Zealand', 'ZL', NULL, NULL, NULL, NULL, NULL, FALSE)
,(16, 'New Zealand Subantarctic Islands', 'ZL9', NULL, NULL, NULL, NULL, NULL, FALSE)
,(186, 'Newfoundland Labrador', 'VO', NULL, NULL, NULL, NULL, NULL, FALSE)
,(86, 'Nicaragua', 'YN', NULL, NULL, NULL, NULL, NULL, FALSE)
,(187, 'Niger', '5U', NULL, NULL, NULL, NULL, NULL, FALSE)
,(450, 'Nigeria', '5N', NULL, NULL, NULL, NULL, NULL, FALSE)
,(188, 'Niue', 'E6', NULL, NULL, NULL, NULL, NULL, FALSE)
,(189, 'Norfolk Island', 'VK9N', NULL, NULL, NULL, NULL, NULL, FALSE)
,(191, 'North Cook Islands', 'E5/N', NULL, NULL, NULL, NULL, NULL, FALSE)
,(502, 'North Macedonia', 'Z3', NULL, NULL, NULL, NULL, NULL, FALSE)
,(265, 'Northern Ireland', 'GI', NULL, NULL, NULL, NULL, NULL, FALSE)
,(266, 'Norway', 'LA', NULL, NULL, NULL, NULL, NULL, FALSE)
,(192, 'Ogasawara', 'JD/O', NULL, NULL, NULL, NULL, NULL, FALSE)
,(193, 'Okinawa', 'KR6', NULL, NULL, NULL, NULL, NULL, FALSE)
,(194, 'Okino Tori-shima', '7J1', NULL, NULL, NULL, NULL, NULL, FALSE)
,(370, 'Oman', 'A4', NULL, NULL, NULL, NULL, NULL, FALSE)
,(372, 'Pakistan', 'AP', NULL, NULL, NULL, NULL, NULL, FALSE)
,(22, 'Palau', 'T8', NULL, NULL, NULL, NULL, NULL, FALSE)
,(510, 'Palestine', 'E4', NULL, NULL, NULL, NULL, NULL, FALSE)
,(196, 'Palestine (deleted)', 'ZC6', NULL, NULL, NULL, NULL, NULL, FALSE)
,(197, 'Palmyra & Jarvis Islands', 'KH5', NULL, NULL, NULL, NULL, NULL, FALSE)
,(88, 'Panama', 'HP', NULL, NULL, NULL, NULL, NULL, FALSE)
,(163, 'Papua New Guinea', 'P2', NULL, NULL, NULL, NULL, NULL, FALSE)
,(198, 'Papua Terr', 'VK9/P', NULL, NULL, NULL, NULL, NULL, FALSE)
,(132, 'Paraguay', 'ZP', NULL, NULL, NULL, NULL, NULL, FALSE)
,(493, 'Penguin Islands', 'ZS0', NULL, NULL, NULL, NULL, NULL, FALSE)
,(243, 'People's Dem Rep Of Yemen', 'VS9A', NULL, NULL, NULL, NULL, NULL, FALSE)
,(136, 'Peru', 'OA', NULL, NULL, NULL, NULL, NULL, FALSE)
,(199, 'Peter 1 Island', '3Y/P', NULL, NULL, NULL, NULL, NULL, FALSE)
,(375, 'Philippines', 'DU', NULL, NULL, NULL, NULL, NULL, FALSE)
,(172, 'Pitcairn Island', 'VP6', NULL, NULL, NULL, NULL, NULL, FALSE)
,(269, 'Poland', 'SP', NULL, NULL, NULL, NULL, NULL, FALSE)
,(272, 'Portugal', 'CT', NULL, NULL, NULL, NULL, NULL, FALSE)
,(200, 'Portuguese Timor', 'CR8/T', NULL, NULL, NULL, NULL, NULL, FALSE)
,(505, 'Pratas Island', 'BV9P', NULL, NULL, NULL, NULL, NULL, FALSE)
,(201, 'Prince Edward & Marion Islands', 'ZS8', NULL, NULL, NULL, NULL, NULL, FALSE)
,(202, 'Puerto Rico', 'KP4', NULL, NULL, NULL, NULL, NULL, FALSE)
,(376, 'Qatar', 'A7', NULL, NULL, NULL, NULL, NULL, FALSE)
,(137, 'Republic Of Korea', 'HL', NULL, NULL, NULL, NULL, NULL, FALSE)
,(522, 'Republic Of Kosovo', 'Z6', NULL, NULL, NULL, NULL, NULL, FALSE)
,(462, 'Republic Of South Africa', 'ZS', NULL, NULL, NULL, NULL, NULL, FALSE)
,(521, 'Republic Of South Sudan', 'Z8', NULL, NULL, NULL, NULL, NULL, FALSE)
,(412, 'Republic Of The Congo', 'TN', NULL, NULL, NULL, NULL, NULL, FALSE)
,(453, 'Reunion Island', 'FR', NULL, NULL, NULL, NULL, NULL, FALSE)
,(204, 'Revillagigedo', 'XF4', NULL, NULL, NULL, NULL, NULL, FALSE)
,(207, 'Rodriguez Island', '3B9', NULL, NULL, NULL, NULL, NULL, FALSE)
,(275, 'Romania', 'YO', NULL, NULL, NULL, NULL, NULL, FALSE)
,(460, 'Rotuma', '3D2/R', NULL, NULL, NULL, NULL, NULL, FALSE)
,(208, 'Ruanda-urundi', '9U', NULL, NULL, NULL, NULL, NULL, FALSE)
,(454, 'Rwanda', '9X', NULL, NULL, NULL, NULL, NULL, FALSE)
,(210, 'Saar', '9S4', NULL, NULL, NULL, NULL, NULL, FALSE)
,(519, 'Saba & St Eustatius', 'PJ5', NULL, NULL, NULL, NULL, NULL, FALSE)
,(211, 'Sable Island', 'CY0', NULL, NULL, NULL, NULL, NULL, FALSE)
,(516, 'Saint Barthelemy', 'FJ', NULL, NULL, NULL, NULL, NULL, FALSE)
,(250, 'Saint Helena', 'ZD7', NULL, NULL, NULL, NULL, NULL, FALSE)
,(249, 'Saint Kitts & Nevis', 'V4', NULL, NULL, NULL, NULL, NULL, FALSE)
,(97, 'Saint Lucia', 'J6', NULL, NULL, NULL, NULL, NULL, FALSE)
,(213, 'Saint Martin', 'FS', NULL, NULL, NULL, NULL, NULL, FALSE)
,(252, 'Saint Paul Island', 'CY9', NULL, NULL, NULL, NULL, NULL, FALSE)
,(253, 'Saint Peter And Paul Rocks', 'PY0S', NULL, NULL, NULL, NULL, NULL, FALSE)
,(277, 'Saint Pierre & Miquelon', 'FP', NULL, NULL, NULL, NULL, NULL, FALSE)
,(98, 'Saint Vincent', 'J8', NULL, NULL, NULL, NULL, NULL, FALSE)
,(190, 'Samoa', '5W', NULL, NULL, NULL, NULL, NULL, FALSE)
,(216, 'San Andres Island', 'HK0S', NULL, NULL, NULL, NULL, NULL, FALSE)
,(217, 'San Felix Islands', 'CE0X', NULL, NULL, NULL, NULL, NULL, FALSE)
,(278, 'San Marino', 'T7', NULL, NULL, NULL, NULL, NULL, FALSE)
,(219, 'Sao Tome & Principe', 'S9', NULL, NULL, NULL, NULL, NULL, FALSE)
,(220, 'Sarawak', 'VS4', NULL, NULL, NULL, NULL, NULL, FALSE)
,(225, 'Sardinia', 'IS0', NULL, NULL, NULL, NULL, NULL, FALSE)
,(378, 'Saudi Arabia', 'HZ', NULL, NULL, NULL, NULL, NULL, FALSE)
,(226, 'Saudi Arabia/iraq Neut Zone', '8Z4', NULL, NULL, NULL, NULL, NULL, FALSE)
,(506, 'Scarborough Reef', 'BS7H', NULL, NULL, NULL, NULL, NULL, FALSE)
,(279, 'Scotland', 'GM', NULL, NULL, NULL, NULL, NULL, FALSE)
,(456, 'Senegal', '6W', NULL, NULL, NULL, NULL, NULL, FALSE)
,(296, 'Serbia', 'YT', NULL, NULL, NULL, NULL, NULL, FALSE)
,(228, 'Serrana Bank & Roncador Cay', 'HK0/S', NULL, NULL, NULL, NULL, NULL, FALSE)
,(379, 'Seychelles Islands', 'S7', NULL, NULL, NULL, NULL, NULL, FALSE)
,(458, 'Sierra Leone', '9L', NULL, NULL, NULL, NULL, NULL, FALSE)
,(231, 'Sikkim', 'AC3', NULL, NULL, NULL, NULL, NULL, FALSE)
,(381, 'Singapore', '9V', NULL, NULL, NULL, NULL, NULL, FALSE)
,(518, 'Sint Maarten', 'PJ7', NULL, NULL, NULL, NULL, NULL, FALSE)
,(255, 'Sint Maarten, Saba, St Eustatius', 'PJ7/D', NULL, NULL, NULL, NULL, NULL, FALSE)
,(504, 'Slovak Republic', 'OM', NULL, NULL, NULL, NULL, NULL, FALSE)
,(499, 'Slovenia', 'S5', NULL, NULL, NULL, NULL, NULL, FALSE)
,(185, 'Solomon Islands', 'H4', NULL, NULL, NULL, NULL, NULL, FALSE)
,(232, 'Somalia', 'T5', NULL, NULL, NULL, NULL, NULL, FALSE)
,(234, 'South Cook Islands', 'E5/S', NULL, NULL, NULL, NULL, NULL, FALSE)
,(235, 'South Georgia Island', 'VP0G', NULL, NULL, NULL, NULL, NULL, FALSE)
,(238, 'South Orkney Islands', 'VP8O', NULL, NULL, NULL, NULL, NULL, FALSE)
,(240, 'South Sandwich Islands', 'VP0S', NULL, NULL, NULL, NULL, NULL, FALSE)
,(241, 'South Shetland Islands', 'VP8H', NULL, NULL, NULL, NULL, NULL, FALSE)
,(244, 'Southern Sudan', 'ST0/D', NULL, NULL, NULL, NULL, NULL, FALSE)
,(246, 'Sov Military Order Of Malta', '1A0', NULL, NULL, NULL, NULL, NULL, FALSE)
,(281, 'Spain', 'EA', NULL, NULL, NULL, NULL, NULL, FALSE)
,(247, 'Spratly Islands', '1S', NULL, NULL, NULL, NULL, NULL, FALSE)
,(315, 'Sri Lanka', '4S', NULL, NULL, NULL, NULL, NULL, FALSE)
,(466, 'Sudan', 'ST', NULL, NULL, NULL, NULL, NULL, FALSE)
,(258, 'Sumatra', 'PK4', NULL, NULL, NULL, NULL, NULL, FALSE)
,(140, 'Suriname', 'PZ', NULL, NULL, NULL, NULL, NULL, FALSE)
,(259, 'Svalbard', 'JW', NULL, NULL, NULL, NULL, NULL, FALSE)
,(515, 'Swains Island', 'KH8/S', NULL, NULL, NULL, NULL, NULL, FALSE)
,(261, 'Swan Island', 'KS4', NULL, NULL, NULL, NULL, NULL, FALSE)
,(284, 'Sweden', 'SM', NULL, NULL, NULL, NULL, NULL, FALSE)
,(287, 'Switzerland', 'HB', NULL, NULL, NULL, NULL, NULL, FALSE)
,(384, 'Syria', 'YK', NULL, NULL, NULL, NULL, NULL, FALSE)
,(386, 'Taiwan', 'BU', NULL, NULL, NULL, NULL, NULL, FALSE)
,(262, 'Tajikistan', 'EY', NULL, NULL, NULL, NULL, NULL, FALSE)
,(264, 'Tangier', 'CN2', NULL, NULL, NULL, NULL, NULL, FALSE)
,(470, 'Tanzania', '5H', NULL, NULL, NULL, NULL, NULL, FALSE)
,(507, 'Temotu Province', 'H40', NULL, NULL, NULL, NULL, NULL, FALSE)
,(267, 'Terr New Guinea', 'VK9/T', NULL, NULL, NULL, NULL, NULL, FALSE)
,(387, 'Thailand', 'HS', NULL, NULL, NULL, NULL, NULL, FALSE)
,(422, 'The Gambia', 'C5', NULL, NULL, NULL, NULL, NULL, FALSE)
,(268, 'Tibet', 'AC4', NULL, NULL, NULL, NULL, NULL, FALSE)
,(511, 'Timor-leste', '4W', NULL, NULL, NULL, NULL, NULL, FALSE)
,(483, 'Togo', '5V7', NULL, NULL, NULL, NULL, NULL, FALSE)
,(270, 'Tokelau Islands', 'ZK3', NULL, NULL, NULL, NULL, NULL, FALSE)
,(160, 'Tonga', 'A3', NULL, NULL, NULL, NULL, NULL, FALSE)
,(271, 'Trieste', 'I1', NULL, NULL, NULL, NULL, NULL, FALSE)
,(273, 'Trindade & Martim Vaz Islands', 'PY0T', NULL, NULL, NULL, NULL, NULL, FALSE)
,(90, 'Trinidad & Tobago', '9Y', NULL, NULL, NULL, NULL, NULL, FALSE)
,(274, 'Tristan Da Cunha & Gough Islands', 'ZD9', NULL, NULL, NULL, NULL, NULL, FALSE)
,(276, 'Tromelin Island', 'FT/T', NULL, NULL, NULL, NULL, NULL, FALSE)
,(474, 'Tunisia', '3V', NULL, NULL, NULL, NULL, NULL, FALSE)
,(390, 'Turkey', 'TA', NULL, NULL, NULL, NULL, NULL, FALSE)
,(280, 'Turkmenistan', 'EZ', NULL, NULL, NULL, NULL, NULL, FALSE)
,(89, 'Turks & Caicos Islands', 'VP5', NULL, NULL, NULL, NULL, NULL, FALSE)
,(282, 'Tuvalu', 'T2', NULL, NULL, NULL, NULL, NULL, FALSE)
,(286, 'Uganda', '5X', NULL, NULL, NULL, NULL, NULL, FALSE)
,(283, 'Uk Bases On Cyprus', 'ZC4', NULL, NULL, NULL, NULL, NULL, FALSE)
,(288, 'Ukraine', 'UR', NULL, NULL, NULL, NULL, NULL, FALSE)
,(391, 'United Arab Emirates', 'A6', NULL, NULL, NULL, NULL, NULL, FALSE)
,(289, 'United Nations Hq', '4U1UN', NULL, NULL, NULL, NULL, NULL, FALSE)
,(291, 'United States Of America', 'K', 5.0, 8.0, 'NA', -98.0, 39.0, FALSE)
,(144, 'Uruguay', 'CX', NULL, NULL, NULL, NULL, NULL, FALSE)
,(285, 'Us Virgin Islands', 'KP2', NULL, NULL, NULL, NULL, NULL, FALSE)
,(292, 'Uzbekistan', 'UJ', NULL, NULL, NULL, NULL, NULL, FALSE)
,(158, 'Vanuatu', 'YJ', NULL, NULL, NULL, NULL, NULL, FALSE)
,(295, 'Vatican City', 'HV', NULL, NULL, NULL, NULL, NULL, FALSE)
,(148, 'Venezuela', 'YV', NULL, NULL, NULL, NULL, NULL, FALSE)
,(293, 'Viet Nam', '3W', NULL, NULL, NULL, NULL, NULL, FALSE)
,(297, 'Wake Island', 'KH9', NULL, NULL, NULL, NULL, NULL, FALSE)
,(294, 'Wales', 'GW', NULL, NULL, NULL, NULL, NULL, FALSE)
,(298, 'Wallis & Futuna Islands', 'FW', NULL, NULL, NULL, NULL, NULL, FALSE)
,(488, 'Walvis Bay', 'ZS9', NULL, NULL, NULL, NULL, NULL, FALSE)
,(299, 'West Malaysia', '9M2', NULL, NULL, NULL, NULL, NULL, FALSE)
,(301, 'Western Kiribati', 'T30', NULL, NULL, NULL, NULL, NULL, FALSE)
,(302, 'Western Sahara', 'S0', NULL, NULL, NULL, NULL, NULL, FALSE)
,(303, 'Willis Island', 'VK9W', NULL, NULL, NULL, NULL, NULL, FALSE)
,(492, 'Yemen', '7O', NULL, NULL, NULL, NULL, NULL, FALSE)
,(154, 'Yemen Arab Republic', '4W', NULL, NULL, NULL, NULL, NULL, FALSE)
,(482, 'Zambia', '9J', NULL, NULL, NULL, NULL, NULL, FALSE)
,(307, 'Zanzibar', 'VQ1', NULL, NULL, NULL, NULL, NULL, FALSE)
,(452, 'Zimbabwe', 'Z2', NULL, NULL, NULL, NULL, NULL, FALSE)
;

\echo 'Essential DXCC entities loaded. For complete 402-entity dataset, run: psql -f scripts/dxcc_entities.sql'

-- Load states/provinces reference data (with conflict resolution)
\echo 'Loading essential states/provinces data...'
-- Temporarily drop unique constraint to handle duplicates during import
ALTER TABLE states_provinces DROP CONSTRAINT IF EXISTS states_provinces_dxcc_entity_code_key;

-- Insert comprehensive states/provinces data for major DXCC entities
INSERT INTO states_provinces (dxcc_entity, code, name, type, created_at, cq_zone, itu_zone) VALUES
-- Canada (VE)
(1, 'AB', 'Alberta', NULL, NOW(), '02', '04'),
(1, 'BC', 'British Columbia', NULL, NOW(), '02', '03'),
(1, 'MB', 'Manitoba', NULL, NOW(), '03,04', '04'),
(1, 'NB', 'New Brunswick', NULL, NOW(), '09', '05'),
(1, 'NL', 'Newfoundland and Labrador', NULL, NOW(), '09', '02,05'),
(1, 'NS', 'Nova Scotia', NULL, NOW(), '09', '05'),
(1, 'NT', 'Northwest Territories', NULL, NOW(), '03,04,75', '01,02,04'),
(1, 'NU', 'Nunavut', NULL, NOW(), '04,09', '02'),
(1, 'ON', 'Ontario', NULL, NOW(), '03,04', '04'),
(1, 'PE', 'Prince Edward Island', NULL, NOW(), '09', '05'),
(1, 'QC', 'Québec', NULL, NOW(), '04,09', '02,05'),
(1, 'SK', 'Saskatchewan', NULL, NOW(), '03', '04'),
(1, 'YT', 'Yukon', NULL, NOW(), '02', '01'),

-- United States (W)
(6, 'AL', 'Alabama', 'State', NOW(), '04', '08'),
(6, 'AK', 'Alaska', 'State', NOW(), '01', '01'),
(6, 'AZ', 'Arizona', 'State', NOW(), '03', '06'),
(6, 'AR', 'Arkansas', 'State', NOW(), '04', '07'),
(6, 'CA', 'California', 'State', NOW(), '03', '06'),
(6, 'CO', 'Colorado', 'State', NOW(), '04', '07'),
(6, 'CT', 'Connecticut', 'State', NOW(), '05', '08'),
(6, 'DE', 'Delaware', 'State', NOW(), '05', '08'),
(6, 'FL', 'Florida', 'State', NOW(), '05', '08'),
(6, 'GA', 'Georgia', 'State', NOW(), '04', '08'),
(6, 'HI', 'Hawaii', 'State', NOW(), '31', '61'),
(6, 'ID', 'Idaho', 'State', NOW(), '03', '06'),
(6, 'IL', 'Illinois', 'State', NOW(), '04', '08'),
(6, 'IN', 'Indiana', 'State', NOW(), '04', '08'),
(6, 'IA', 'Iowa', 'State', NOW(), '04', '07'),
(6, 'KS', 'Kansas', 'State', NOW(), '04', '07'),
(6, 'KY', 'Kentucky', 'State', NOW(), '04', '08'),
(6, 'LA', 'Louisiana', 'State', NOW(), '04', '07'),
(6, 'ME', 'Maine', 'State', NOW(), '05', '08'),
(6, 'MD', 'Maryland', 'State', NOW(), '05', '08'),
(6, 'MA', 'Massachusetts', 'State', NOW(), '05', '08'),
(6, 'MI', 'Michigan', 'State', NOW(), '04', '08'),
(6, 'MN', 'Minnesota', 'State', NOW(), '04', '07'),
(6, 'MS', 'Mississippi', 'State', NOW(), '04', '08'),
(6, 'MO', 'Missouri', 'State', NOW(), '04', '07'),
(6, 'MT', 'Montana', 'State', NOW(), '04', '07'),
(6, 'NE', 'Nebraska', 'State', NOW(), '04', '07'),
(6, 'NV', 'Nevada', 'State', NOW(), '03', '06'),
(6, 'NH', 'New Hampshire', 'State', NOW(), '05', '08'),
(6, 'NJ', 'New Jersey', 'State', NOW(), '05', '08'),
(6, 'NM', 'New Mexico', 'State', NOW(), '04', '07'),
(6, 'NY', 'New York', 'State', NOW(), '05', '08'),
(6, 'NC', 'North Carolina', 'State', NOW(), '04', '08'),
(6, 'ND', 'North Dakota', 'State', NOW(), '04', '07'),
(6, 'OH', 'Ohio', 'State', NOW(), '04', '08'),
(6, 'OK', 'Oklahoma', 'State', NOW(), '04', '07'),
(6, 'OR', 'Oregon', 'State', NOW(), '03', '06'),
(6, 'PA', 'Pennsylvania', 'State', NOW(), '05', '08'),
(6, 'RI', 'Rhode Island', 'State', NOW(), '05', '08'),
(6, 'SC', 'South Carolina', 'State', NOW(), '04', '08'),
(6, 'SD', 'South Dakota', 'State', NOW(), '04', '07'),
(6, 'TN', 'Tennessee', 'State', NOW(), '04', '08'),
(6, 'TX', 'Texas', 'State', NOW(), '04', '07'),
(6, 'UT', 'Utah', 'State', NOW(), '03', '06'),
(6, 'VT', 'Vermont', 'State', NOW(), '05', '08'),
(6, 'VA', 'Virginia', 'State', NOW(), '05', '08'),
(6, 'WA', 'Washington', 'State', NOW(), '03', '06'),
(6, 'WV', 'West Virginia', 'State', NOW(), '05', '08'),
(6, 'WI', 'Wisconsin', 'State', NOW(), '04', '08'),
(6, 'WY', 'Wyoming', 'State', NOW(), '04', '07'),
(6, 'DC', 'District of Columbia', 'District', NOW(), '05', '08')
;

\echo 'Essential states/provinces loaded (US states + Canadian provinces). For complete 1849-entity dataset, run: psql -f scripts/states_provinces_import.sql'

-- Add back the unique constraint
ALTER TABLE states_provinces ADD CONSTRAINT states_provinces_dxcc_entity_code_key UNIQUE (dxcc_entity, code);

\echo 'Database installation completed with essential reference data!'
\echo ''
\echo 'IMPORTANT: To load complete reference data (REQUIRED for full functionality):'
\echo '1. Load all 402 DXCC entities:'
\echo '   docker exec nextlog-postgres psql -U nextlog -d nextlog -f /tmp/scripts/dxcc_entities.sql'
\echo '2. Load all 1849 states/provinces:'  
\echo '   docker exec nextlog-postgres psql -U nextlog -d nextlog -f /tmp/scripts/states_provinces_import.sql'
\echo ''
\echo 'Or run the complete setup script:'
\echo '   ./scripts/load-complete-reference-data.sh'

SELECT 'Nextlog database installation completed successfully!' as message;
SELECT 'Tables created: ' || COUNT(*) || ' tables' as summary FROM information_schema.tables WHERE table_schema = 'public';
SELECT 'DXCC entities loaded: ' || COUNT(*) as dxcc_count FROM dxcc_entities;
SELECT 'States/provinces loaded: ' || COUNT(*) as states_count FROM states_provinces;