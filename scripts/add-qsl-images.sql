-- Add QSL card images functionality
-- This script adds a table to store QSL card images for contacts

-- Create qsl_images table
CREATE TABLE IF NOT EXISTS qsl_images (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Image metadata
    image_type VARCHAR(10) NOT NULL CHECK (image_type IN ('front', 'back')),
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/jpg', 'image/png', 'image/webp')),
    
    -- Storage information
    storage_path VARCHAR(500) NOT NULL, -- Path in cloud storage
    storage_url VARCHAR(500), -- Public URL if available
    storage_type VARCHAR(20) DEFAULT 'azure_blob' CHECK (storage_type IN ('azure_blob', 'aws_s3')),
    
    -- Image dimensions (optional, for display optimization)
    width INTEGER,
    height INTEGER,
    
    -- Metadata
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure only one front and one back image per contact
    UNIQUE (contact_id, image_type)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_qsl_images_contact_id ON qsl_images(contact_id);
CREATE INDEX IF NOT EXISTS idx_qsl_images_user_id ON qsl_images(user_id);
CREATE INDEX IF NOT EXISTS idx_qsl_images_type ON qsl_images(image_type);
CREATE INDEX IF NOT EXISTS idx_qsl_images_created_at ON qsl_images(created_at DESC);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_qsl_images_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_qsl_images_updated_at ON qsl_images;
CREATE TRIGGER update_qsl_images_updated_at
    BEFORE UPDATE ON qsl_images
    FOR EACH ROW EXECUTE FUNCTION update_qsl_images_updated_at_column();

-- Insert a success message
SELECT 'QSL images table created successfully!' as message;