'use client';

import React, { useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import EnhancedProgressBar from '@/components/EnhancedProgressBar';

interface ADIFRecord {
  fields: { [key: string]: string };
}

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: number;
  message?: string;
  details?: string[];
}

interface ProgressData {
  processed: number;
  total: number;
  imported: number;
  skipped: number;
  errors: number;
  rate?: number;
  estimatedTimeRemaining?: number;
  message?: string;
}

interface ChunkResult extends ImportResult {
  chunkIndex: number;
  totalChunks: number;
}

export default function AutoImportADIF({ stationId }: { stationId: number }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [results, setResults] = useState<ChunkResult[]>([]);
  const [finalSummary, setFinalSummary] = useState<string>('');
  const [error, setError] = useState<string>('');

  const parseADIFRecords = (content: string): ADIFRecord[] => {
    // Remove header if present (everything before <eoh>)
    const eohIndex = content.toLowerCase().indexOf('<eoh>');
    const dataContent = eohIndex >= 0 ? content.substring(eohIndex + 5) : content;

    // Split by <eor> (end of record)
    const recordStrings = dataContent.split(/<eor>/i).filter(r => r.trim());
    const records: ADIFRecord[] = [];

    for (const recordString of recordStrings) {
      const record = parseADIFRecord(recordString.trim());
      if (record && Object.keys(record.fields).length > 0) {
        records.push(record);
      }
    }

    return records;
  };

  const parseADIFRecord = (recordString: string): ADIFRecord | null => {
    const fields: { [key: string]: string } = {};
    
    // Regular expression to match ADIF fields: <fieldname:length>value
    const fieldRegex = /<([^:>]+):(\d+)>([^<]*)/gi;
    let match;
    
    while ((match = fieldRegex.exec(recordString)) !== null) {
      const fieldName = match[1].toLowerCase();
      const length = parseInt(match[2]);
      let value = match[3];
      
      // Ensure we only take the specified length
      if (value.length > length) {
        value = value.substring(0, length);
      }
      
      fields[fieldName] = value.trim();
    }
    
    return { fields };
  };

  const createADIFContent = (records: ADIFRecord[], header: string = ''): string => {
    const recordStrings = records.map(record => {
      const fieldStrings = Object.entries(record.fields).map(([key, value]) => {
        return `<${key.toUpperCase()}:${value.length}>${value}`;
      });
      return fieldStrings.join('') + '<EOR>';
    });

    return header + recordStrings.join('\n') + '\n';
  };

  const importChunk = async (chunkContent: string, chunkIndex: number, totalChunks: number): Promise<ImportResult> => {
    const formData = new FormData();
    const blob = new Blob([chunkContent], { type: 'text/plain' });
    const fileName = `chunk_${chunkIndex + 1}_of_${totalChunks}.adi`;
    
    formData.append('file', blob, fileName);
    formData.append('stationId', stationId.toString());

    const response = await fetch('/api/adif/import', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setProgress(0);
    setResults([]);
    setFinalSummary('');
    setError('');

    try {
      // Read file content
      const content = await file.text();
      
      // Extract header
      const eohIndex = content.toLowerCase().indexOf('<eoh>');
      const header = eohIndex >= 0 ? content.substring(0, eohIndex + 5) + '\n' : '';
      
      // Parse all records
      const allRecords = parseADIFRecords(content);
      console.log(`Parsed ${allRecords.length} total records`);

      // Determine chunk size (200 records per chunk for reliable Vercel processing)
      const chunkSize = 200;
      const chunks = Math.ceil(allRecords.length / chunkSize);

      console.log(`Splitting into ${chunks} chunks of ${chunkSize} records each`);

      // Set initial progress data immediately to ensure progress bar shows
      const startTime = Date.now();
      setProgressData({
        processed: 0,
        total: allRecords.length,
        imported: 0,
        skipped: 0,
        errors: 0,
        message: 'Starting ADIF auto-import...'
      });

      // Process each chunk
      const allResults: ChunkResult[] = [];
      let totalImported = 0;
      let totalSkipped = 0;
      let totalErrors = 0;

      for (let i = 0; i < chunks; i++) {
        setProgress(Math.round(((i) / chunks) * 100));

        const startIdx = i * chunkSize;
        const endIdx = Math.min(startIdx + chunkSize, allRecords.length);
        const chunkRecords = allRecords.slice(startIdx, endIdx);

        console.log(`Processing chunk ${i + 1}/${chunks} (${chunkRecords.length} records)`);

        // Update progress data for current chunk
        const currentProgress = Math.round(((i) / chunks) * 100);
        const processed = startIdx;
        const rate = i > 0 ? Math.round(processed / ((Date.now() - startTime) / 1000)) : 0;
        const remaining = allRecords.length - processed;
        const estimatedTime = rate > 0 ? Math.round(remaining / rate) : 0;

        setProgressData({
          processed,
          total: allRecords.length,
          imported: totalImported,
          skipped: totalSkipped,
          errors: totalErrors,
          rate: rate > 0 ? rate : undefined,
          estimatedTimeRemaining: estimatedTime > 0 ? estimatedTime : undefined,
          message: `Processing chunk ${i + 1} of ${chunks}... (${currentProgress}%)`
        });

        try {
          // Create ADIF content for this chunk
          const chunkContent = createADIFContent(chunkRecords, header);
          
          // Import this chunk
          const result = await importChunk(chunkContent, i, chunks);
          
          const chunkResult: ChunkResult = {
            ...result,
            chunkIndex: i,
            totalChunks: chunks
          };

          allResults.push(chunkResult);
          setResults([...allResults]);

          totalImported += result.imported;
          totalSkipped += result.skipped;
          totalErrors += result.errors;

          console.log(`Chunk ${i + 1} completed: ${result.imported} imported, ${result.skipped} skipped, ${result.errors} errors`);

          // Delay between chunks to avoid overwhelming the server and allow connections to reset
          if (i < chunks - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
          }

        } catch (chunkError) {
          console.error(`Chunk ${i + 1} failed:`, chunkError);
          
          // Check if this was a timeout or partial success
          const errorMessage = chunkError instanceof Error ? chunkError.message : 'Unknown error';
          const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('timed out');
          
          const errorResult: ChunkResult = {
            success: false,
            imported: 0,
            skipped: 0,
            errors: chunkRecords.length,
            message: `Chunk ${i + 1} ${isTimeout ? 'timed out' : 'failed'}: ${errorMessage}`,
            chunkIndex: i,
            totalChunks: chunks
          };
          allResults.push(errorResult);
          setResults([...allResults]);
          totalErrors += chunkRecords.length;
          
          // For timeouts, add extra delay before continuing
          if (isTimeout && i < chunks - 1) {
            console.log('Adding extra delay after timeout...');
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }
      }

      setProgress(100);
      
      // Update with final results
      setProgressData({
        processed: allRecords.length,
        total: allRecords.length,
        imported: totalImported,
        skipped: totalSkipped,
        errors: totalErrors,
        message: `Auto-import completed: ${totalImported} imported, ${totalSkipped} skipped, ${totalErrors} errors across ${chunks} chunks`
      });
      
      setFinalSummary(
        `Import completed! ${totalImported} imported, ${totalSkipped} skipped, ${totalErrors} errors across ${chunks} chunks.`
      );

      // Ensure minimum display time for progress bar (at least 1 second)
      const minDisplayTime = new Promise(resolve => setTimeout(resolve, 1000));
      await minDisplayTime;

    } catch (err) {
      console.error('Auto-import failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsProcessing(false);
    }

    // Reset file input
    event.target.value = '';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Upload className="mr-2 h-5 w-5" />
          Automatic ADIF Import
        </CardTitle>
        <CardDescription>
          Upload large ADIF files and they will be automatically split into 200-record chunks and imported sequentially for reliable processing on Vercel.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center w-full">
          <label htmlFor="auto-adif-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted hover:bg-muted/80 border-border">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <FileText className="w-8 h-8 mb-4 text-muted-foreground" />
              <p className="mb-2 text-sm text-muted-foreground">
                <span className="font-semibold">Click to upload</span> your ADIF file
              </p>
              <p className="text-xs text-muted-foreground">
                Any size ADIF file (.adi, .adif)
              </p>
            </div>
            <input
              id="auto-adif-upload"
              type="file"
              accept=".adi,.adif"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isProcessing}
            />
          </label>
        </div>

        {isProcessing && (
          <div className="space-y-4">
            {progressData ? (
              <EnhancedProgressBar 
                progress={progressData}
                percentage={progress}
                isComplete={finalSummary !== ''}
                hasError={!!error}
              />
            ) : (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Starting auto-import...</span>
                </div>
                <Progress value={0} className="w-full" />
              </div>
            )}
          </div>
        )}

        {error && (
          <Alert className="border-destructive/20 bg-destructive/10">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-destructive">{error}</AlertDescription>
          </Alert>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold">Chunk Results:</h4>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {[...results].reverse().map((result) => (
                <div key={result.chunkIndex} className="flex items-center justify-between text-sm p-2 bg-muted rounded">
                  <div className="flex items-center">
                    {result.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                    )}
                    <span>Chunk {result.chunkIndex + 1}</span>
                  </div>
                  <div className="text-xs space-x-2">
                    <span className="text-green-600">{result.imported} imported</span>
                    <span className="text-yellow-600">{result.skipped} skipped</span>
                    <span className="text-red-600">{result.errors} errors</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {finalSummary && (
          <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              {finalSummary}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}