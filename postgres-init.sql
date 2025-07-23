-- PostgreSQL initialization script for Nextlog

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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    notes TEXT,
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
    qso_date_off DATE,
    time_off TIME,
    operator VARCHAR(50),
    distance DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_stations_user_id ON stations(user_id);
CREATE INDEX idx_stations_callsign ON stations(callsign);
CREATE INDEX idx_stations_is_default ON stations(is_default);
CREATE INDEX idx_stations_is_active ON stations(is_active);
CREATE INDEX idx_contacts_user_id ON contacts(user_id);
CREATE INDEX idx_contacts_station_id ON contacts(station_id);
CREATE INDEX idx_contacts_callsign ON contacts(callsign);
CREATE INDEX idx_contacts_datetime ON contacts(datetime DESC);
CREATE INDEX idx_contacts_frequency ON contacts(frequency);
CREATE INDEX idx_contacts_mode ON contacts(mode);
CREATE INDEX idx_contacts_band ON contacts(band);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at 
    BEFORE UPDATE ON contacts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stations_updated_at 
    BEFORE UPDATE ON stations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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

-- Create trigger for default station management
CREATE TRIGGER ensure_single_default_station_trigger
    BEFORE INSERT OR UPDATE ON stations
    FOR EACH ROW EXECUTE FUNCTION ensure_single_default_station();

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

-- Create trigger to auto-assign default station to contacts
CREATE TRIGGER set_default_station_for_contact_trigger
    BEFORE INSERT ON contacts
    FOR EACH ROW EXECUTE FUNCTION set_default_station_for_contact();

-- Print success message
SELECT 'Database initialized successfully!' as message;