-- Add QRZ API key column to stations table
-- This migration adds the missing qrz_api_key column that is referenced in the Station model

-- Add the column if it doesn't exist
ALTER TABLE stations ADD COLUMN IF NOT EXISTS qrz_api_key VARCHAR(255);

-- Add index for better performance when looking up by API key
CREATE INDEX IF NOT EXISTS idx_stations_qrz_api_key ON stations(qrz_api_key);

SELECT 'QRZ API key column added successfully!' as message;