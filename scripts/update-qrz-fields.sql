-- Update QRZ fields for proper authentication
ALTER TABLE users 
DROP COLUMN IF EXISTS qrz_api_key,
ADD COLUMN qrz_username VARCHAR(255),
ADD COLUMN qrz_password VARCHAR(255);

-- Print success message
SELECT 'QRZ authentication fields updated successfully!' as message;