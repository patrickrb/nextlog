-- Migration: Add name column to lotw_credentials table
-- This migration adds the 'name' column to the lotw_credentials table

-- Add name column (allow NULL initially for existing records)
ALTER TABLE lotw_credentials ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Update existing records with a default name
UPDATE lotw_credentials 
SET name = 'old K1AF Certificate ' || id 
WHERE name IS NULL;

-- Make the column NOT NULL after populating existing records
ALTER TABLE lotw_credentials ALTER COLUMN name SET NOT NULL;
