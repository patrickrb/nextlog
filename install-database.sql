-- NodeLog Database Installation Script
-- Complete schema based on current production database
-- This script creates all tables, indexes, functions, and triggers

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

CREATE INDEX idx_storage_config_type ON storage_config(config_type);
CREATE INDEX idx_storage_config_enabled ON storage_config(is_enabled);

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
    storage_type VARCHAR(20) DEFAULT 'azure_blob' CHECK (storage_type IN ('azure_blob', 'aws_s3')),
    
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

SELECT 'NodeLog database schema installed successfully!' as message;