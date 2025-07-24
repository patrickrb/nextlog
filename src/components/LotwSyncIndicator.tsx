'use client';

import { Upload, Download, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
// Using title attribute for tooltips since tooltip component is not available

interface LotwSyncIndicatorProps {
  // Upload status
  lotwQslSent?: string; // 'Y', 'N', 'R' (Yes, No, Requested)
  
  // Download/confirmation status  
  lotwQslRcvd?: string; // 'Y', 'N' (Yes, No)
  qslLotw?: boolean; // Confirmed via LoTW
  qslLotwDate?: Date | string; // Date of confirmation
  lotwMatchStatus?: 'confirmed' | 'partial' | 'mismatch' | null;
  
  // Display options
  size?: 'sm' | 'md';
  showLabels?: boolean;
  orientation?: 'horizontal' | 'vertical';
}

export default function LotwSyncIndicator({ 
  lotwQslSent, 
  lotwQslRcvd, 
  qslLotw, 
  qslLotwDate,
  lotwMatchStatus,
  size = 'sm',
  showLabels = false,
  orientation = 'horizontal'
}: LotwSyncIndicatorProps) {
  
  // Determine upload status
  const getUploadStatus = () => {
    if (lotwQslSent === 'Y') {
      return { status: 'uploaded', color: 'text-green-600', icon: Upload, tooltip: 'Uploaded to LoTW' };
    } else if (lotwQslSent === 'R') {
      return { status: 'requested', color: 'text-orange-500', icon: Clock, tooltip: 'Upload requested' };
    } else {
      return { status: 'not-uploaded', color: 'text-red-500', icon: Upload, tooltip: 'Not uploaded to LoTW' };
    }
  };

  // Determine download/confirmation status
  const getDownloadStatus = () => {
    if (qslLotw === true || lotwQslRcvd === 'Y') {
      const statusText = lotwMatchStatus === 'partial' ? 'Partial match' : 
                        lotwMatchStatus === 'mismatch' ? 'Mismatch found' : 
                        'Confirmed via LoTW';
      
      const dateText = qslLotwDate ? 
        ` on ${new Date(qslLotwDate).toLocaleDateString()}` : '';
      
      const color = lotwMatchStatus === 'mismatch' ? 'text-orange-500' :
                   lotwMatchStatus === 'partial' ? 'text-yellow-600' :
                   'text-green-600';
      
      const icon = lotwMatchStatus === 'mismatch' ? AlertCircle : CheckCircle;
      
      return { 
        status: 'confirmed', 
        color, 
        icon,
        tooltip: statusText + dateText 
      };
    } else {
      return { 
        status: 'not-confirmed', 
        color: 'text-red-500', 
        icon: Download, 
        tooltip: 'No LoTW confirmation' 
      };
    }
  };

  const uploadStatus = getUploadStatus();
  const downloadStatus = getDownloadStatus();

  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  const containerClasses = orientation === 'vertical' ? 'flex flex-col space-y-1' : 'flex items-center space-x-2';

  if (showLabels) {
    return (
      <div className={`${containerClasses} text-xs`}>
        <div className="flex items-center space-x-1" title={uploadStatus.tooltip}>
          <uploadStatus.icon 
            className={`${iconSize} ${uploadStatus.color}`}
          />
          {showLabels && <span className="text-muted-foreground">Up</span>}
        </div>
        
        <div className="flex items-center space-x-1" title={downloadStatus.tooltip}>
          <downloadStatus.icon 
            className={`${iconSize} ${downloadStatus.color}`}
          />
          {showLabels && <span className="text-muted-foreground">Down</span>}
        </div>
      </div>
    );
  }

  // Compact view - just icons
  return (
    <div className={containerClasses}>
      <div title={uploadStatus.tooltip}>
        <uploadStatus.icon 
          className={`${iconSize} ${uploadStatus.color}`}
        />
      </div>
      <div title={downloadStatus.tooltip}>
        <downloadStatus.icon 
          className={`${iconSize} ${downloadStatus.color}`}
        />
      </div>
    </div>
  );
}

// Helper component for status badges
export function LotwStatusBadge({ 
  lotwQslSent, 
  lotwQslRcvd, 
  qslLotw, 
  lotwMatchStatus 
}: Pick<LotwSyncIndicatorProps, 'lotwQslSent' | 'lotwQslRcvd' | 'qslLotw' | 'lotwMatchStatus'>) {
  
  // Determine overall status
  const isUploaded = lotwQslSent === 'Y';
  const isConfirmed = qslLotw === true || lotwQslRcvd === 'Y';
  
  if (isUploaded && isConfirmed) {
    const variant = lotwMatchStatus === 'mismatch' ? 'destructive' : 
                   lotwMatchStatus === 'partial' ? 'secondary' : 'default';
    const text = lotwMatchStatus === 'mismatch' ? 'LoTW Mismatch' :
                lotwMatchStatus === 'partial' ? 'LoTW Partial' : 'LoTW Confirmed';
    
    return <Badge variant={variant} className="text-xs">{text}</Badge>;
  } else if (isUploaded) {
    return <Badge variant="secondary" className="text-xs">LoTW Uploaded</Badge>;
  } else if (isConfirmed) {
    return <Badge variant="outline" className="text-xs">LoTW Confirmed</Badge>;
  } else {
    return <Badge variant="outline" className="text-xs text-muted-foreground">No LoTW</Badge>;
  }
}