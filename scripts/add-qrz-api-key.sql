-- Add QRZ API key field to users table
ALTER TABLE users 
ADD COLUMN qrz_api_key VARCHAR(255);

-- Print success message
SELECT 'QRZ API key field added successfully!' as message;