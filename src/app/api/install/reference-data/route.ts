import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import db from '@/lib/db';

function cleanSqlScript(sqlContent: string): string[] {
  return sqlContent
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 0 && 
             !trimmed.startsWith('--') && 
             !trimmed.startsWith('\\echo') &&
             !trimmed.startsWith('\\') &&
             trimmed !== 'BEGIN;' &&
             trimmed !== 'COMMIT;';
    })
    .join('\n')
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);
}

export async function POST() {
  try {
    const projectRoot = process.cwd();
    
    // Check if required tables exist
    try {
      await db.query('SELECT 1 FROM dxcc_entities LIMIT 1');
      await db.query('SELECT 1 FROM states_provinces LIMIT 1');
    } catch (error) {
      if (error instanceof Error && error.message.includes('does not exist')) {
        throw new Error('Database tables do not exist. Please run the database installation step first.');
      }
      throw error;
    }
    
    const dxccPath = path.join(projectRoot, 'scripts', 'dxcc_entities.sql');
    const dxccSql = await readFile(dxccPath, 'utf8');
    const dxccStatements = cleanSqlScript(dxccSql);
    
    const statesPath = path.join(projectRoot, 'scripts', 'states_provinces_import.sql');
    const statesSql = await readFile(statesPath, 'utf8');
    const statesStatements = cleanSqlScript(statesSql);
    try {
      await db.query('ALTER TABLE states_provinces DROP CONSTRAINT IF EXISTS states_provinces_dxcc_entity_code_key');
    } catch (error) {
      if (!(error instanceof Error && error.message.includes('does not exist'))) {
        throw error;
      }
    }
    
    for (const statement of dxccStatements) {
      try {
        await db.query(statement);
      } catch (error) {
        if (error instanceof Error && 
            (error.message.includes('duplicate key') || 
             error.message.includes('already exists'))) {
          continue;
        }
        throw error;
      }
    }
    
    for (const statement of statesStatements) {
      try {
        await db.query(statement);
      } catch (error) {
        if (error instanceof Error && 
            (error.message.includes('duplicate key') || 
             error.message.includes('already exists'))) {
          continue;
        }
        throw error;
      }
    }
    try {
      await db.query(`
        DELETE FROM states_provinces sp1 
        USING states_provinces sp2 
        WHERE sp1.id > sp2.id 
        AND sp1.dxcc_entity = sp2.dxcc_entity 
        AND sp1.code = sp2.code
      `);
      
      await db.query('ALTER TABLE states_provinces ADD CONSTRAINT states_provinces_dxcc_entity_code_key UNIQUE (dxcc_entity, code)');
    } catch (error) {
      if (!(error instanceof Error && 
          (error.message.includes('does not exist') || 
           error.message.includes('already exists')))) {
        throw error;
      }
    }
    
    const dxccResult = await db.query('SELECT COUNT(*) as count FROM dxcc_entities');
    const statesResult = await db.query('SELECT COUNT(*) as count FROM states_provinces');
    
    const dxccCount = parseInt(dxccResult.rows[0].count);
    const statesCount = parseInt(statesResult.rows[0].count);
    
    return NextResponse.json({ 
      success: true,
      message: `Reference data loaded successfully`,
      dxccCount,
      statesCount
    });
    
  } catch (error) {
    console.error('Reference data loading error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to load reference data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}