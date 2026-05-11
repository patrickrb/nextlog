import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { getAdifImportSettings } from '@/lib/settings';
import { parseAdifRecords, insertAdifRecord, type AdifRecord } from '@/lib/adif';

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: number;
  message?: string;
  details?: string[];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current import settings
    const importSettings = await getAdifImportSettings();
    const maxFileSizeMB = importSettings.adif_max_file_size_mb as number;
    const maxFileSize = maxFileSizeMB * 1024 * 1024;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const stationId = formData.get('stationId') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!stationId) {
      return NextResponse.json({ error: 'Station ID is required' }, { status: 400 });
    }

    // Check file size using dynamic setting
    if (file.size > maxFileSize) {
      return NextResponse.json({
        error: `File too large. Please upload files smaller than ${maxFileSizeMB}MB. For larger files, consider splitting them into smaller chunks.`
      }, { status: 413 });
    }

    // Verify station belongs to user
    const stationQuery = 'SELECT id FROM stations WHERE id = $1 AND user_id = $2';
    const stationResult = await query(stationQuery, [parseInt(stationId), parseInt(user.userId)]);

    if (stationResult.rows.length === 0) {
      return NextResponse.json({ error: 'Station not found or access denied' }, { status: 404 });
    }

    // Read and parse ADIF file
    const fileContent = await file.text();

    // Quick validation before processing using dynamic settings
    const maxContentSize = maxFileSizeMB * 1.5 * 1024 * 1024; // Allow 1.5x file size for text expansion
    if (fileContent.length > maxContentSize) {
      return NextResponse.json({
        error: 'File content too large to process. Please use smaller files.'
      }, { status: 413 });
    }

    const result = await parseAndImportADIF(fileContent, parseInt(user.userId), parseInt(stationId), importSettings);

    return NextResponse.json(result);
  } catch (error) {
    console.error('ADIF import error:', error);

    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('deadline')) {
        return NextResponse.json({
          error: 'Import timeout. Please try with a smaller file or split your ADIF file into chunks.'
        }, { status: 408 });
      }
      if (error.message.includes('memory') || error.message.includes('heap')) {
        return NextResponse.json({
          error: 'File too large to process. Please split into smaller files.'
        }, { status: 413 });
      }
    }

    return NextResponse.json(
      { error: 'Internal server error during import. Please try with a smaller file.' },
      { status: 500 }
    );
  }
}

async function parseAndImportADIF(content: string, userId: number, stationId: number, settings: Record<string, unknown>): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    imported: 0,
    skipped: 0,
    errors: 0,
    details: []
  };

  const startTime = Date.now();
  const timeoutMs = (settings.adif_timeout_seconds as number) * 1000;
  const maxRecords = settings.adif_max_record_count as number;
  const batchSize = settings.adif_batch_size as number;

  try {
    const records = parseAdifRecords(content);

    if (records.length > maxRecords) {
      return {
        success: false,
        imported: 0,
        skipped: 0,
        errors: 1,
        message: `File contains ${records.length} records. For performance reasons, please limit imports to ${maxRecords} records or fewer. Consider using the ADIF splitter tool: node scripts/split-adif.js yourfile.adi 400`
      };
    }

    const estimatedTimeNeeded = Math.ceil(records.length / batchSize) * 0.2;
    if (estimatedTimeNeeded > (timeoutMs / 1000)) {
      console.warn(`Warning: File has ${records.length} records which may take ~${estimatedTimeNeeded}s but timeout is ${timeoutMs/1000}s. Consider splitting the file.`);
    }

    const totalBatches = Math.ceil(records.length / batchSize);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const elapsedTime = Date.now() - startTime;
      const remainingTime = timeoutMs - elapsedTime;

      if (remainingTime < 3000) {
        const recordsProcessed = batchIndex * batchSize;
        const recordsRemaining = records.length - recordsProcessed;
        result.message = `Import timed out after processing ${recordsProcessed}/${records.length} records (${result.imported} imported, ${result.skipped} skipped, ${result.errors} errors). ${recordsRemaining} records remaining. Please try importing in smaller chunks using: node scripts/split-adif.js yourfile.adi 400`;
        result.success = false;
        return result;
      }

      const startIdx = batchIndex * batchSize;
      const endIdx = Math.min(startIdx + batchSize, records.length);
      const batch = records.slice(startIdx, endIdx);

      try {
        await processBatch(batch, userId, stationId, result);
      } catch (batchError) {
        console.error(`Batch ${batchIndex + 1} failed:`, batchError);
        result.errors += batch.length;
        if (result.details && result.details.length < 10) {
          result.details.push(`Batch ${batchIndex + 1} failed: ${batchError instanceof Error ? batchError.message : 'Unknown error'}`);
        }
      }

      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 5));
      }
    }

    const totalProcessed = result.imported + result.skipped + result.errors;
    result.message = `Import completed successfully: ${result.imported} imported, ${result.skipped} skipped, ${result.errors} errors out of ${records.length} total records (${totalProcessed}/${records.length} processed)`;

    if (totalProcessed < records.length) {
      result.success = false;
      result.message += `. Warning: Only ${totalProcessed} of ${records.length} records were processed.`;
    }

    return result;
  } catch (error) {
    console.error('ADIF parsing error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';

    console.error('Error stack:', errorStack);

    return {
      success: false,
      imported: result.imported,
      skipped: result.skipped,
      errors: result.errors + 1,
      message: `Failed to parse ADIF file: ${errorMessage}. Processed ${result.imported + result.skipped + result.errors} records before failure.`,
      details: result.details || []
    };
  }
}

async function processBatch(records: AdifRecord[], userId: number, stationId: number, result: ImportResult): Promise<void> {
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    try {
      const outcome = await insertAdifRecord(record, userId, stationId);
      if (outcome.inserted) {
        result.imported++;
      } else if (outcome.skipped) {
        result.skipped++;
      } else {
        result.errors++;
        if (outcome.error && result.details && result.details.length < 10) {
          result.details.push(`Record ${i + 1}: ${outcome.error}`);
        }
      }
    } catch (error) {
      result.errors++;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Record ${i + 1} import error:`, errorMsg);
      if (result.details && result.details.length < 10) {
        result.details.push(`Error importing record ${i + 1}: ${errorMsg}`);
      }
    }
  }
}
