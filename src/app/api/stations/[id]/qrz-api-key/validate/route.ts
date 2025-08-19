import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { Station } from '@/models/Station';
import { validateQRZApiKey } from '@/lib/qrz';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
    const { id } = await params;
    const stationId = parseInt(id);
    const body = await request.json();
    const { qrz_api_key } = body;

    if (!qrz_api_key?.trim()) {
      return NextResponse.json({ 
        error: 'QRZ API key is required' 
      }, { status: 400 });
    }

    // Verify the station belongs to this user
    const station = await Station.findByUserIdAndId(decoded.userId, stationId);
    if (!station) {
      return NextResponse.json({ error: 'Station not found' }, { status: 404 });
    }

    // Validate the API key with QRZ logbook API
    const validation = await validateQRZApiKey(qrz_api_key.trim());
    
    if (!validation.valid) {
      return NextResponse.json({ 
        valid: false,
        error: validation.error || 'QRZ API key validation failed'
      }, { status: 400 });
    }

    return NextResponse.json({ 
      valid: true,
      message: 'QRZ API key validated successfully (for logbook sync operations)'
    });

  } catch (error) {
    console.error('QRZ API key validation error:', error);
    return NextResponse.json({ 
      error: 'Failed to validate QRZ API key' 
    }, { status: 500 });
  }
}