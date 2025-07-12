// Admin audit logging utilities for NodeLog

import { query } from './db';
import { NextRequest } from 'next/server';
import { getClientIP, getUserAgent } from './auth';

export interface AuditLogEntry {
  admin_user_id: number;
  action: string;
  target_type?: string;
  target_id?: number;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
}

/**
 * Log an admin action to the audit trail
 */
export async function logAdminAction(
  adminUserId: number,
  action: string,
  options: {
    targetType?: string;
    targetId?: number;
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
    request?: NextRequest;
  } = {}
): Promise<void> {
  try {
    const {
      targetType,
      targetId,
      oldValues,
      newValues,
      request
    } = options;

    const ipAddress = request ? getClientIP(request) : null;
    const userAgent = request ? getUserAgent(request) : null;

    await query(
      `INSERT INTO admin_audit_log 
       (admin_user_id, action, target_type, target_id, old_values, new_values, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        adminUserId,
        action,
        targetType || null,
        targetId || null,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress,
        userAgent
      ]
    );
  } catch (error) {
    console.error('Failed to log admin action:', error);
    // Don't throw - audit logging shouldn't break the main operation
  }
}

/**
 * Get audit logs with pagination and filtering
 */
export async function getAuditLogs(options: {
  page?: number;
  limit?: number;
  adminUserId?: number;
  action?: string;
  targetType?: string;
  startDate?: Date;
  endDate?: Date;
} = {}) {
  const {
    page = 1,
    limit = 50,
    adminUserId,
    action,
    targetType,
    startDate,
    endDate
  } = options;

  const offset = (page - 1) * limit;
  let whereClause = '';
  const params: unknown[] = [];
  let paramCount = 0;

  const conditions: string[] = [];

  if (adminUserId) {
    conditions.push(`al.admin_user_id = $${++paramCount}`);
    params.push(adminUserId);
  }

  if (action) {
    conditions.push(`al.action = $${++paramCount}`);
    params.push(action);
  }

  if (targetType) {
    conditions.push(`al.target_type = $${++paramCount}`);
    params.push(targetType);
  }

  if (startDate) {
    conditions.push(`al.created_at >= $${++paramCount}`);
    params.push(startDate);
  }

  if (endDate) {
    conditions.push(`al.created_at <= $${++paramCount}`);
    params.push(endDate);
  }

  if (conditions.length > 0) {
    whereClause = 'WHERE ' + conditions.join(' AND ');
  }

  // Add pagination params
  params.push(limit, offset);
  const limitClause = `LIMIT $${++paramCount} OFFSET $${++paramCount}`;

  const auditQuery = `
    SELECT 
      al.*,
      u.name as admin_name,
      u.email as admin_email,
      u.callsign as admin_callsign
    FROM admin_audit_log al
    JOIN users u ON al.admin_user_id = u.id
    ${whereClause}
    ORDER BY al.created_at DESC
    ${limitClause}
  `;

  const countQuery = `
    SELECT COUNT(*) as total
    FROM admin_audit_log al
    ${whereClause}
  `;

  const [auditResult, countResult] = await Promise.all([
    query(auditQuery, params),
    query(countQuery, params.slice(0, -2)) // Remove limit/offset params for count
  ]);

  return {
    logs: auditResult.rows,
    total: parseInt(countResult.rows[0].total),
    page,
    limit,
    totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
  };
}

/**
 * Common audit actions
 */
export const AUDIT_ACTIONS = {
  // User management
  USER_CREATED: 'user_created',
  USER_UPDATED: 'user_updated',
  USER_DELETED: 'user_deleted',
  USER_ROLE_CHANGED: 'user_role_changed',
  USER_STATUS_CHANGED: 'user_status_changed',
  USER_PASSWORD_RESET: 'user_password_reset',
  
  // Storage configuration
  STORAGE_CONFIG_CREATED: 'storage_config_created',
  STORAGE_CONFIG_UPDATED: 'storage_config_updated',
  STORAGE_CONFIG_DELETED: 'storage_config_deleted',
  STORAGE_CONFIG_ENABLED: 'storage_config_enabled',
  STORAGE_CONFIG_DISABLED: 'storage_config_disabled',
  
  // System
  ADMIN_LOGIN: 'admin_login',
  SYSTEM_CONFIG_UPDATED: 'system_config_updated',
  SYSTEM_BACKUP: 'system_backup',
  SYSTEM_RESTORE: 'system_restore'
} as const;

/**
 * Create a sanitized version of an object for logging (removes sensitive fields)
 */
export function sanitizeForAudit(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...obj };
  
  // Remove sensitive fields
  const sensitiveFields = ['password', 'account_key', 'qrz_password', 'token'];
  
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}