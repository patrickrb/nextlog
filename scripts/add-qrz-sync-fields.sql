-- Add QRZ sync status tracking fields to contacts table
-- This migration adds fields to track QRZ logbook sync status

-- Add enum type for QRZ sync status
DO $$ BEGIN
    CREATE TYPE qrz_sync_status_enum AS ENUM ('not_synced', 'synced', 'error', 'already_exists');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add QRZ sync fields to contacts table
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS qrz_sync_status qrz_sync_status_enum DEFAULT 'not_synced',
ADD COLUMN IF NOT EXISTS qrz_sync_date TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS qrz_logbook_id INTEGER NULL,
ADD COLUMN IF NOT EXISTS qrz_sync_error TEXT NULL;

-- Add index for sync status queries
CREATE INDEX IF NOT EXISTS idx_contacts_qrz_sync_status ON contacts(qrz_sync_status);
CREATE INDEX IF NOT EXISTS idx_contacts_qrz_sync_date ON contacts(qrz_sync_date);

-- Add auto-sync setting to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS qrz_auto_sync BOOLEAN DEFAULT FALSE;

-- Add auto-sync setting to stations table  
ALTER TABLE stations
ADD COLUMN IF NOT EXISTS qrz_auto_sync BOOLEAN DEFAULT FALSE;