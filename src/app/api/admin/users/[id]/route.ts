// Admin individual user management API endpoints

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { Permission, UserRole, UserStatus, isHigherRole } from '@/lib/permissions';
import { query } from '@/lib/db';
import { logAdminAction, AUDIT_ACTIONS, sanitizeForAudit } from '@/lib/audit';
import bcrypt from 'bcryptjs';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/admin/users/[id] - Get specific user
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  return requirePermission(Permission.VIEW_USERS)(async (req, adminUser) => {
    try {
      const userId = parseInt(params.id);
      
      if (isNaN(userId)) {
        return NextResponse.json(
          { error: 'Invalid user ID' },
          { status: 400 }
        );
      }

      const result = await query(
        `SELECT id, email, name, callsign, grid_locator, role, status, last_login, created_at, updated_at
         FROM users WHERE id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(result.rows[0]);

    } catch (error) {
      console.error('Error fetching user:', error);
      return NextResponse.json(
        { error: 'Failed to fetch user' },
        { status: 500 }
      );
    }
  })(request, adminUser);
}

/**
 * PUT /api/admin/users/[id] - Update user
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  return requirePermission(Permission.EDIT_USERS)(async (req, adminUser) => {
    try {
      const userId = parseInt(params.id);
      
      if (isNaN(userId)) {
        return NextResponse.json(
          { error: 'Invalid user ID' },
          { status: 400 }
        );
      }

      const body = await request.json();
      const { email, name, callsign, grid_locator, role, status, password } = body;

      // Get current user data for audit log
      const currentUserResult = await query(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      );

      if (currentUserResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      const currentUser = currentUserResult.rows[0];

      // Prevent users from editing higher-role users (unless they're the same role)
      if (role && role !== currentUser.role) {
        if (!adminUser.role || !isHigherRole(adminUser.role as UserRole, role as UserRole)) {
          return NextResponse.json(
            { error: 'Cannot assign higher role than your own' },
            { status: 403 }
          );
        }
      }

      // Build update query dynamically
      const updates: string[] = [];
      const params: any[] = [];
      let paramCount = 0;

      if (email !== undefined) {
        // Check if email is already taken by another user
        const emailCheck = await query(
          'SELECT id FROM users WHERE email = $1 AND id != $2',
          [email, userId]
        );
        
        if (emailCheck.rows.length > 0) {
          return NextResponse.json(
            { error: 'Email already exists' },
            { status: 409 }
          );
        }
        
        updates.push(`email = $${++paramCount}`);
        params.push(email);
      }

      if (name !== undefined) {
        updates.push(`name = $${++paramCount}`);
        params.push(name);
      }

      if (callsign !== undefined) {
        updates.push(`callsign = $${++paramCount}`);
        params.push(callsign || null);
      }

      if (grid_locator !== undefined) {
        updates.push(`grid_locator = $${++paramCount}`);
        params.push(grid_locator || null);
      }

      if (role !== undefined) {
        if (!Object.values(UserRole).includes(role)) {
          return NextResponse.json(
            { error: 'Invalid role' },
            { status: 400 }
          );
        }
        updates.push(`role = $${++paramCount}`);
        params.push(role);
      }

      if (status !== undefined) {
        if (!Object.values(UserStatus).includes(status)) {
          return NextResponse.json(
            { error: 'Invalid status' },
            { status: 400 }
          );
        }
        updates.push(`status = $${++paramCount}`);
        params.push(status);
      }

      if (password !== undefined && password.trim() !== '') {
        const hashedPassword = await bcrypt.hash(password, 12);
        updates.push(`password = $${++paramCount}`);
        params.push(hashedPassword);
      }

      if (updates.length === 0) {
        return NextResponse.json(
          { error: 'No fields to update' },
          { status: 400 }
        );
      }

      // Add updated_at
      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      
      // Add user ID for WHERE clause
      params.push(userId);
      const whereParam = `$${++paramCount}`;

      const updateQuery = `
        UPDATE users 
        SET ${updates.join(', ')}
        WHERE id = ${whereParam}
        RETURNING id, email, name, callsign, grid_locator, role, status, last_login, created_at, updated_at
      `;

      const result = await query(updateQuery, params);
      const updatedUser = result.rows[0];

      // Log the action
      const auditAction = role !== currentUser.role ? AUDIT_ACTIONS.USER_ROLE_CHANGED :
                         status !== currentUser.status ? AUDIT_ACTIONS.USER_STATUS_CHANGED :
                         password ? AUDIT_ACTIONS.USER_PASSWORD_RESET :
                         AUDIT_ACTIONS.USER_UPDATED;

      await logAdminAction(adminUser.id, auditAction, {
        targetType: 'user',
        targetId: userId,
        oldValues: sanitizeForAudit(currentUser),
        newValues: sanitizeForAudit(updatedUser),
        request
      });

      return NextResponse.json(updatedUser);

    } catch (error) {
      console.error('Error updating user:', error);
      return NextResponse.json(
        { error: 'Failed to update user' },
        { status: 500 }
      );
    }
  })(request, adminUser);
}

/**
 * DELETE /api/admin/users/[id] - Delete user
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  return requirePermission(Permission.DELETE_USERS)(async (req, adminUser) => {
    try {
      const userId = parseInt(params.id);
      
      if (isNaN(userId)) {
        return NextResponse.json(
          { error: 'Invalid user ID' },
          { status: 400 }
        );
      }

      // Prevent self-deletion
      if (userId === adminUser.id) {
        return NextResponse.json(
          { error: 'Cannot delete your own account' },
          { status: 400 }
        );
      }

      // Get user data for audit log
      const userResult = await query(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      const userToDelete = userResult.rows[0];

      // Prevent deletion of higher-role users
      if (!isHigherRole(adminUser.role as UserRole, userToDelete.role as UserRole)) {
        return NextResponse.json(
          { error: 'Cannot delete user with equal or higher role' },
          { status: 403 }
        );
      }

      // Delete user (CASCADE will handle related records)
      await query('DELETE FROM users WHERE id = $1', [userId]);

      await logAdminAction(adminUser.id, AUDIT_ACTIONS.USER_DELETED, {
        targetType: 'user',
        targetId: userId,
        oldValues: sanitizeForAudit(userToDelete),
        request
      });

      return NextResponse.json({ message: 'User deleted successfully' });

    } catch (error) {
      console.error('Error deleting user:', error);
      return NextResponse.json(
        { error: 'Failed to delete user' },
        { status: 500 }
      );
    }
  })(request, adminUser);
}