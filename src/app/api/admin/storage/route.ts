// Admin storage configuration API endpoints

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { Permission } from '@/lib/permissions';
import { query } from '@/lib/db';
import { logAdminAction, AUDIT_ACTIONS, sanitizeForAudit } from '@/lib/audit';
import { encrypt, decrypt } from '@/lib/crypto';

interface StorageConfig {
  id?: number;
  config_type: 'azure_blob' | 'aws_s3' | 'local_storage';
  account_name?: string;
  account_key?: string;
  container_name?: string;
  endpoint_url?: string;
  is_enabled: boolean;
}

/**
 * Validate Azure Blob Storage credentials
 */
async function validateAzureBlobCredentials(config: StorageConfig): Promise<boolean> {
  try {
    if (!config.account_name || !config.account_key || !config.container_name) {
      return false;
    }

    // For now, just check that required fields are present
    // In production, you might want to test actual connectivity
    return true;
  } catch (error) {
    console.error('Azure validation error:', error);
    return false;
  }
}

/**
 * Validate local storage configuration
 */
async function validateLocalStorageConfig(config: StorageConfig): Promise<boolean> {
  try {
    // For local storage, we only need a valid directory name
    if (!config.container_name) {
      return false;
    }

    // Validate the directory name doesn't contain dangerous characters
    const containerName = config.container_name;
    if (containerName.includes('..') || containerName.includes('/') || containerName.includes('\\')) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Local storage validation error:', error);
    return false;
  }
}

/**
 * GET /api/admin/storage - Get storage configurations
 */
export const GET = requirePermission(Permission.VIEW_STORAGE_CONFIG)(
  async () => {
    try {
      const result = await query(
        `SELECT 
          sc.id, sc.config_type, sc.account_name, sc.container_name, sc.endpoint_url, sc.is_enabled, 
          sc.created_at, sc.updated_at, sc.created_by,
          u.name as created_by_name
         FROM storage_config sc
         LEFT JOIN users u ON sc.created_by = u.id
         ORDER BY sc.config_type, sc.created_at DESC`
      );

      // Don't return encrypted account keys
      const configs = result.rows.map(config => ({
        ...config,
        account_key: config.account_key ? '[ENCRYPTED]' : null
      }));

      return NextResponse.json({ configs });

    } catch (error) {
      console.error('Error fetching storage configs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch storage configurations' },
        { status: 500 }
      );
    }
  }
);

/**
 * POST /api/admin/storage - Create storage configuration
 */
export const POST = requirePermission(Permission.EDIT_STORAGE_CONFIG)(
  async (request: NextRequest, adminUser) => {
    try {
      const body = await request.json();
      const { config_type, account_name, account_key, container_name, endpoint_url, is_enabled } = body;

      // Validate required fields
      if (!config_type) {
        return NextResponse.json(
          { error: 'Configuration type is required' },
          { status: 400 }
        );
      }

      const validTypes = ['azure_blob', 'aws_s3', 'local_storage'];
      if (!validTypes.includes(config_type)) {
        return NextResponse.json(
          { error: 'Invalid configuration type' },
          { status: 400 }
        );
      }

      // Check if config already exists for this type
      const existingConfig = await query(
        'SELECT id FROM storage_config WHERE config_type = $1',
        [config_type]
      );

      if (existingConfig.rows.length > 0) {
        return NextResponse.json(
          { error: 'Configuration already exists for this storage type' },
          { status: 409 }
        );
      }

      // Validate credentials if enabling
      if (is_enabled) {
        if (config_type === 'azure_blob') {
          const isValid = await validateAzureBlobCredentials({
            config_type,
            account_name,
            account_key,
            container_name,
            endpoint_url,
            is_enabled
          });

          if (!isValid) {
            return NextResponse.json(
              { error: 'Invalid Azure Blob Storage credentials' },
              { status: 400 }
            );
          }
        } else if (config_type === 'local_storage') {
          const isValid = await validateLocalStorageConfig({
            config_type,
            account_name,
            account_key,
            container_name,
            endpoint_url,
            is_enabled
          });

          if (!isValid) {
            return NextResponse.json(
              { error: 'Invalid local storage configuration. Directory name must be provided and cannot contain path separators.' },
              { status: 400 }
            );
          }
        }
      }

      // Encrypt sensitive data
      const encryptedAccountKey = account_key ? encrypt(account_key) : null;

      // Create configuration
      const result = await query(
        `INSERT INTO storage_config 
         (config_type, account_name, account_key, container_name, endpoint_url, is_enabled, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, config_type, account_name, container_name, endpoint_url, is_enabled, created_at`,
        [
          config_type,
          account_name || null,
          encryptedAccountKey,
          container_name || null,
          endpoint_url || null,
          is_enabled || false,
          adminUser.id
        ]
      );

      const newConfig = result.rows[0];

      await logAdminAction(adminUser.id, AUDIT_ACTIONS.STORAGE_CONFIG_CREATED, {
        targetType: 'storage_config',
        targetId: newConfig.id,
        newValues: sanitizeForAudit(newConfig),
        request
      });

      return NextResponse.json(newConfig, { status: 201 });

    } catch (error) {
      console.error('Error creating storage config:', error);
      return NextResponse.json(
        { error: 'Failed to create storage configuration' },
        { status: 500 }
      );
    }
  }
);

/**
 * PUT /api/admin/storage - Update storage configuration
 */
export const PUT = requirePermission(Permission.EDIT_STORAGE_CONFIG)(
  async (request: NextRequest, adminUser) => {
    try {
      const body = await request.json();
      const { id, config_type, account_name, account_key, container_name, endpoint_url, is_enabled } = body;

      if (!id) {
        return NextResponse.json(
          { error: 'Configuration ID is required' },
          { status: 400 }
        );
      }

      // Get current config for audit
      const currentResult = await query(
        'SELECT * FROM storage_config WHERE id = $1',
        [id]
      );

      if (currentResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Configuration not found' },
          { status: 404 }
        );
      }

      const currentConfig = currentResult.rows[0];

      // Validate credentials if enabling
      if (is_enabled && config_type === 'azure_blob') {
        const keyToValidate = account_key || 
          (currentConfig.account_key ? decrypt(currentConfig.account_key) : null);
        
        const isValid = await validateAzureBlobCredentials({
          config_type,
          account_name: account_name || currentConfig.account_name,
          account_key: keyToValidate,
          container_name: container_name || currentConfig.container_name,
          endpoint_url: endpoint_url || currentConfig.endpoint_url,
          is_enabled
        });

        if (!isValid) {
          return NextResponse.json(
            { error: 'Invalid Azure Blob Storage credentials' },
            { status: 400 }
          );
        }
      }

      // Build update query
      const updates: string[] = [];
      const params: unknown[] = [];
      let paramCount = 0;

      if (account_name !== undefined) {
        updates.push(`account_name = $${++paramCount}`);
        params.push(account_name || null);
      }

      if (account_key !== undefined && account_key.trim() !== '') {
        updates.push(`account_key = $${++paramCount}`);
        params.push(encrypt(account_key));
      }

      if (container_name !== undefined) {
        updates.push(`container_name = $${++paramCount}`);
        params.push(container_name || null);
      }

      if (endpoint_url !== undefined) {
        updates.push(`endpoint_url = $${++paramCount}`);
        params.push(endpoint_url || null);
      }

      if (is_enabled !== undefined) {
        updates.push(`is_enabled = $${++paramCount}`);
        params.push(is_enabled);
      }

      if (updates.length === 0) {
        return NextResponse.json(
          { error: 'No fields to update' },
          { status: 400 }
        );
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      
      params.push(id);
      const whereParam = `$${++paramCount}`;

      const updateQuery = `
        UPDATE storage_config 
        SET ${updates.join(', ')}
        WHERE id = ${whereParam}
        RETURNING id, config_type, account_name, container_name, endpoint_url, is_enabled, created_at, updated_at
      `;

      const result = await query(updateQuery, params);
      const updatedConfig = result.rows[0];

      const auditAction = is_enabled !== currentConfig.is_enabled ?
        (is_enabled ? AUDIT_ACTIONS.STORAGE_CONFIG_ENABLED : AUDIT_ACTIONS.STORAGE_CONFIG_DISABLED) :
        AUDIT_ACTIONS.STORAGE_CONFIG_UPDATED;

      await logAdminAction(adminUser.id, auditAction, {
        targetType: 'storage_config',
        targetId: id,
        oldValues: sanitizeForAudit(currentConfig),
        newValues: sanitizeForAudit(updatedConfig),
        request
      });

      return NextResponse.json(updatedConfig);

    } catch (error) {
      console.error('Error updating storage config:', error);
      return NextResponse.json(
        { error: 'Failed to update storage configuration' },
        { status: 500 }
      );
    }
  }
);

/**
 * DELETE /api/admin/storage - Delete storage configuration
 */
export const DELETE = requirePermission(Permission.EDIT_STORAGE_CONFIG)(
  async (request: NextRequest, adminUser) => {
    try {
      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');

      if (!id) {
        return NextResponse.json(
          { error: 'Configuration ID is required' },
          { status: 400 }
        );
      }

      // Get config for audit
      const configResult = await query(
        'SELECT * FROM storage_config WHERE id = $1',
        [id]
      );

      if (configResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Configuration not found' },
          { status: 404 }
        );
      }

      const configToDelete = configResult.rows[0];

      // Delete configuration
      await query('DELETE FROM storage_config WHERE id = $1', [id]);

      await logAdminAction(adminUser.id, AUDIT_ACTIONS.STORAGE_CONFIG_DELETED, {
        targetType: 'storage_config',
        targetId: parseInt(id),
        oldValues: sanitizeForAudit(configToDelete),
        request
      });

      return NextResponse.json({ message: 'Storage configuration deleted successfully' });

    } catch (error) {
      console.error('Error deleting storage config:', error);
      return NextResponse.json(
        { error: 'Failed to delete storage configuration' },
        { status: 500 }
      );
    }
  }
);