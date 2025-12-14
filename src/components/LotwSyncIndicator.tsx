'use client';

import { Upload, Download, CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
// Using title attribute for tooltips since tooltip component is not available

interface LotwSyncIndicatorProps {
  // Upload status
  lotwQslSent?: string; // 'Y', 'N', 'R' (Yes, No, Requested)

  // Download/confirmation status
  lotwQslRcvd?: string; // 'Y', 'N' (Yes, No)
  qslLotw?: boolean; // Confirmed via LoTW
  qslLotwDate?: Date | string; // Date of confirmation
  lotwMatchStatus?: 'confirmed' | 'partial' | 'mismatch' | null;

  // Contact info for upload/download
  contactId?: number;
  stationId?: number;

  // Callback to refresh contact data after upload/download
  onStatusChange?: () => void;

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
  contactId,
  stationId,
  onStatusChange,
  size = 'sm',
  showLabels = false,
  orientation = 'horizontal'
}: LotwSyncIndicatorProps) {
  const [uploadLoading, setUploadLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);

  const handleUploadClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent parent click handlers

    if (!contactId || !stationId || uploadLoading || lotwQslSent === 'Y') {
      return;
    }

    setUploadLoading(true);
    try {
      const response = await fetch('/api/lotw/upload-contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contact_id: contactId }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Success - refresh the contact data
        if (onStatusChange) {
          onStatusChange();
        }
      } else {
        // Show error message
        console.error('Upload failed:', data.error);
        alert(`Upload failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed: Network error');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDownloadClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent parent click handlers

    if (!contactId || !stationId || downloadLoading || qslLotw === true || lotwQslRcvd === 'Y') {
      return;
    }

    setDownloadLoading(true);
    try {
      const response = await fetch('/api/lotw/download-contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contact_id: contactId }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Success - refresh the contact data
        if (onStatusChange) {
          onStatusChange();
        }
      } else {
        // Show error message (but not as intrusive for "not found")
        console.error('Download failed:', data.error);
        if (!data.error?.includes('No matching confirmation')) {
          alert(`Download failed: ${data.error || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Download failed: Network error');
    } finally {
      setDownloadLoading(false);
    }
  };
  
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

  // Determine if icons are clickable
  const canUpload = contactId && stationId && lotwQslSent !== 'Y' && !uploadLoading;
  const canDownload = contactId && stationId && qslLotw !== true && lotwQslRcvd !== 'Y' && !downloadLoading;

  if (showLabels) {
    return (
      <div className={`${containerClasses} text-xs`}>
        <div
          className={`flex items-center space-x-1 ${canUpload ? 'cursor-pointer hover:opacity-70' : ''}`}
          title={uploadStatus.tooltip}
          onClick={canUpload ? handleUploadClick : undefined}
        >
          {uploadLoading ? (
            <Loader2 className={`${iconSize} animate-spin text-blue-500`} />
          ) : (
            <uploadStatus.icon
              className={`${iconSize} ${uploadStatus.color}`}
            />
          )}
          {showLabels && <span className="text-muted-foreground">Up</span>}
        </div>

        <div
          className={`flex items-center space-x-1 ${canDownload ? 'cursor-pointer hover:opacity-70' : ''}`}
          title={downloadStatus.tooltip}
          onClick={canDownload ? handleDownloadClick : undefined}
        >
          {downloadLoading ? (
            <Loader2 className={`${iconSize} animate-spin text-blue-500`} />
          ) : (
            <downloadStatus.icon
              className={`${iconSize} ${downloadStatus.color}`}
            />
          )}
          {showLabels && <span className="text-muted-foreground">Down</span>}
        </div>
      </div>
    );
  }

  // Compact view - just icons
  return (
    <div className={containerClasses}>
      <div
        title={uploadStatus.tooltip}
        className={canUpload ? 'cursor-pointer hover:opacity-70' : ''}
        onClick={canUpload ? handleUploadClick : undefined}
      >
        {uploadLoading ? (
          <Loader2 className={`${iconSize} animate-spin text-blue-500`} />
        ) : (
          <uploadStatus.icon
            className={`${iconSize} ${uploadStatus.color}`}
          />
        )}
      </div>
      <div
        title={downloadStatus.tooltip}
        className={canDownload ? 'cursor-pointer hover:opacity-70' : ''}
        onClick={canDownload ? handleDownloadClick : undefined}
      >
        {downloadLoading ? (
          <Loader2 className={`${iconSize} animate-spin text-blue-500`} />
        ) : (
          <downloadStatus.icon
            className={`${iconSize} ${downloadStatus.color}`}
          />
        )}
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