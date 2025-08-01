import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST() {
  try {
    const client = await pool.connect();
    
    try {
      // Verify installation completeness
      const tablesResult = await client.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      
      // Get list of actual tables for debugging
      const tableListResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);
      
      const usersResult = await client.query('SELECT COUNT(*) as count FROM users WHERE role = $1', ['admin']);
      const dxccResult = await client.query('SELECT COUNT(*) as count FROM dxcc_entities');
      const statesResult = await client.query('SELECT COUNT(*) as count FROM states_provinces');
      
      const tableCount = parseInt(tablesResult.rows[0].count);
      const adminCount = parseInt(usersResult.rows[0].count);
      const dxccCount = parseInt(dxccResult.rows[0].count);
      const statesCount = parseInt(statesResult.rows[0].count);
      
      const tableNames = tableListResult.rows.map(row => row.table_name);
      
      console.log('Installation verification:');
      console.log(`Tables found (${tableCount}):`, tableNames);
      console.log(`Admin users: ${adminCount}`);
      console.log(`DXCC entities: ${dxccCount}`);
      console.log(`States/provinces: ${statesCount}`);
      
      // Expected tables
      const expectedTables = [
        'users', 'stations', 'contacts', 'dxcc_entities', 'states_provinces',
        'storage_config', 'api_keys', 'admin_audit_log', 'qsl_images',
        'lotw_credentials', 'lotw_upload_logs', 'lotw_download_logs', 'lotw_job_queue'
      ];
      
      const missingTables = expectedTables.filter(table => !tableNames.includes(table));
      
      if (missingTables.length > 0) {
        console.log('Missing tables:', missingTables);
        // Don't fail the installation for missing tables, just log them
        console.warn(`Some optional tables are missing: ${missingTables.join(', ')}`);
      }
      
      // Only require core tables for basic functionality
      const coreTables = ['users', 'stations', 'contacts', 'dxcc_entities', 'states_provinces'];
      const missingCoreTables = coreTables.filter(table => !tableNames.includes(table));
      
      if (missingCoreTables.length > 0) {
        throw new Error(`Core tables missing: ${missingCoreTables.join(', ')}. Found tables: ${tableNames.join(', ')}`);
      }
      
      if (adminCount < 1) {
        throw new Error('No administrator account found');
      }
      
      if (dxccCount < 300) {
        throw new Error(`Insufficient DXCC entities loaded. Expected ~402, found ${dxccCount}`);
      }
      
      if (statesCount < 1000) {
        throw new Error(`Insufficient states/provinces loaded. Expected ~1849, found ${statesCount}`);
      }
      
      // Mark installation as complete by creating a system settings record (if table exists)
      if (tableNames.includes('storage_config')) {
        await client.query(`
          INSERT INTO storage_config (config_type, is_enabled, created_at)
          VALUES ('local_storage', true, NOW())
          ON CONFLICT (config_type) DO NOTHING
        `);
      } else {
        console.log('storage_config table not found, skipping installation marker');
      }
      
      return NextResponse.json({ 
        success: true,
        message: 'Installation finalized successfully',
        stats: {
          tables: tableCount,
          adminUsers: adminCount,
          dxccEntities: dxccCount,
          statesProvinces: statesCount
        }
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Installation finalization error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to finalize installation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}