-- LoTW Integration Migration for Nextlog
-- Add additional tables and fields needed for full LoTW support

-- Add LoTW password and certificate storage to stations table
ALTER TABLE stations ADD COLUMN IF NOT EXISTS lotw_password VARCHAR(255);
ALTER TABLE stations ADD COLUMN IF NOT EXISTS lotw_p12_cert BYTEA;
ALTER TABLE stations ADD COLUMN IF NOT EXISTS lotw_cert_created_at TIMESTAMP;

-- Add additional LoTW tracking fields to contacts table
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS qsl_lotw BOOLEAN DEFAULT FALSE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS qsl_lotw_date DATE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lotw_match_status VARCHAR(20) CHECK (lotw_match_status IN ('confirmed', 'partial', 'mismatch', null));

-- Create LoTW credentials table for certificate management
CREATE TABLE IF NOT EXISTS lotw_credentials (
    id SERIAL PRIMARY KEY,
    station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    callsign VARCHAR(50) NOT NULL,
    p12_cert BYTEA NOT NULL,
    cert_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cert_expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create LoTW upload logs table
CREATE TABLE IF NOT EXISTS lotw_upload_logs (
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
CREATE TABLE IF NOT EXISTS lotw_download_logs (
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
CREATE TABLE IF NOT EXISTS lotw_job_queue (
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

-- Add third_party_services JSONB field to users table for secure credential storage
ALTER TABLE users ADD COLUMN IF NOT EXISTS third_party_services JSONB DEFAULT '{}';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_lotw_credentials_station_id ON lotw_credentials(station_id);
CREATE INDEX IF NOT EXISTS idx_lotw_credentials_callsign ON lotw_credentials(callsign);
CREATE INDEX IF NOT EXISTS idx_lotw_credentials_is_active ON lotw_credentials(is_active);

CREATE INDEX IF NOT EXISTS idx_lotw_upload_logs_station_id ON lotw_upload_logs(station_id);
CREATE INDEX IF NOT EXISTS idx_lotw_upload_logs_user_id ON lotw_upload_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_lotw_upload_logs_status ON lotw_upload_logs(status);
CREATE INDEX IF NOT EXISTS idx_lotw_upload_logs_started_at ON lotw_upload_logs(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_lotw_download_logs_station_id ON lotw_download_logs(station_id);
CREATE INDEX IF NOT EXISTS idx_lotw_download_logs_user_id ON lotw_download_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_lotw_download_logs_status ON lotw_download_logs(status);
CREATE INDEX IF NOT EXISTS idx_lotw_download_logs_started_at ON lotw_download_logs(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_lotw_job_queue_status ON lotw_job_queue(status);
CREATE INDEX IF NOT EXISTS idx_lotw_job_queue_job_type ON lotw_job_queue(job_type);
CREATE INDEX IF NOT EXISTS idx_lotw_job_queue_station_id ON lotw_job_queue(station_id);
CREATE INDEX IF NOT EXISTS idx_lotw_job_queue_scheduled_at ON lotw_job_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_lotw_job_queue_priority ON lotw_job_queue(priority);
CREATE INDEX IF NOT EXISTS idx_lotw_job_queue_is_running ON lotw_job_queue(is_running);

CREATE INDEX IF NOT EXISTS idx_contacts_qsl_lotw ON contacts(qsl_lotw);
CREATE INDEX IF NOT EXISTS idx_contacts_qsl_lotw_date ON contacts(qsl_lotw_date);
CREATE INDEX IF NOT EXISTS idx_contacts_lotw_match_status ON contacts(lotw_match_status);

-- Add triggers for timestamp updates on new tables
CREATE TRIGGER IF NOT EXISTS update_lotw_credentials_updated_at 
    BEFORE UPDATE ON lotw_credentials 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_lotw_job_queue_updated_at 
    BEFORE UPDATE ON lotw_job_queue 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Print success message
SELECT 'LoTW migration completed successfully!' as message;