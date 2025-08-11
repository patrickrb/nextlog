'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle, XCircle, Clock, AlertCircle, Upload, Loader2 } from 'lucide-react';

interface QRZSyncIndicatorProps {
  contact: {
    id: number;
    qrz_sync_status?: 'not_synced' | 'synced' | 'error' | 'already_exists';
    qrz_sync_date?: string;
    qrz_logbook_id?: number;
    qrz_sync_error?: string;
  };
  onSync?: (contactId: number) => void;
  syncing?: boolean;
  compact?: boolean;
}

export default function QRZSyncIndicator({ contact, onSync, syncing = false, compact = false }: QRZSyncIndicatorProps) {
  const getStatusConfig = () => {
    switch (contact.qrz_sync_status) {
      case 'synced':
        return {
          color: 'bg-green-100 text-green-800 border-green-200',
          icon: CheckCircle,
          text: 'Synced',
          description: `Synced to QRZ on ${contact.qrz_sync_date ? new Date(contact.qrz_sync_date).toLocaleDateString() : 'unknown date'}${contact.qrz_logbook_id ? ` (ID: ${contact.qrz_logbook_id})` : ''}`
        };
      case 'already_exists':
        return {
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: CheckCircle,
          text: 'Exists',
          description: 'QSO already exists in QRZ logbook'
        };
      case 'error':
        return {
          color: 'bg-red-100 text-red-800 border-red-200',
          icon: XCircle,
          text: 'Error',
          description: contact.qrz_sync_error || 'Sync failed'
        };
      case 'not_synced':
      default:
        return {
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          icon: Clock,
          text: 'Not synced',
          description: 'QSO not synced to QRZ logbook'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center space-x-1">
              {syncing ? (
                <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
              ) : (
                <Icon className="h-3 w-3" style={{ color: config.color.includes('green') ? '#22c55e' : config.color.includes('red') ? '#ef4444' : config.color.includes('blue') ? '#3b82f6' : '#6b7280' }} />
              )}
              {!compact && (
                <span className="text-xs text-muted-foreground">
                  {syncing ? 'Syncing...' : config.text}
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">
              <div className="font-medium">QRZ Sync Status</div>
              <div className="text-muted-foreground">{config.description}</div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <Badge variant="secondary" className={`${config.color} flex items-center space-x-1`}>
        {syncing ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Icon className="h-3 w-3" />
        )}
        <span className="text-xs">{syncing ? 'Syncing...' : config.text}</span>
      </Badge>
      
      {onSync && contact.qrz_sync_status !== 'synced' && contact.qrz_sync_status !== 'already_exists' && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSync(contact.id)}
                disabled={syncing}
                className="h-6 w-6 p-0"
              >
                {syncing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Upload className="h-3 w-3" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <span>Sync to QRZ</span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      
      {contact.qrz_sync_status === 'error' && contact.qrz_sync_error && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </TooltipTrigger>
            <TooltipContent>
              <div className="max-w-sm">
                <div className="font-medium">Sync Error</div>
                <div className="text-sm text-muted-foreground">{contact.qrz_sync_error}</div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}