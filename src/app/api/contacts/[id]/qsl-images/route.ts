// QSL image management API for specific contacts

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { uploadFile, deleteFile, isStorageAvailable } from '@/lib/storage';

interface QSLImage {
  id: number;
  contact_id: number;
  user_id: number;
  image_type: 'front' | 'back';
  filename: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  storage_url?: string;
  storage_type: string;
  width?: number;
  height?: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

/**
 * GET /api/contacts/[id]/qsl-images - Get QSL images for a contact
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Verify authentication first
  const user = await verifyToken(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const contactId = parseInt(id);
    
    if (isNaN(contactId)) {
      return NextResponse.json(
        { error: 'Invalid contact ID' },
        { status: 400 }
      );
    }

    // Check if contact belongs to user
    const contactResult = await query(
      'SELECT id FROM contacts WHERE id = $1 AND user_id = $2',
      [contactId, user.userId]
    );

    if (contactResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    // Get QSL images for this contact
    const result = await query(
      `SELECT id, contact_id, user_id, image_type, filename, original_filename, 
              file_size, mime_type, storage_path, storage_url, storage_type,
              width, height, description, created_at, updated_at
       FROM qsl_images 
       WHERE contact_id = $1 AND user_id = $2 
       ORDER BY image_type`,
      [contactId, user.userId]
    );

    const images: QSLImage[] = result.rows;

    return NextResponse.json({
      images,
      storage_available: await isStorageAvailable()
    });

  } catch (error) {
    console.error('Error fetching QSL images:', error);
    return NextResponse.json(
      { error: 'Failed to fetch QSL images' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/contacts/[id]/qsl-images - Upload QSL image for a contact
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Verify authentication first
  const user = await verifyToken(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const contactId = parseInt(id);
    
    if (isNaN(contactId)) {
      return NextResponse.json(
        { error: 'Invalid contact ID' },
        { status: 400 }
      );
    }

    // Check if storage is available
    if (!(await isStorageAvailable())) {
      return NextResponse.json(
        { error: 'File uploads are disabled. Please contact your administrator.' },
        { status: 503 }
      );
    }

    // Check if contact belongs to user
    const contactResult = await query(
      'SELECT id FROM contacts WHERE id = $1 AND user_id = $2',
      [contactId, user.userId]
    );

    if (contactResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const imageType = formData.get('image_type') as string;
    const description = formData.get('description') as string || null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!imageType || !['front', 'back'].includes(imageType)) {
      return NextResponse.json(
        { error: 'Invalid image type. Must be "front" or "back"' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to cloud storage
    const uploadResult = await uploadFile(
      buffer,
      file.name,
      file.type,
      contactId,
      imageType as 'front' | 'back'
    );

    if (!uploadResult.success) {
      return NextResponse.json(
        { error: uploadResult.error || 'Failed to upload file' },
        { status: 500 }
      );
    }

    // Check if image already exists for this type and replace it
    const existingResult = await query(
      'SELECT id, storage_path, storage_type FROM qsl_images WHERE contact_id = $1 AND user_id = $2 AND image_type = $3',
      [contactId, user.userId, imageType]
    );

    let imageRecord;

    if (existingResult.rows.length > 0) {
      // Update existing record
      const existing = existingResult.rows[0];
      
      // Delete old file from storage
      await deleteFile(existing.storage_path, existing.storage_type);
      
      const updateResult = await query(
        `UPDATE qsl_images 
         SET filename = $1, original_filename = $2, file_size = $3, mime_type = $4,
             storage_path = $5, storage_url = $6, storage_type = $7, description = $8,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $9
         RETURNING *`,
        [
          uploadResult.storage_path.split('/').pop(), // filename
          file.name, // original_filename
          file.size, // file_size
          file.type, // mime_type
          uploadResult.storage_path, // storage_path
          uploadResult.storage_url, // storage_url
          uploadResult.storage_type, // storage_type
          description, // description
          existing.id // id
        ]
      );
      
      imageRecord = updateResult.rows[0];
    } else {
      // Create new record
      const insertResult = await query(
        `INSERT INTO qsl_images 
         (contact_id, user_id, image_type, filename, original_filename, file_size, 
          mime_type, storage_path, storage_url, storage_type, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          contactId, // contact_id
          user.userId, // user_id
          imageType, // image_type
          uploadResult.storage_path.split('/').pop(), // filename
          file.name, // original_filename
          file.size, // file_size
          file.type, // mime_type
          uploadResult.storage_path, // storage_path
          uploadResult.storage_url, // storage_url
          uploadResult.storage_type, // storage_type
          description // description
        ]
      );
      
      imageRecord = insertResult.rows[0];
    }

    return NextResponse.json({
      success: true,
      image: imageRecord,
      message: `QSL ${imageType} image uploaded successfully`
    }, { status: 201 });

  } catch (error) {
    console.error('Error uploading QSL image:', error);
    return NextResponse.json(
      { error: 'Failed to upload QSL image' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/contacts/[id]/qsl-images - Delete QSL image
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Verify authentication first
  const user = await verifyToken(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const contactId = parseInt(id);
    const { searchParams } = new URL(request.url);
    const imageType = searchParams.get('type');
    
    if (isNaN(contactId)) {
      return NextResponse.json(
        { error: 'Invalid contact ID' },
        { status: 400 }
      );
    }

    if (!imageType || !['front', 'back'].includes(imageType)) {
      return NextResponse.json(
        { error: 'Invalid image type. Must be "front" or "back"' },
        { status: 400 }
      );
    }

    // Get image record
    const imageResult = await query(
      'SELECT * FROM qsl_images WHERE contact_id = $1 AND user_id = $2 AND image_type = $3',
      [contactId, user.userId, imageType]
    );

    if (imageResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'QSL image not found' },
        { status: 404 }
      );
    }

    const image = imageResult.rows[0];

    // Delete from cloud storage
    await deleteFile(image.storage_path, image.storage_type);

    // Delete from database
    await query(
      'DELETE FROM qsl_images WHERE id = $1',
      [image.id]
    );

    return NextResponse.json({
      success: true,
      message: `QSL ${imageType} image deleted successfully`
    });

  } catch (error) {
    console.error('Error deleting QSL image:', error);
    return NextResponse.json(
      { error: 'Failed to delete QSL image' },
      { status: 500 }
    );
  }
}