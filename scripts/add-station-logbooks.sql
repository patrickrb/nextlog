-- Add Station Logbooks support to NodeLog
-- Based on Wavelog functionality and ADIF standard

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

-- Add station_id to contacts table
ALTER TABLE contacts 
ADD COLUMN station_id INTEGER REFERENCES stations(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX idx_stations_user_id ON stations(user_id);
CREATE INDEX idx_stations_callsign ON stations(callsign);
CREATE INDEX idx_stations_is_default ON stations(is_default);
CREATE INDEX idx_stations_is_active ON stations(is_active);
CREATE INDEX idx_stations_grid_locator ON stations(grid_locator);
CREATE INDEX idx_stations_country ON stations(country);
CREATE INDEX idx_stations_dxcc_entity ON stations(dxcc_entity_code);
CREATE INDEX idx_contacts_station_id ON contacts(station_id);

-- Create trigger to automatically update updated_at
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

-- Add some sample data comments
COMMENT ON TABLE stations IS 'Station locations and configurations for amateur radio logging';
COMMENT ON COLUMN stations.dxcc_entity_code IS 'DXCC entity code for awards tracking';
COMMENT ON COLUMN stations.grid_locator IS 'Maidenhead grid square locator';
COMMENT ON COLUMN stations.is_default IS 'Whether this is the default station for the user';
COMMENT ON COLUMN stations.is_active IS 'Whether this station is currently active';

-- Print success message
SELECT 'Station logbooks schema created successfully!' as message;