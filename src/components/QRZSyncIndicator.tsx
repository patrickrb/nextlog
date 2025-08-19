'use client';

import { Upload, Download, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface QRZSyncIndicatorProps {
  // Upload status
  qrzQslSent?: string; // 'Y', 'N', 'R' (Yes, No, Request failed)
  qrzQslSentDate?: Date | string; // Date when sent to QRZ
  
  // Download/confirmation status  
  qrzQslRcvd?: string; // 'Y', 'N' (Yes, No)
  qrzQslRcvdDate?: Date | string; // Date when confirmed by QRZ
  
  // Display options
  size?: 'sm' | 'md';
  showLabels?: boolean;
  orientation?: 'horizontal' | 'vertical';
}

export default function QRZSyncIndicator({ 
  qrzQslSent, 
  qrzQslSentDate,
  qrzQslRcvd, 
  qrzQslRcvdDate,
  size = 'sm',
  showLabels = false,
  orientation = 'horizontal'
}: QRZSyncIndicatorProps) {
  
  // Determine upload status
  const getUploadStatus = () => {
    if (qrzQslSent === 'Y') {
      const dateText = qrzQslSentDate ? 
        ` on ${new Date(qrzQslSentDate).toLocaleDateString()}` : '';
      return { 
        status: 'uploaded', 
        color: 'text-green-600', 
        icon: Upload, 
        tooltip: `Uploaded to QRZ${dateText}` 
      };
    } else if (qrzQslSent === 'R') {
      return { 
        status: 'error', 
        color: 'text-red-500', 
        icon: AlertCircle, 
        tooltip: 'QRZ upload failed' 
      };
    } else {
      return { 
        status: 'not-uploaded', 
        color: 'text-red-500', 
        icon: Upload, 
        tooltip: 'Not uploaded to QRZ' 
      };
    }
  };

  // Determine download/confirmation status
  const getDownloadStatus = () => {
    if (qrzQslRcvd === 'Y') {
      const dateText = qrzQslRcvdDate ? 
        ` on ${new Date(qrzQslRcvdDate).toLocaleDateString()}` : '';
      
      return { 
        status: 'confirmed', 
        color: 'text-green-600', 
        icon: Download,
        tooltip: `Confirmed via QRZ${dateText}` 
      };
    } else {
      return { 
        status: 'not-confirmed', 
        color: 'text-red-500', 
        icon: Download, 
        tooltip: 'No QRZ confirmation' 
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
export function QRZStatusBadge({ 
  qrzQslSent, 
  qrzQslRcvd 
}: Pick<QRZSyncIndicatorProps, 'qrzQslSent' | 'qrzQslRcvd'>) {
  
  // Determine overall status
  const isUploaded = qrzQslSent === 'Y';
  const isConfirmed = qrzQslRcvd === 'Y';
  const isError = qrzQslSent === 'R';
  
  if (isError) {
    return <Badge variant="destructive" className="text-xs">QRZ Error</Badge>;
  } else if (isUploaded && isConfirmed) {
    return <Badge variant="default" className="text-xs">QRZ Confirmed</Badge>;
  } else if (isUploaded) {
    return <Badge variant="secondary" className="text-xs">QRZ Uploaded</Badge>;
  } else if (isConfirmed) {
    return <Badge variant="outline" className="text-xs">QRZ Confirmed</Badge>;
  } else {
    return <Badge variant="outline" className="text-xs text-muted-foreground">No QRZ</Badge>;
  }
}