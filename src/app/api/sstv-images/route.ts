// SSTV images gallery API - Get all SSTV images for the authenticated user

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { isStorageAvailable } from '@/lib/storage';

interface SSTVImageWithContact {
  id: number;
  contact_id?: number;
  station_id?: number;
  frequency_mhz?: number;
  mode: string;
  sstv_mode?: string;
  decode_timestamp: string;
  signal_strength?: number;
  filename: string;
  original_filename?: string;
  file_size: number;
  mime_type: string;
  storage_url?: string;
  width?: number;
  height?: number;
  quality_score?: number;
  radio_model?: string;
  cat_interface?: string;
  audio_source?: string;
  callsign_detected?: string;
  location_detected?: string;
  description?: string;
  tags?: string[];
  auto_linked: boolean;
  manual_review: boolean;
  created_at: string;
  updated_at: string;
  // Contact information (if linked)
  callsign?: string;
  datetime?: string;
  contact_frequency?: string;
  contact_mode?: string;
  qth?: string;
}

/**
 * GET /api/sstv-images - Get all SSTV images for the authenticated user
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
    const mode = searchParams.get('mode'); // Filter by SSTV mode
    const stationId = searchParams.get('station_id'); // Filter by station
    const linkedOnly = searchParams.get('linked_only') === 'true'; // Only show linked to QSOs
    const unlinkedOnly = searchParams.get('unlinked_only') === 'true'; // Only show unlinked
    const needsReview = searchParams.get('needs_review') === 'true'; // Only show needing review
    
    const offset = (page - 1) * limit;

    // Build query with optional filters
    let whereClause = 'WHERE si.user_id = $1';
    const params: (string | number)[] = [user.userId];
    let paramCount = 1;
    
    if (mode) {
      paramCount++;
      whereClause += ` AND si.sstv_mode = $${paramCount}`;
      params.push(mode);
    }
    
    if (stationId) {
      paramCount++;
      whereClause += ` AND si.station_id = $${paramCount}`;
      params.push(parseInt(stationId));
    }
    
    if (linkedOnly) {
      whereClause += ' AND si.contact_id IS NOT NULL';
    }
    
    if (unlinkedOnly) {
      whereClause += ' AND si.contact_id IS NULL';
    }
    
    if (needsReview) {
      whereClause += ' AND si.manual_review = TRUE';
    }

    // Get SSTV images with optional contact information
    const result = await query(
      `SELECT 
        si.id, si.contact_id, si.station_id, si.frequency_mhz, si.mode, si.sstv_mode,
        si.decode_timestamp, si.signal_strength, si.filename, si.original_filename,
        si.file_size, si.mime_type, si.storage_url, si.width, si.height,
        si.quality_score, si.radio_model, si.cat_interface, si.audio_source,
        si.callsign_detected, si.location_detected, si.description, si.tags,
        si.auto_linked, si.manual_review, si.created_at, si.updated_at,
        c.callsign, c.datetime, c.frequency as contact_frequency, c.mode as contact_mode, c.qth
       FROM sstv_images si
       LEFT JOIN contacts c ON si.contact_id = c.id
       ${whereClause}
       ORDER BY si.decode_timestamp DESC
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...params, limit, offset]
    );

    // Get total count for pagination
    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM sstv_images si
       LEFT JOIN contacts c ON si.contact_id = c.id
       ${whereClause}`,
      params
    );

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    const images: SSTVImageWithContact[] = result.rows;

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
    console.error('Error fetching SSTV images:', error);
    return NextResponse.json(
      { error: 'Failed to fetch SSTV images' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sstv-images - Create a new SSTV image record (for when image is decoded)
 */
export async function POST(request: NextRequest) {
  const user = await verifyToken(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      contact_id,
      station_id,
      frequency_mhz,
      mode = 'SSTV',
      sstv_mode,
      signal_strength,
      filename,
      original_filename,
      file_size,
      mime_type,
      storage_path,
      storage_url,
      storage_type = 'azure_blob',
      width,
      height,
      quality_score,
      radio_model,
      cat_interface,
      audio_source,
      callsign_detected,
      location_detected,
      description,
      tags,
      auto_linked = false,
      manual_review = false
    } = body;

    // Validate required fields
    if (!filename || !file_size || !mime_type || !storage_path) {
      return NextResponse.json(
        { error: 'Missing required fields: filename, file_size, mime_type, storage_path' },
        { status: 400 }
      );
    }

    // Insert the new SSTV image record
    const result = await query(
      `INSERT INTO sstv_images (
        user_id, contact_id, station_id, frequency_mhz, mode, sstv_mode,
        signal_strength, filename, original_filename, file_size, mime_type,
        storage_path, storage_url, storage_type, width, height, quality_score,
        radio_model, cat_interface, audio_source, callsign_detected,
        location_detected, description, tags, auto_linked, manual_review
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
      ) RETURNING *`,
      [
        user.userId, contact_id || null, station_id || null,
        frequency_mhz || null, mode, sstv_mode || null,
        signal_strength || null, filename, original_filename || null,
        file_size, mime_type, storage_path, storage_url || null,
        storage_type, width || null, height || null, quality_score || null,
        radio_model || null, cat_interface || null, audio_source || null,
        callsign_detected || null, location_detected || null,
        description || null, tags || null, auto_linked, manual_review
      ]
    );

    const createdImage = result.rows[0];

    return NextResponse.json({
      success: true,
      image: createdImage
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating SSTV image record:', error);
    return NextResponse.json(
      { error: 'Failed to create SSTV image record' },
      { status: 500 }
    );
  }
}