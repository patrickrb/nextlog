// SSTV Image Upload API - Handle file uploads for decoded SSTV images

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { uploadFile } from '@/lib/storage';

/**
 * POST /api/sstv-images/upload - Upload SSTV image file to storage
 */
export async function POST(request: NextRequest) {
  const user = await verifyToken(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/bmp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PNG, JPEG, BMP' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB for SSTV images)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size: 10MB' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const extension = file.name.split('.').pop() || 'png';
    const filename = `sstv_${timestamp}_${randomSuffix}.${extension}`;

    // Convert file to buffer for upload
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to storage - using contact_id=0 and 'front' as placeholder for SSTV images
    const uploadResult = await uploadFile(buffer, filename, file.type, 0, 'front');

    return NextResponse.json({
      success: true,
      filename,
      original_filename: file.name,
      file_size: file.size,
      mime_type: file.type,
      storage_path: uploadResult.storage_path,
      storage_url: uploadResult.storage_url
    });

  } catch (error) {
    console.error('SSTV image upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}