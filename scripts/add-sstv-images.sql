-- Add SSTV images functionality
-- This script adds a table to store SSTV images decoded from radio audio

-- Create sstv_images table
CREATE TABLE IF NOT EXISTS sstv_images (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL, -- Optional link to QSO
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    station_id INTEGER REFERENCES stations(id) ON DELETE SET NULL,
    
    -- SSTV decode metadata
    frequency_mhz DECIMAL(10, 6), -- Frequency when image was decoded
    mode VARCHAR(50) DEFAULT 'SSTV', -- SSTV mode (Scottie1, Martin1, etc.)
    sstv_mode VARCHAR(50), -- Specific SSTV mode variant
    decode_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- When image was decoded
    signal_strength INTEGER, -- Signal strength during decode (-100 to 100 dBm)
    
    -- Image metadata
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255),
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/jpg', 'image/png', 'image/bmp')),
    
    -- Storage information
    storage_path VARCHAR(500) NOT NULL, -- Path in cloud storage
    storage_url VARCHAR(500), -- Public URL if available
    storage_type VARCHAR(20) DEFAULT 'azure_blob' CHECK (storage_type IN ('azure_blob', 'aws_s3', 'local')),
    
    -- Image dimensions and quality
    width INTEGER,
    height INTEGER,
    quality_score DECIMAL(3, 2), -- 0.0 to 1.0 quality assessment
    
    -- Radio and decode information
    radio_model VARCHAR(100), -- e.g., 'IC-7300', 'Flex 6400'
    cat_interface VARCHAR(50), -- CAT interface used
    audio_source VARCHAR(50), -- Audio source (DAX, USB, etc.)
    
    -- Metadata and notes
    callsign_detected VARCHAR(50), -- Callsign detected in image (if any)
    location_detected VARCHAR(100), -- Location text detected in image
    description TEXT,
    tags TEXT[], -- Array of tags for categorization
    
    -- Auto-linking flags
    auto_linked BOOLEAN DEFAULT FALSE, -- If automatically linked to QSO
    manual_review BOOLEAN DEFAULT FALSE, -- If needs manual review
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure reasonable constraints
    CONSTRAINT valid_quality_score CHECK (quality_score IS NULL OR (quality_score >= 0.0 AND quality_score <= 1.0)),
    CONSTRAINT valid_signal_strength CHECK (signal_strength IS NULL OR (signal_strength >= -150 AND signal_strength <= 100))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sstv_images_user_id ON sstv_images(user_id);
CREATE INDEX IF NOT EXISTS idx_sstv_images_station_id ON sstv_images(station_id);
CREATE INDEX IF NOT EXISTS idx_sstv_images_contact_id ON sstv_images(contact_id);
CREATE INDEX IF NOT EXISTS idx_sstv_images_decode_timestamp ON sstv_images(decode_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sstv_images_frequency ON sstv_images(frequency_mhz);
CREATE INDEX IF NOT EXISTS idx_sstv_images_mode ON sstv_images(sstv_mode);
CREATE INDEX IF NOT EXISTS idx_sstv_images_callsign ON sstv_images(callsign_detected);
CREATE INDEX IF NOT EXISTS idx_sstv_images_auto_linked ON sstv_images(auto_linked);
CREATE INDEX IF NOT EXISTS idx_sstv_images_created_at ON sstv_images(created_at DESC);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sstv_images_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_sstv_images_updated_at ON sstv_images;
CREATE TRIGGER update_sstv_images_updated_at
    BEFORE UPDATE ON sstv_images
    FOR EACH ROW EXECUTE FUNCTION update_sstv_images_updated_at_column();

-- Create SSTV radio configuration table
CREATE TABLE IF NOT EXISTS sstv_radio_config (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    station_id INTEGER REFERENCES stations(id) ON DELETE CASCADE,
    
    -- Radio hardware configuration
    radio_model VARCHAR(100) NOT NULL, -- e.g., 'IC-7300', 'Flex 6400'
    cat_interface VARCHAR(50) NOT NULL, -- CAT interface type
    cat_port VARCHAR(100), -- COM port or device path
    cat_baud_rate INTEGER DEFAULT 9600,
    
    -- Audio configuration
    audio_source VARCHAR(50) NOT NULL, -- 'USB Audio', 'DAX Audio', 'LINE OUT'
    audio_device VARCHAR(100), -- Specific audio device name/ID
    dax_enabled BOOLEAN DEFAULT FALSE, -- DAX audio streaming enabled
    
    -- Monitoring settings
    auto_decode BOOLEAN DEFAULT TRUE, -- Automatically decode SSTV signals
    auto_log BOOLEAN DEFAULT TRUE, -- Automatically log decoded images
    frequency_mhz DECIMAL(10, 6), -- Monitoring frequency
    
    -- Status
    active BOOLEAN DEFAULT FALSE, -- Currently active configuration
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure only one active config per user/station
    UNIQUE (user_id, station_id, active) DEFERRABLE INITIALLY DEFERRED
);

-- Create indexes for radio configuration
CREATE INDEX IF NOT EXISTS idx_sstv_radio_config_user_id ON sstv_radio_config(user_id);
CREATE INDEX IF NOT EXISTS idx_sstv_radio_config_station_id ON sstv_radio_config(station_id);
CREATE INDEX IF NOT EXISTS idx_sstv_radio_config_active ON sstv_radio_config(active);
CREATE INDEX IF NOT EXISTS idx_sstv_radio_config_model ON sstv_radio_config(radio_model);

-- Create function to automatically update updated_at timestamp for radio config
CREATE OR REPLACE FUNCTION update_sstv_radio_config_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for radio config updated_at
DROP TRIGGER IF EXISTS update_sstv_radio_config_updated_at ON sstv_radio_config;
CREATE TRIGGER update_sstv_radio_config_updated_at
    BEFORE UPDATE ON sstv_radio_config
    FOR EACH ROW EXECUTE FUNCTION update_sstv_radio_config_updated_at_column();

-- Insert a success message
SELECT 'SSTV images and radio configuration tables created successfully!' as message;