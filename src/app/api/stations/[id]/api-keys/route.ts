// API Key Management endpoints for stations
// GET: List API keys for station
// POST: Create new API key for station

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import * as crypto from 'crypto';

// Helper function to generate secure API key
function generateApiKey(): string {
  const prefix = 'nextlog_';
  const randomBytes = crypto.randomBytes(16);
  const randomString = randomBytes.toString('hex');
  return prefix + randomString;
}


// GET /api/stations/[id]/api-keys - List API keys for station
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: stationId } = await params;

    // Verify user owns this station
    const stationResult = await query(
      'SELECT user_id FROM stations WHERE id = $1',
      [parseInt(stationId)]
    );

    if (stationResult.rows.length === 0) {
      return NextResponse.json({ error: 'Station not found' }, { status: 404 });
    }

    if (stationResult.rows[0].user_id !== parseInt(user.userId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get API keys for this station (excluding the actual secret)
    const apiKeysResult = await query(`
      SELECT 
        id,
        key_name,
        api_key,
        is_active,
        read_only,
        permissions,
        last_used_at,
        total_requests,
        rate_limit_per_hour,
        created_at,
        expires_at,
        description
      FROM api_keys 
      WHERE station_id = $1 
      ORDER BY created_at DESC
    `, [parseInt(stationId)]);

    return NextResponse.json({
      success: true,
      api_keys: apiKeysResult.rows
    });

  } catch (error) {
    console.error('API key list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/stations/[id]/api-keys - Create new API key
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: stationId } = await params;
    const body = await request.json();

    const {
      key_name,
      permissions = { read: true, write: false, delete: false },
      expires_in_days,
      description = ''
    } = body;

    // Validate required fields
    if (!key_name || !key_name.trim()) {
      return NextResponse.json(
        { error: 'Key name is required' },
        { status: 400 }
      );
    }

    // Verify user owns this station
    const stationResult = await query(
      'SELECT user_id FROM stations WHERE id = $1',
      [parseInt(stationId)]
    );

    if (stationResult.rows.length === 0) {
      return NextResponse.json({ error: 'Station not found' }, { status: 404 });
    }

    if (stationResult.rows[0].user_id !== parseInt(user.userId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check if user already has a key with this name for this station
    const existingKeyResult = await query(
      'SELECT id FROM api_keys WHERE user_id = $1 AND station_id = $2 AND key_name = $3',
      [parseInt(user.userId), parseInt(stationId), key_name.trim()]
    );

    if (existingKeyResult.rows.length > 0) {
      return NextResponse.json(
        { error: 'An API key with this name already exists for this station' },
        { status: 409 }
      );
    }

    // Generate API key and hash
    const apiKey = generateApiKey();
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    // Calculate expiration date if specified
    let expiresAt = null;
    if (expires_in_days && expires_in_days > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expires_in_days);
    }

    // Insert the new API key
    const insertResult = await query(`
      INSERT INTO api_keys (
        user_id,
        station_id,
        key_name,
        api_key,
        key_hash,
        permissions,
        is_active,
        expires_at,
        description
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, created_at
    `, [
      parseInt(user.userId),
      parseInt(stationId),
      key_name.trim(),
      apiKey,
      keyHash,
      JSON.stringify(permissions),
      true, // enabled by default
      expiresAt,
      description
    ]);

    return NextResponse.json({
      success: true,
      message: 'API key created successfully',
      api_key: apiKey,
      id: insertResult.rows[0].id,
      created_at: insertResult.rows[0].created_at
    });

  } catch (error) {
    console.error('API key creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}