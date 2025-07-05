-- Add latitude and longitude fields to contacts table
ALTER TABLE contacts 
ADD COLUMN latitude DECIMAL(10, 8),
ADD COLUMN longitude DECIMAL(11, 8);

-- Create index for geospatial queries
CREATE INDEX idx_contacts_location ON contacts(latitude, longitude);

-- Print success message
SELECT 'Location fields added successfully!' as message;