-- Propagation prediction database tables for Nextlog
-- This script adds tables for solar activity tracking and propagation forecasting

-- Solar activity data table
CREATE TABLE IF NOT EXISTS solar_activity (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL UNIQUE,
    solar_flux_index DECIMAL(6,2) NOT NULL, -- 10.7cm Solar Flux Index (SFI)
    a_index DECIMAL(5,2) NOT NULL,          -- Geomagnetic A-index (daily)
    k_index DECIMAL(3,1) NOT NULL,          -- Geomagnetic K-index (3-hour)
    solar_wind_speed DECIMAL(7,2),          -- km/s
    solar_wind_density DECIMAL(6,3),        -- protons/cm³
    xray_class VARCHAR(5),                   -- Solar flare class (A1.0, B2.5, C1.2, etc.)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for timestamp queries
CREATE INDEX IF NOT EXISTS idx_solar_activity_timestamp ON solar_activity(timestamp DESC);

-- Propagation forecasts table
CREATE TABLE IF NOT EXISTS propagation_forecasts (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL,           -- When forecast was created
    forecast_for TIMESTAMP NOT NULL,       -- What time the forecast is for
    band_conditions JSONB NOT NULL,        -- Array of band condition objects
    general_conditions VARCHAR(20) NOT NULL CHECK (general_conditions IN ('poor', 'fair', 'good', 'excellent')),
    notes TEXT,
    source VARCHAR(50) NOT NULL,           -- 'NOAA', 'manual', 'calculated', etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_general_conditions CHECK (general_conditions IN ('poor', 'fair', 'good', 'excellent'))
);

-- Index for forecast queries
CREATE INDEX IF NOT EXISTS idx_propagation_forecasts_forecast_for ON propagation_forecasts(forecast_for DESC);
CREATE INDEX IF NOT EXISTS idx_propagation_forecasts_timestamp ON propagation_forecasts(timestamp DESC);

-- Propagation alerts table
CREATE TABLE IF NOT EXISTS propagation_alerts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alert_type VARCHAR(30) NOT NULL CHECK (alert_type IN ('solar_storm', 'enhanced_propagation', 'band_opening', 'aurora')),
    severity VARCHAR(10) NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_alert_type CHECK (alert_type IN ('solar_storm', 'enhanced_propagation', 'band_opening', 'aurora')),
    CONSTRAINT valid_severity CHECK (severity IN ('low', 'medium', 'high'))
);

-- Indexes for alert queries
CREATE INDEX IF NOT EXISTS idx_propagation_alerts_user_id ON propagation_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_propagation_alerts_active ON propagation_alerts(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_propagation_alerts_expires ON propagation_alerts(expires_at) WHERE expires_at IS NOT NULL;

-- User propagation preferences table (for future features)
CREATE TABLE IF NOT EXISTS user_propagation_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    home_grid_locator VARCHAR(10),
    preferred_bands TEXT[], -- Array of preferred bands
    alert_solar_storms BOOLEAN DEFAULT TRUE,
    alert_enhanced_propagation BOOLEAN DEFAULT TRUE,
    alert_band_openings BOOLEAN DEFAULT FALSE,
    alert_aurora BOOLEAN DEFAULT FALSE,
    update_interval_minutes INTEGER DEFAULT 60 CHECK (update_interval_minutes >= 15),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Update triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at columns
CREATE TRIGGER update_solar_activity_updated_at 
    BEFORE UPDATE ON solar_activity 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_propagation_preferences_updated_at 
    BEFORE UPDATE ON user_propagation_preferences 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample data for testing (optional)
-- INSERT INTO solar_activity (timestamp, solar_flux_index, a_index, k_index) 
-- VALUES (CURRENT_TIMESTAMP, 120.5, 15.2, 2.3);

COMMENT ON TABLE solar_activity IS 'Solar activity data from space weather services';
COMMENT ON TABLE propagation_forecasts IS 'HF propagation forecasts and band conditions';
COMMENT ON TABLE propagation_alerts IS 'User-specific propagation alerts and notifications';
COMMENT ON TABLE user_propagation_preferences IS 'User preferences for propagation monitoring';

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON solar_activity TO nextlog;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON propagation_forecasts TO nextlog;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON propagation_alerts TO nextlog;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON user_propagation_preferences TO nextlog;

SELECT 'Propagation prediction tables created successfully!' as message;