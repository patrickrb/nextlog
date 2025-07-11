import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { query } from './db';
import { UserRole, UserStatus, Permission, hasPermission, isActiveUser } from './permissions';

export interface AuthUser {
  userId: string;
  email: string;
  role?: UserRole;
  status?: UserStatus;
}

export interface FullUser extends AuthUser {
  id: number;
  name: string;
  callsign?: string;
  role: UserRole;
  status: UserStatus;
  last_login?: Date;
}

export async function verifyToken(request: NextRequest): Promise<AuthUser | null> {
  try {
    const token = request.cookies.get('token')?.value;
    
    if (!token) {
      return null;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as AuthUser;
    return decoded;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

/**
 * Get full user details including role and status from database
 */
export async function getFullUser(userId: string): Promise<FullUser | null> {
  try {
    const result = await query(
      'SELECT id, email, name, callsign, role, status, last_login FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const user = result.rows[0];
    return {
      userId: user.id.toString(),
      email: user.email,
      id: user.id,
      name: user.name,
      callsign: user.callsign,
      role: user.role as UserRole,
      status: user.status as UserStatus,
      last_login: user.last_login
    };
  } catch (error) {
    console.error('Error fetching user details:', error);
    return null;
  }
}

/**
 * Verify token and get full user details with role/status
 */
export async function verifyTokenWithRole(request: NextRequest): Promise<FullUser | null> {
  try {
    const authUser = await verifyToken(request);
    if (!authUser) {
      return null;
    }
    
    return await getFullUser(authUser.userId);
  } catch (error) {
    console.error('Token verification with role error:', error);
    return null;
  }
}

export function requireAuth(handler: (request: NextRequest, user: AuthUser) => Promise<Response>) {
  return async (request: NextRequest) => {
    const user = await verifyToken(request);
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return handler(request, user);
  };
}

/**
 * Require authentication with full user details (role/status)
 */
export function requireAuthWithRole(handler: (request: NextRequest, user: FullUser) => Promise<Response>) {
  return async (request: NextRequest) => {
    const user = await verifyTokenWithRole(request);
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user is active
    if (!isActiveUser(user.status)) {
      return new Response(JSON.stringify({ error: 'Account suspended or inactive' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return handler(request, user);
  };
}

/**
 * Require specific permission
 */
export function requirePermission(permission: Permission) {
  return function(handler: (request: NextRequest, user: FullUser) => Promise<Response>) {
    return requireAuthWithRole(async (request: NextRequest, user: FullUser) => {
      if (!hasPermission(user.role, permission)) {
        return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return handler(request, user);
    });
  };
}

/**
 * Require admin role
 */
export function requireAdmin(handler: (request: NextRequest, user: FullUser) => Promise<Response>) {
  return requirePermission(Permission.SYSTEM_ADMIN)(handler);
}

/**
 * Get client IP address from request
 */
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  return 'unknown';
}

/**
 * Get user agent from request
 */
export function getUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') || 'unknown';
}