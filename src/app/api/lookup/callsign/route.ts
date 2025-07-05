import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { User } from '@/models/User';
import { lookupCallsign } from '@/lib/qrz';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
    const body = await request.json();
    const { callsign } = body;

    if (!callsign?.trim()) {
      return NextResponse.json({ error: 'Callsign is required' }, { status: 400 });
    }

    // Get user's QRZ credentials
    const user = await User.findById(decoded.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }


    if (!user.qrz_username || !user.qrz_password) {
      return NextResponse.json({ 
        error: 'QRZ credentials not configured. Please add your QRZ username and password in your profile settings.' 
      }, { status: 400 });
    }

    // Decrypt the password if it's encrypted
    const decryptedPassword = User.getDecryptedQrzPassword(user);
    if (!decryptedPassword) {
      return NextResponse.json({ 
        error: 'Failed to decrypt QRZ password. Please update your credentials in profile settings.' 
      }, { status: 400 });
    }


    // Perform the lookup
    const result = await lookupCallsign(callsign.trim(), user.qrz_username, decryptedPassword);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to lookup callsign' }, { status: 500 });
  }
}