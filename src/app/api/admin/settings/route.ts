// Admin system settings API endpoints

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { Permission } from '@/lib/permissions';
import { getAllSettings, updateSetting } from '@/lib/settings';
import { logAdminAction, AUDIT_ACTIONS } from '@/lib/audit';

/**
 * GET /api/admin/settings - Get all system settings
 */
export const GET = requirePermission(Permission.MANAGE_SYSTEM)(
  async () => {
    try {
      const settings = await getAllSettings();
      
      return NextResponse.json({
        settings,
        total: settings.length
      });

    } catch (error) {
      console.error('Error fetching settings:', error);
      return NextResponse.json(
        { error: 'Failed to fetch settings' },
        { status: 500 }
      );
    }
  }
);

/**
 * PUT /api/admin/settings - Update multiple system settings
 */
export const PUT = requirePermission(Permission.MANAGE_SYSTEM)(
  async (request: NextRequest, adminUser) => {
    try {
      const body = await request.json();
      const { settings } = body;

      if (!settings || typeof settings !== 'object') {
        return NextResponse.json(
          { error: 'Settings object is required' },
          { status: 400 }
        );
      }

      const updatedSettings: string[] = [];
      const failedSettings: string[] = [];

      // Update each setting
      for (const [key, value] of Object.entries(settings)) {
        try {
          const success = await updateSetting(key, value as string | number | boolean, adminUser.id);
          if (success) {
            updatedSettings.push(key);
          } else {
            failedSettings.push(key);
          }
        } catch (error) {
          console.error(`Failed to update setting ${key}:`, error);
          failedSettings.push(key);
        }
      }

      // Log the admin action
      await logAdminAction(adminUser.id, AUDIT_ACTIONS.SYSTEM_CONFIG_UPDATED, {
        targetType: 'system_settings',
        newValues: {
          updated_settings: updatedSettings,
          failed_settings: failedSettings,
          total_updated: updatedSettings.length
        },
        request
      });

      if (failedSettings.length > 0) {
        return NextResponse.json({
          success: true,
          updated: updatedSettings,
          failed: failedSettings,
          message: `Updated ${updatedSettings.length} settings, ${failedSettings.length} failed`
        }, { status: 207 }); // Multi-status
      }

      return NextResponse.json({
        success: true,
        updated: updatedSettings,
        message: `Successfully updated ${updatedSettings.length} settings`
      });

    } catch (error) {
      console.error('Error updating settings:', error);
      return NextResponse.json(
        { error: 'Failed to update settings' },
        { status: 500 }
      );
    }
  }
);