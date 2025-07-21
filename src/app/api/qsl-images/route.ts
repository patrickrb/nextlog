// QSL images gallery API - Get all QSL images for the authenticated user

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { isStorageAvailable } from '@/lib/storage';

interface QSLImageWithContact {
  id: number;
  contact_id: number;
  image_type: 'front' | 'back';
  filename: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  storage_url?: string;
  width?: number;
  height?: number;
  description?: string;
  created_at: string;
  updated_at: string;
  // Contact information
  callsign: string;
  datetime: string;
  frequency: string;
  mode: string;
  qth?: string;
}

/**
 * GET /api/qsl-images - Get all QSL images for the authenticated user
 */
export async function GET(request: NextRequest) {
  // Verify authentication first
  const user = await verifyToken(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const imageType = searchParams.get('type'); // front, back, or null for all
    
    const offset = (page - 1) * limit;

    // Build query with optional image type filter
    let whereClause = 'WHERE qi.user_id = $1';
    let params: any[] = [user.userId];
    
    if (imageType && ['front', 'back'].includes(imageType)) {
      whereClause += ' AND qi.image_type = $2';
      params.push(imageType);
    }

    // Get QSL images with contact information
    const result = await query(
      `SELECT 
        qi.id, qi.contact_id, qi.image_type, qi.filename, qi.original_filename,
        qi.file_size, qi.mime_type, qi.storage_url, qi.width, qi.height,
        qi.description, qi.created_at, qi.updated_at,
        c.callsign, c.datetime, c.frequency, c.mode, c.qth
       FROM qsl_images qi
       JOIN contacts c ON qi.contact_id = c.id
       ${whereClause}
       ORDER BY qi.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    // Get total count for pagination
    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM qsl_images qi
       JOIN contacts c ON qi.contact_id = c.id
       ${whereClause}`,
      params
    );

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    const images: QSLImageWithContact[] = result.rows;

    return NextResponse.json({
      images,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage,
        hasPrevPage
      },
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