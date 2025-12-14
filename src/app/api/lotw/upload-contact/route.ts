// LoTW Single Contact Upload API endpoint

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { generateAdifForLoTW, signAdifWithCertificate } from '@/lib/lotw';
import { ContactWithLoTW } from '@/types/lotw';

export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { contact_id } = body;

    if (!contact_id) {
      return NextResponse.json({
        error: 'contact_id is required'
      }, { status: 400 });
    }

    // Get the contact and verify ownership
    const contactResult = await query(
      `SELECT c.*, s.callsign as station_callsign, s.id as station_id
       FROM contacts c
       JOIN stations s ON c.station_id = s.id
       WHERE c.id = $1 AND c.user_id = $2`,
      [contact_id, parseInt(user.userId)]
    );

    if (contactResult.rows.length === 0) {
      return NextResponse.json({
        error: 'Contact not found or access denied'
      }, { status: 404 });
    }

    const contact: ContactWithLoTW & { station_callsign: string; station_id: number } = contactResult.rows[0];

    // Check if already uploaded
    if (contact.lotw_qsl_sent === 'Y') {
      return NextResponse.json({
        success: false,
        error: 'Contact already uploaded to LoTW'
      }, { status: 400 });
    }

    // Get active LoTW certificate for this station
    const certResult = await query(
      'SELECT id, p12_cert FROM lotw_credentials WHERE station_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1',
      [contact.station_id]
    );

    if (certResult.rows.length === 0) {
      return NextResponse.json({
        error: 'No active LoTW certificate found for this station. Please upload a certificate first.'
      }, { status: 400 });
    }

    const certificate = certResult.rows[0];

    // Generate ADIF content for single contact
    const adifContent = generateAdifForLoTW([contact], contact.station_callsign);

    // Sign ADIF file with certificate
    let signedContent: string;
    try {
      signedContent = await signAdifWithCertificate(
        adifContent,
        certificate.p12_cert,
        contact.station_callsign
      );
    } catch (signError) {
      console.error('ADIF signing error:', signError);
      return NextResponse.json({
        success: false,
        error: `Failed to sign ADIF file: ${signError instanceof Error ? signError.message : 'Unknown error'}`
      }, { status: 500 });
    }

    // Upload to LoTW
    let lotwResponse = '';
    try {
      const uploadResponse = await fetch('https://lotw.arrl.org/lotwuser/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${contact.station_callsign}.tq8"`,
        },
        body: signedContent,
      });

      lotwResponse = await uploadResponse.text();

      if (!uploadResponse.ok) {
        throw new Error(`LoTW upload failed: ${uploadResponse.status} ${lotwResponse}`);
      }

    } catch (uploadError) {
      console.error('LoTW upload error:', uploadError);
      return NextResponse.json({
        success: false,
        error: `Upload to LoTW failed: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`
      }, { status: 500 });
    }

    // Mark contact as uploaded to LoTW
    await query(
      `UPDATE contacts
       SET lotw_qsl_sent = 'Y', updated_at = NOW()
       WHERE id = $1`,
      [contact_id]
    );

    return NextResponse.json({
      success: true,
      message: 'Contact uploaded to LoTW successfully',
      lotw_response: lotwResponse
    });

  } catch (error) {
    console.error('LoTW single contact upload error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}
