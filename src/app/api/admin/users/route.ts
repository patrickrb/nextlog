// Admin user management API endpoints

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { Permission, UserRole, UserStatus } from '@/lib/permissions';
import { query } from '@/lib/db';
import { logAdminAction, AUDIT_ACTIONS, sanitizeForAudit } from '@/lib/audit';
import bcrypt from 'bcryptjs';

/**
 * GET /api/admin/users - List all users
 */
export const GET = requirePermission(Permission.VIEW_USERS)(
  async (request: NextRequest, adminUser) => {
    try {
      const { searchParams } = new URL(request.url);
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '50');
      const search = searchParams.get('search') || '';
      const role = searchParams.get('role') || '';
      const status = searchParams.get('status') || '';

      const offset = (page - 1) * limit;
      
      let whereClause = '';
      const params: any[] = [];
      let paramCount = 0;
      
      const conditions: string[] = [];
      
      if (search) {
        conditions.push(`(name ILIKE $${++paramCount} OR email ILIKE $${++paramCount} OR callsign ILIKE $${++paramCount})`);
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern);
      }
      
      if (role) {
        conditions.push(`role = $${++paramCount}`);
        params.push(role);
      }
      
      if (status) {
        conditions.push(`status = $${++paramCount}`);
        params.push(status);
      }
      
      if (conditions.length > 0) {
        whereClause = 'WHERE ' + conditions.join(' AND ');
      }
      
      // Add pagination params
      params.push(limit, offset);
      const limitClause = `LIMIT $${++paramCount} OFFSET $${++paramCount}`;

      const usersQuery = `
        SELECT 
          id, email, name, callsign, grid_locator, role, status, last_login, created_at, updated_at
        FROM users 
        ${whereClause}
        ORDER BY created_at DESC 
        ${limitClause}
      `;

      const countQuery = `
        SELECT COUNT(*) as total 
        FROM users 
        ${whereClause}
      `;

      const [usersResult, countResult] = await Promise.all([
        query(usersQuery, params),
        query(countQuery, params.slice(0, -2)) // Remove limit/offset for count
      ]);

      // Note: We don't log viewing the user list to avoid spam
      // Only log actual user management actions (create, update, delete)

      return NextResponse.json({
        users: usersResult.rows,
        total: parseInt(countResult.rows[0].total),
        page,
        limit,
        totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
      });

    } catch (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      );
    }
  }
);

/**
 * POST /api/admin/users - Create new user
 */
export const POST = requirePermission(Permission.CREATE_USERS)(
  async (request: NextRequest, adminUser) => {
    try {
      const body = await request.json();
      const { email, password, name, callsign, grid_locator, role, status } = body;

      // Validate required fields
      if (!email || !password || !name) {
        return NextResponse.json(
          { error: 'Email, password, and name are required' },
          { status: 400 }
        );
      }

      // Validate role
      if (role && !Object.values(UserRole).includes(role)) {
        return NextResponse.json(
          { error: 'Invalid role' },
          { status: 400 }
        );
      }

      // Validate status
      if (status && !Object.values(UserStatus).includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status' },
          { status: 400 }
        );
      }

      // Check if email already exists
      const existingUser = await query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 409 }
        );
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const result = await query(
        `INSERT INTO users (email, password, name, callsign, grid_locator, role, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, email, name, callsign, grid_locator, role, status, created_at`,
        [
          email,
          hashedPassword,
          name,
          callsign || null,
          grid_locator || null,
          role || UserRole.USER,
          status || UserStatus.ACTIVE
        ]
      );

      const newUser = result.rows[0];

      await logAdminAction(adminUser.id, AUDIT_ACTIONS.USER_CREATED, {
        targetType: 'user',
        targetId: newUser.id,
        newValues: sanitizeForAudit(newUser),
        request
      });

      return NextResponse.json(newUser, { status: 201 });

    } catch (error) {
      console.error('Error creating user:', error);
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }
  }
);