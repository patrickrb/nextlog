-- Migration script to add admin features to existing NodeLog database
-- Run this script on existing databases to add role-based access control and storage configuration

-- Add role, status, and last_login columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user' NOT NULL,
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active' NOT NULL,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;

-- Add constraints for role and status validation
DO $$ 
BEGIN
    BEGIN
        ALTER TABLE users ADD CONSTRAINT valid_role CHECK (role IN ('user', 'admin', 'moderator'));
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
    
    BEGIN
        ALTER TABLE users ADD CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'suspended'));
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
END $$;

-- Create storage configuration table
CREATE TABLE IF NOT EXISTS storage_config (
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
CREATE TABLE IF NOT EXISTS admin_audit_log (
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

-- Create indexes for new columns and tables
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_callsign ON users(callsign);

CREATE INDEX IF NOT EXISTS idx_storage_config_type ON storage_config(config_type);
CREATE INDEX IF NOT EXISTS idx_storage_config_enabled ON storage_config(is_enabled);

CREATE INDEX IF NOT EXISTS idx_audit_log_admin_user ON admin_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON admin_audit_log(target_type, target_id);

-- Create trigger for storage config updated_at
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_storage_config_updated_at') THEN
        CREATE TRIGGER update_storage_config_updated_at 
            BEFORE UPDATE ON storage_config 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Create function to update last_login timestamp
CREATE OR REPLACE FUNCTION update_last_login()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_login = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Print success message
SELECT 'Admin features migration completed successfully!' as message;