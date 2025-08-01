import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST() {
  try {
    console.log('Starting schema migration...');
    
    // Check what columns exist and add missing ones
    const contactsColumns = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'contacts' AND table_schema = 'public'
    `);
    
    const apiKeysColumns = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'api_keys' AND table_schema = 'public'
    `);
    
    const stationsColumns = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'stations' AND table_schema = 'public'
    `);
    
    const usersColumns = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND table_schema = 'public'
    `);
    
    const contactsColumnNames = contactsColumns.rows.map(row => row.column_name);
    const apiKeysColumnNames = apiKeysColumns.rows.map(row => row.column_name);
    const stationsColumnNames = stationsColumns.rows.map(row => row.column_name);
    const usersColumnNames = usersColumns.rows.map(row => row.column_name);
    
    const migrations = [];
    
    // Contacts table migrations
    const contactsNeededColumns = [
      'name', 'band', 'rst_sent', 'rst_received', 'qth', 'grid_locator', 
      'latitude', 'longitude', 'country', 'dxcc', 'cont', 'cqz', 'ituz', 
      'state', 'cnty', 'qsl_rcvd', 'qsl_sent', 'qsl_via', 'eqsl_qsl_rcvd', 
      'eqsl_qsl_sent', 'lotw_qsl_rcvd', 'lotw_qsl_sent', 'qso_date_off', 
      'time_off', 'operator', 'distance', 'notes', 'qsl_lotw', 'qsl_lotw_date', 
      'lotw_match_status'
    ];
    
    for (const column of contactsNeededColumns) {
      if (!contactsColumnNames.includes(column)) {
        let columnDef = '';
        switch (column) {
          case 'name': columnDef = 'VARCHAR(255)'; break;
          case 'band': columnDef = 'VARCHAR(20)'; break;
          case 'rst_sent': case 'rst_received': columnDef = 'VARCHAR(10)'; break;
          case 'qth': columnDef = 'VARCHAR(255)'; break;
          case 'grid_locator': columnDef = 'VARCHAR(10)'; break;
          case 'latitude': columnDef = 'DECIMAL(10, 8)'; break;
          case 'longitude': columnDef = 'DECIMAL(11, 8)'; break;
          case 'country': columnDef = 'VARCHAR(100)'; break;
          case 'dxcc': case 'cqz': case 'ituz': columnDef = 'INTEGER'; break;
          case 'cont': columnDef = 'VARCHAR(10)'; break;
          case 'state': columnDef = 'VARCHAR(50)'; break;
          case 'cnty': columnDef = 'VARCHAR(100)'; break;
          case 'qsl_rcvd': case 'qsl_sent': case 'eqsl_qsl_rcvd': case 'eqsl_qsl_sent': 
          case 'lotw_qsl_rcvd': case 'lotw_qsl_sent': columnDef = 'VARCHAR(10)'; break;
          case 'qsl_via': columnDef = 'VARCHAR(255)'; break;
          case 'qso_date_off': case 'qsl_lotw_date': columnDef = 'DATE'; break;
          case 'time_off': columnDef = 'TIME'; break;
          case 'operator': columnDef = 'VARCHAR(50)'; break;
          case 'distance': columnDef = 'DECIMAL(10, 2)'; break;
          case 'notes': columnDef = 'TEXT'; break;
          case 'qsl_lotw': columnDef = 'BOOLEAN DEFAULT FALSE'; break;
          case 'lotw_match_status': columnDef = "VARCHAR(20) CHECK (lotw_match_status IN ('confirmed', 'partial', 'mismatch', null))"; break;
          default: columnDef = 'VARCHAR(255)'; break;
        }
        
        const migration = `ALTER TABLE contacts ADD COLUMN ${column} ${columnDef}`;
        migrations.push(migration);
      }
    }
    
    // API keys table migrations
    if (!apiKeysColumnNames.includes('key_name')) {
      migrations.push('ALTER TABLE api_keys ADD COLUMN key_name VARCHAR(255)');
    }
    if (!apiKeysColumnNames.includes('usage_count')) {
      migrations.push('ALTER TABLE api_keys ADD COLUMN usage_count INTEGER DEFAULT 0');
    }
    if (!apiKeysColumnNames.includes('description')) {
      migrations.push('ALTER TABLE api_keys ADD COLUMN description TEXT');
    }
    
    // Stations table migrations
    const stationsNeededColumns = [
      'operator_name', 'qth_name', 'street_address', 'city', 'county', 
      'state_province', 'postal_code', 'country', 'dxcc_entity_code',
      'grid_locator', 'latitude', 'longitude', 'itu_zone', 'cq_zone',
      'power_watts', 'rig_info', 'antenna_info', 'station_equipment',
      'qrz_username', 'qrz_password', 'qrz_api_key', 'lotw_username',
      'club_callsign', 'lotw_password', 'lotw_p12_cert', 'lotw_cert_created_at'
    ];
    
    for (const column of stationsNeededColumns) {
      if (!stationsColumnNames.includes(column)) {
        let columnDef = '';
        switch (column) {
          case 'operator_name': case 'qth_name': case 'qrz_username': 
          case 'qrz_password': case 'qrz_api_key': case 'lotw_username': 
          case 'lotw_password': 
            columnDef = 'VARCHAR(255)'; break;
          case 'club_callsign': columnDef = 'VARCHAR(50)'; break;
          case 'lotw_p12_cert': columnDef = 'BYTEA'; break;
          case 'lotw_cert_created_at': columnDef = 'TIMESTAMP'; break;
          case 'street_address': columnDef = 'VARCHAR(255)'; break;
          case 'city': case 'county': case 'state_province': case 'country': 
            columnDef = 'VARCHAR(100)'; break;
          case 'postal_code': columnDef = 'VARCHAR(20)'; break;
          case 'grid_locator': columnDef = 'VARCHAR(10)'; break;
          case 'latitude': columnDef = 'DECIMAL(10, 8)'; break;
          case 'longitude': columnDef = 'DECIMAL(11, 8)'; break;
          case 'dxcc_entity_code': case 'itu_zone': case 'cq_zone': case 'power_watts': 
            columnDef = 'INTEGER'; break;
          case 'rig_info': case 'antenna_info': case 'station_equipment': 
            columnDef = 'TEXT'; break;
          default: columnDef = 'VARCHAR(255)'; break;
        }
        
        const migration = `ALTER TABLE stations ADD COLUMN ${column} ${columnDef}`;
        migrations.push(migration);
      }
    }
    
    // Users table migrations
    if (!usersColumnNames.includes('last_login')) {
      migrations.push('ALTER TABLE users ADD COLUMN last_login TIMESTAMP');
    }
    if (!usersColumnNames.includes('qrz_username')) {
      migrations.push('ALTER TABLE users ADD COLUMN qrz_username VARCHAR(255)');
    }
    if (!usersColumnNames.includes('qrz_password')) {
      migrations.push('ALTER TABLE users ADD COLUMN qrz_password VARCHAR(255)');
    }
    
    console.log(`Running ${migrations.length} migrations...`);
    
    // Execute migrations
    for (const migration of migrations) {
      try {
        console.log('Executing:', migration);
        await db.query(migration);
      } catch (error) {
        console.warn('Migration failed (may already exist):', migration, error);
        // Continue with other migrations even if one fails
      }
    }
    
    // For existing api_keys without key_name, set a default value
    if (migrations.some(m => m.includes('key_name'))) {
      try {
        await db.query(`
          UPDATE api_keys 
          SET key_name = 'Default Key ' || id::text 
          WHERE key_name IS NULL
        `);
        
        // Make key_name NOT NULL after setting defaults
        await db.query('ALTER TABLE api_keys ALTER COLUMN key_name SET NOT NULL');
      } catch (error) {
        console.warn('Failed to update api_keys key_name:', error);
      }
    }
    
    console.log('Schema migration completed successfully');
    
    return NextResponse.json({ 
      success: true,
      message: 'Schema migration completed',
      migrationsExecuted: migrations.length
    });
    
  } catch (error) {
    console.error('Schema migration error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to migrate schema',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}