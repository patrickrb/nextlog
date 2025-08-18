'use client';

import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Clock, Gauge, CheckCircle, AlertCircle, FileText, Loader2 } from 'lucide-react';

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

interface EnhancedProgressBarProps {
  progress: ProgressData;
  percentage?: number;
  isComplete?: boolean;
  hasError?: boolean;
}

export default function EnhancedProgressBar({ progress, percentage, isComplete, hasError }: EnhancedProgressBarProps) {
  const displayPercentage = Math.round(percentage ?? (progress.total > 0 ? (progress.processed / progress.total) * 100 : 0));
  
  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  };

  return (
    <div className="space-y-4">
      {/* Main Progress Bar */}
      <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            {isComplete ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : hasError ? (
              <AlertCircle className="h-4 w-4 text-destructive" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            )}
            <span className="text-sm font-medium">
              {isComplete ? 'Import Complete' : hasError ? 'Import Error' : 'Processing ADIF Import'}
            </span>
          </div>
          <span className="text-sm font-semibold">{displayPercentage}%</span>
        </div>
        
        <Progress 
          value={displayPercentage} 
          className="h-4 w-full border-2 border-border bg-gray-200 dark:bg-gray-800"
        />
        
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{progress.processed.toLocaleString()} of {progress.total.toLocaleString()} records</span>
          {progress.rate && !isComplete && !hasError && (
            <span>{progress.rate} records/sec</span>
          )}
        </div>
      </div>

      {/* Status Message */}
      {progress.message && (
        <div className="text-sm text-muted-foreground bg-muted p-2 rounded-md">
          {progress.message}
        </div>
      )}

      {/* Detailed Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="flex items-center space-x-2">
          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
            <CheckCircle className="h-3 w-3 mr-1" />
            {progress.imported.toLocaleString()}
          </Badge>
          <span className="text-xs text-muted-foreground">Imported</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
            <FileText className="h-3 w-3 mr-1" />
            {progress.skipped.toLocaleString()}
          </Badge>
          <span className="text-xs text-muted-foreground">Skipped</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
            <AlertCircle className="h-3 w-3 mr-1" />
            {progress.errors.toLocaleString()}
          </Badge>
          <span className="text-xs text-muted-foreground">Errors</span>
        </div>

        {progress.rate && !isComplete && !hasError && (
          <div className="flex items-center space-x-2">
            <Badge variant="outline">
              <Gauge className="h-3 w-3 mr-1" />
              {progress.rate}/s
            </Badge>
            <span className="text-xs text-muted-foreground">Rate</span>
          </div>
        )}
      </div>

      {/* Time Estimation */}
      {progress.estimatedTimeRemaining && progress.estimatedTimeRemaining > 0 && !isComplete && !hasError && (
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Estimated time remaining: {formatTime(progress.estimatedTimeRemaining)}</span>
        </div>
      )}
    </div>
  );
}