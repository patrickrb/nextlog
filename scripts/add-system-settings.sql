-- Add system settings table for configurable application settings
-- Run this migration to add system configuration capabilities

CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(255) NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    data_type VARCHAR(50) NOT NULL DEFAULT 'string', -- 'string', 'number', 'boolean', 'json'
    category VARCHAR(100) NOT NULL DEFAULT 'general',
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE, -- Whether this setting can be accessed by non-admin users
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES users(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);
CREATE INDEX IF NOT EXISTS idx_system_settings_public ON system_settings(is_public);

-- Insert default ADIF import settings
INSERT INTO system_settings (setting_key, setting_value, data_type, category, description, is_public) VALUES
('adif_max_file_size_mb', '10', 'number', 'import', 'Maximum ADIF file size in megabytes', false),
('adif_max_record_count', '5000', 'number', 'import', 'Maximum number of records per ADIF import', false),
('adif_batch_size', '50', 'number', 'import', 'Number of records to process per batch during import', false),
('adif_timeout_seconds', '25', 'number', 'import', 'Maximum time in seconds for ADIF import processing', false)
ON CONFLICT (setting_key) DO NOTHING;

-- Insert general application settings
INSERT INTO system_settings (setting_key, setting_value, data_type, category, description, is_public) VALUES
('app_name', 'NodeLog', 'string', 'general', 'Application name displayed in UI', true),
('app_description', 'Amateur Radio Contact Logging System', 'string', 'general', 'Application description', true),
('default_timezone', 'UTC', 'string', 'general', 'Default timezone for the application', false),
('enable_registration', 'true', 'boolean', 'auth', 'Allow new user registration', false),
('max_stations_per_user', '10', 'number', 'limits', 'Maximum stations per user (0 = unlimited)', false),
('contact_pagination_default', '20', 'number', 'ui', 'Default number of contacts per page', true)
ON CONFLICT (setting_key) DO NOTHING;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_system_settings_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_system_settings_updated_at ON system_settings;
CREATE TRIGGER update_system_settings_updated_at
    BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION update_system_settings_updated_at_column();

-- Success message
SELECT 'System settings table created successfully with default ADIF import limits!' as message;