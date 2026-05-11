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

    // Accept credentials in the request body to allow smoke-testing before save.
    // Fall back to the user's saved credentials when the body is empty.
    let bodyUsername: string | undefined;
    let bodyPassword: string | undefined;
    try {
      const body = await request.json() as { qrz_username?: unknown; qrz_password?: unknown };
      if (typeof body.qrz_username === 'string') bodyUsername = body.qrz_username.trim();
      if (typeof body.qrz_password === 'string') bodyPassword = body.qrz_password;
    } catch {
      // No JSON body — fall through to saved-credential path.
    }

    let username: string;
    let password: string;

    if (bodyUsername && bodyPassword) {
      username = bodyUsername;
      password = bodyPassword;
    } else {
      const user = await User.findById(decoded.userId);
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      if (!user.qrz_username || !user.qrz_password) {
        return NextResponse.json({
          error: 'QRZ credentials not configured. Please enter your QRZ username and password.'
        }, { status: 400 });
      }

      const decryptedPassword = User.getDecryptedQrzPassword(user);
      if (!decryptedPassword) {
        return NextResponse.json({
          error: 'Failed to decrypt QRZ password. Please re-enter your credentials.'
        }, { status: 400 });
      }

      username = user.qrz_username;
      password = decryptedPassword;
    }

    // Validate credentials by doing a test lookup with QRZ XML API (for callsign lookups)
    const testResult = await lookupCallsign('W1AW', username, password);
    
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