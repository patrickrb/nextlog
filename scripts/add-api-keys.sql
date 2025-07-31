-- API Keys Table Migration
-- Adds support for user-generated API keys for Cloudlog compatibility

-- Create api_keys table
CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    station_id INTEGER REFERENCES stations(id) ON DELETE CASCADE,
    
    -- API key information
    key_name VARCHAR(255) NOT NULL,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    api_secret VARCHAR(255) NOT NULL, -- Hashed secret for verification
    
    -- Permissions and settings
    is_enabled BOOLEAN DEFAULT true NOT NULL,
    read_only BOOLEAN DEFAULT false NOT NULL,
    allowed_endpoints TEXT[], -- Array of allowed endpoint patterns
    rate_limit_per_hour INTEGER DEFAULT 1000,
    
    -- Usage tracking
    last_used_at TIMESTAMP,
    total_requests INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP, -- Optional expiration date
    
    -- Indexes
    CONSTRAINT unique_user_key_name UNIQUE (user_id, key_name)
);

-- Create indexes for performance
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_station_id ON api_keys(station_id);
CREATE INDEX idx_api_keys_api_key ON api_keys(api_key);
CREATE INDEX idx_api_keys_enabled ON api_keys(is_enabled);
CREATE INDEX idx_api_keys_last_used ON api_keys(last_used_at);

-- Create api_key_usage_logs table for detailed logging
CREATE TABLE api_key_usage_logs (
    id SERIAL PRIMARY KEY,
    api_key_id INTEGER NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    
    -- Request details
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    
    -- Response details
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER,
    bytes_sent INTEGER,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Error details (if applicable)
    error_message TEXT
);

-- Create indexes for api_key_usage_logs
CREATE INDEX idx_api_usage_logs_api_key_id ON api_key_usage_logs(api_key_id);
CREATE INDEX idx_api_usage_logs_created_at ON api_key_usage_logs(created_at);
CREATE INDEX idx_api_usage_logs_endpoint ON api_key_usage_logs(endpoint);
CREATE INDEX idx_api_usage_logs_status_code ON api_key_usage_logs(status_code);

-- Create trigger to update api_keys.updated_at
CREATE OR REPLACE FUNCTION update_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_api_keys_updated_at();

-- Create function to generate secure API keys
CREATE OR REPLACE FUNCTION generate_api_key()
RETURNS TEXT AS $$
DECLARE
    key_prefix TEXT := 'nextlog_';
    random_part TEXT;
BEGIN
    -- Generate a 32-character random string
    SELECT string_agg(
        substr('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 
               floor(random() * 62)::int + 1, 1),
        ''
    )
    FROM generate_series(1, 32) INTO random_part;
    
    RETURN key_prefix || random_part;
END;
$$ LANGUAGE plpgsql;

-- Create function to validate API key format
CREATE OR REPLACE FUNCTION is_valid_api_key_format(key TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN key ~ '^nextlog_[A-Za-z0-9]{32}$';
END;
$$ LANGUAGE plpgsql;

-- Add constraint to ensure API key format
ALTER TABLE api_keys ADD CONSTRAINT check_api_key_format 
    CHECK (is_valid_api_key_format(api_key));

-- Create view for API key statistics
CREATE VIEW api_key_stats AS
SELECT 
    ak.id,
    ak.user_id,
    ak.station_id,
    ak.key_name,
    ak.is_enabled,
    ak.read_only,
    ak.rate_limit_per_hour,
    ak.total_requests,
    ak.last_used_at,
    ak.created_at,
    ak.expires_at,
    u.email as user_email,
    u.callsign as user_callsign,
    s.callsign as station_callsign,
    s.station_name,
    -- Usage statistics from last 24 hours
    COALESCE(recent_stats.requests_24h, 0) as requests_last_24h,
    COALESCE(recent_stats.avg_response_time, 0) as avg_response_time_24h,
    COALESCE(recent_stats.error_count_24h, 0) as errors_last_24h
FROM api_keys ak
JOIN users u ON ak.user_id = u.id
LEFT JOIN stations s ON ak.station_id = s.id
LEFT JOIN (
    SELECT 
        api_key_id,
        COUNT(*) as requests_24h,
        AVG(response_time_ms) as avg_response_time,
        COUNT(*) FILTER (WHERE status_code >= 400) as error_count_24h
    FROM api_key_usage_logs 
    WHERE created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY api_key_id
) recent_stats ON ak.id = recent_stats.api_key_id;

-- Insert some example data (commented out for production)
/*
-- Example API key for testing (DO NOT USE IN PRODUCTION)
INSERT INTO api_keys (user_id, key_name, api_key, api_secret, is_enabled, read_only)
SELECT 
    u.id,
    'Test API Key',
    'nextlog_test1234567890abcdef1234567890ab',
    '$2b$10$example.hash.for.secret.key.value',
    true,
    false
FROM users u 
WHERE u.email = 'test@example.com'
LIMIT 1;
*/

COMMENT ON TABLE api_keys IS 'Stores user-generated API keys for Cloudlog compatibility';
COMMENT ON TABLE api_key_usage_logs IS 'Logs all API requests for monitoring and rate limiting';
COMMENT ON VIEW api_key_stats IS 'Provides comprehensive statistics for API key usage';