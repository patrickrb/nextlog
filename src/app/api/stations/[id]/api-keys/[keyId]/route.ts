// Individual API Key Management endpoints
// PATCH: Update API key settings (enable/disable, etc.)
// DELETE: Delete API key

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';

// PATCH /api/stations/[id]/api-keys/[keyId] - Update API key
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; keyId: string }> }
) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: stationId, keyId } = await params;
    const body = await request.json();

    // Verify user owns this station and API key
    const keyResult = await query(`
      SELECT ak.id, ak.user_id, ak.station_id, s.user_id as station_user_id
      FROM api_keys ak
      JOIN stations s ON ak.station_id = s.id
      WHERE ak.id = $1 AND ak.station_id = $2
    `, [parseInt(keyId), parseInt(stationId)]);

    if (keyResult.rows.length === 0) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    const apiKeyRecord = keyResult.rows[0];
    if (apiKeyRecord.user_id !== parseInt(user.userId) || 
        apiKeyRecord.station_user_id !== parseInt(user.userId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Build update query dynamically based on provided fields
    const allowedFields = ['is_enabled', 'read_only', 'rate_limit_per_hour'];
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updates.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Add updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    // Add WHERE clause parameters
    values.push(parseInt(keyId));
    const whereParam = paramIndex;

    const updateQuery = `
      UPDATE api_keys 
      SET ${updates.join(', ')}
      WHERE id = $${whereParam}
      RETURNING id, key_name, is_enabled, read_only, rate_limit_per_hour, updated_at
    `;

    const updateResult = await query(updateQuery, values);

    return NextResponse.json({
      success: true,
      message: 'API key updated successfully',
      api_key: updateResult.rows[0]
    });

  } catch (error) {
    console.error('API key update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/stations/[id]/api-keys/[keyId] - Delete API key
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; keyId: string }> }
) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: stationId, keyId } = await params;

    // Verify user owns this station and API key
    const keyResult = await query(`
      SELECT ak.id, ak.key_name, ak.user_id, ak.station_id, s.user_id as station_user_id
      FROM api_keys ak
      JOIN stations s ON ak.station_id = s.id
      WHERE ak.id = $1 AND ak.station_id = $2
    `, [parseInt(keyId), parseInt(stationId)]);

    if (keyResult.rows.length === 0) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    const apiKeyRecord = keyResult.rows[0];
    if (apiKeyRecord.user_id !== parseInt(user.userId) || 
        apiKeyRecord.station_user_id !== parseInt(user.userId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Delete the API key (cascade will handle usage logs)
    await query('DELETE FROM api_keys WHERE id = $1', [parseInt(keyId)]);

    return NextResponse.json({
      success: true,
      message: `API key "${apiKeyRecord.key_name}" deleted successfully`
    });

  } catch (error) {
    console.error('API key deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}