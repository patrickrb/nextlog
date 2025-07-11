// Admin audit log API endpoint

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { Permission } from '@/lib/permissions';
import { getAuditLogs } from '@/lib/audit';

/**
 * GET /api/admin/audit - Get audit logs
 */
export const GET = requirePermission(Permission.VIEW_AUDIT_LOGS)(
  async (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      
      const page = parseInt(searchParams.get('page') || '1');
      const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100); // Max 100 per page
      const adminUserId = searchParams.get('admin_user_id') ? 
        parseInt(searchParams.get('admin_user_id')!) : undefined;
      const action = searchParams.get('action') || undefined;
      const targetType = searchParams.get('target_type') || undefined;
      
      const startDate = searchParams.get('start_date') ? 
        new Date(searchParams.get('start_date')!) : undefined;
      const endDate = searchParams.get('end_date') ? 
        new Date(searchParams.get('end_date')!) : undefined;

      const result = await getAuditLogs({
        page,
        limit,
        adminUserId,
        action,
        targetType,
        startDate,
        endDate
      });

      return NextResponse.json(result);

    } catch (error) {
      console.error('Error fetching audit logs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch audit logs' },
        { status: 500 }
      );
    }
  }
);