import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { User } from '@/models/User';

export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
    const body = await request.json();

    const { name, callsign, grid_locator, qrz_username, qrz_password } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Update user profile
    const updatedUser = await User.update(decoded.userId, {
      name: name.trim(),
      callsign: callsign?.trim() || null,
      grid_locator: grid_locator?.trim() || null,
      qrz_username: qrz_username?.trim() || null,
      qrz_password: qrz_password?.trim() || null
    });

    if (!updatedUser) {
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    // Return user info without password
    const { password, ...userInfo } = updatedUser;
    return NextResponse.json({ user: userInfo });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}