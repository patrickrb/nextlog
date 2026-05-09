// LoTW Certificate Upload API endpoint

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { encryptString, readCertMetadata } from '@/lib/lotw';
import { LotwCertificateResponse } from '@/types/lotw';

export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('p12_file') as File;
    const stationId = formData.get('station_id') as string;
    const callsign = formData.get('callsign') as string;
    const certName = formData.get('cert_name') as string;
    // Optional — TQSL exports without a password are common; node-forge accepts ''.
    const p12Password = (formData.get('p12_password') as string | null) ?? '';

    if (!file || !stationId || !callsign || !certName) {
      return NextResponse.json({
        error: 'Missing required fields: p12_file, station_id, callsign, cert_name'
      }, { status: 400 });
    }

    // Validate file type
    if (!file.name.endsWith('.p12') && !file.name.endsWith('.pfx')) {
      return NextResponse.json({ 
        error: 'Invalid file type. Please upload a .p12 or .pfx certificate file.' 
      }, { status: 400 });
    }

    // Verify station belongs to user
    const stationResult = await query(
      'SELECT id, callsign FROM stations WHERE id = $1 AND user_id = $2',
      [parseInt(stationId), parseInt(user.userId)]
    );

    if (stationResult.rows.length === 0) {
      return NextResponse.json({ 
        error: 'Station not found or access denied' 
      }, { status: 404 });
    }

    const station = stationResult.rows[0];

    // Verify callsign matches station callsign
    if (station.callsign.toLowerCase() !== callsign.toLowerCase()) {
      return NextResponse.json({ 
        error: 'Callsign does not match station callsign' 
      }, { status: 400 });
    }

    // Read file content
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Basic validation of P12 file (check if it's not empty and has reasonable size)
    if (fileBuffer.length === 0) {
      return NextResponse.json({ 
        error: 'Certificate file is empty' 
      }, { status: 400 });
    }

    if (fileBuffer.length > 10 * 1024 * 1024) { // 10MB limit
      return NextResponse.json({ 
        error: 'Certificate file is too large (max 10MB)' 
      }, { status: 400 });
    }

    // Validate the P12 by parsing it with the supplied password. This catches
    // wrong-password / corrupt-file uploads before they sit unusable in the DB.
    let certMeta: { serial: string; notAfter?: Date; dxcc?: number };
    try {
      certMeta = readCertMetadata(fileBuffer, p12Password);
    } catch (parseError) {
      const msg = parseError instanceof Error ? parseError.message : 'Unknown error';
      // node-forge throws "PKCS#12 MAC could not be verified" / similar on bad password
      const isPasswordError = /mac|password|invalid|decrypt/i.test(msg);
      return NextResponse.json({
        error: isPasswordError
          ? 'Could not parse certificate with the supplied password. Re-export from TQSL and re-enter the password.'
          : `Certificate parse failed: ${msg}`
      }, { status: 400 });
    }

    // Check if certificate already exists for this station
    const existingCertResult = await query(
      'SELECT id FROM lotw_credentials WHERE station_id = $1 AND is_active = true',
      [parseInt(stationId)]
    );

    if (existingCertResult.rows.length > 0) {
      // Deactivate existing certificate
      await query(
        'UPDATE lotw_credentials SET is_active = false WHERE station_id = $1',
        [parseInt(stationId)]
      );
    }

    // Encrypt the P12 password at rest. Empty string is encrypted as well so
    // the upload route can simply decrypt-or-default; storing NULL would
    // require a branch in every read path.
    const encryptedPassword = encryptString(p12Password);

    // Store new certificate + metadata extracted from the P12.
    const insertResult = await query(
      `INSERT INTO lotw_credentials
       (station_id, name, callsign, p12_cert, p12_password,
        cert_serial, cert_created_at, cert_expires_at, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, true)
       RETURNING id, cert_created_at, cert_expires_at`,
      [
        parseInt(stationId),
        certName.trim(),
        callsign.toUpperCase(),
        fileBuffer,
        encryptedPassword,
        certMeta.serial,
        certMeta.notAfter ?? null,
      ]
    );

    const newCredential = insertResult.rows[0];

    const response: LotwCertificateResponse = {
      success: true,
      credential_id: newCredential.id,
      cert_expires_at: newCredential.cert_expires_at
        ? new Date(newCredential.cert_expires_at).toISOString()
        : undefined,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Certificate upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const stationId = searchParams.get('station_id');

    if (!stationId) {
      return NextResponse.json({ 
        error: 'station_id parameter is required' 
      }, { status: 400 });
    }

    // Verify station belongs to user
    const stationResult = await query(
      'SELECT id, callsign FROM stations WHERE id = $1 AND user_id = $2',
      [parseInt(stationId), parseInt(user.userId)]
    );

    if (stationResult.rows.length === 0) {
      return NextResponse.json({ 
        error: 'Station not found or access denied' 
      }, { status: 404 });
    }

    // Get certificate info (without the actual certificate data)
    const certResult = await query(
      `SELECT id, name, callsign, cert_created_at, cert_expires_at, is_active, created_at
       FROM lotw_credentials
       WHERE station_id = $1
       ORDER BY created_at DESC`,
      [parseInt(stationId)]
    );

    return NextResponse.json({
      station_id: parseInt(stationId),
      certificates: certResult.rows
    });

  } catch (error) {
    console.error('Certificate retrieval error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const credentialId = searchParams.get('credential_id');

    if (!credentialId) {
      return NextResponse.json({ 
        error: 'credential_id parameter is required' 
      }, { status: 400 });
    }

    // Verify credential belongs to user's station
    const certResult = await query(
      `SELECT lc.id, lc.station_id
       FROM lotw_credentials lc
       JOIN stations s ON lc.station_id = s.id
       WHERE lc.id = $1 AND s.user_id = $2`,
      [parseInt(credentialId), parseInt(user.userId)]
    );

    if (certResult.rows.length === 0) {
      return NextResponse.json({
        error: 'Certificate not found or access denied'
      }, { status: 404 });
    }

    // Deactivate the certificate (don't delete for audit purposes)
    await query(
      'UPDATE lotw_credentials SET is_active = false WHERE id = $1',
      [parseInt(credentialId)]
    );

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Certificate deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}