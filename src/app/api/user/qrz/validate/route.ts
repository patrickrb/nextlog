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
    
    // Get user's QRZ credentials
    const user = await User.findById(decoded.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.qrz_username || !user.qrz_password) {
      console.error('QRZ credentials missing:', {
        userId: decoded.userId,
        qrz_username: user.qrz_username ? 'present' : 'missing',
        qrz_password: user.qrz_password ? 'present' : 'missing'
      });
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

    // Validate credentials by doing a test lookup with QRZ XML API (for callsign lookups)
    const testResult = await lookupCallsign('W1AW', user.qrz_username, decryptedPassword);
    
    if (!testResult.found && testResult.error) {
      return NextResponse.json({ 
        valid: false,
        error: testResult.error
      }, { status: 400 });
    }

    return NextResponse.json({ 
      valid: true,
      message: 'QRZ XML API credentials validated successfully (for callsign lookups)'
    });

  } catch (error) {
    console.error('QRZ validation error:', error);
    return NextResponse.json({ 
      error: 'Failed to validate QRZ credentials' 
    }, { status: 500 });
  }
}