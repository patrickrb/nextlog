'use client';

import React, { useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';

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

interface ChunkResult extends ImportResult {
  chunkIndex: number;
  totalChunks: number;
}

export default function AutoImportADIF({ stationId }: { stationId: number }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
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
    setCurrentChunk(0);
    setTotalChunks(0);
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
      setTotalChunks(chunks);

      console.log(`Splitting into ${chunks} chunks of ${chunkSize} records each`);

      // Process each chunk
      const allResults: ChunkResult[] = [];
      let totalImported = 0;
      let totalSkipped = 0;
      let totalErrors = 0;

      for (let i = 0; i < chunks; i++) {
        setCurrentChunk(i + 1);
        setProgress(((i) / chunks) * 100);

        const startIdx = i * chunkSize;
        const endIdx = Math.min(startIdx + chunkSize, allRecords.length);
        const chunkRecords = allRecords.slice(startIdx, endIdx);

        console.log(`Processing chunk ${i + 1}/${chunks} (${chunkRecords.length} records)`);

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
      setFinalSummary(
        `Import completed! ${totalImported} imported, ${totalSkipped} skipped, ${totalErrors} errors across ${chunks} chunks.`
      );

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
          <label htmlFor="auto-adif-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-bray-800 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-600">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <FileText className="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400" />
              <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="font-semibold">Click to upload</span> your ADIF file
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
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
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processing chunk {currentChunk} of {totalChunks}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
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
              {results.map((result, index) => (
                <div key={index} className="flex items-center justify-between text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
                  <div className="flex items-center">
                    {result.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                    )}
                    <span>Chunk {result.chunkIndex + 1}</span>
                  </div>
                  <div className="text-xs">
                    {result.imported}i, {result.skipped}s, {result.errors}e
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