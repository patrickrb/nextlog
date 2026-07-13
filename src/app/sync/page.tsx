'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, RefreshCw, Upload, Download } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { useUser } from '@/contexts/UserContext';

interface SyncLogEntry {
  log_key: string;
  service: 'qrz' | 'lotw' | 'eqsl';
  direction: 'upload' | 'download';
  trigger: 'manual' | 'auto' | 'cron';
  status: string;
  started_at: string;
  completed_at?: string | null;
  qso_count?: number | null;
  success_count?: number | null;
  matched_count?: number | null;
  error_message?: string | null;
  station_id?: number | null;
  station_callsign?: string | null;
  details?: Record<string, unknown> | null;
}

export default function SyncActivityPage() {
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const { user, loading: userLoading } = useUser();
  const router = useRouter();

  const loadLogs = useCallback(async () => {
    try {
      const response = await fetch('/api/sync/logs?limit=100');
      if (!response.ok) {
        throw new Error('Failed to load sync activity');
      }
      const data = await response.json();
      setLogs(data.logs || []);
      setError('');
    } catch (err) {
      console.error('Failed to load sync activity:', err);
      setError('Failed to load sync activity');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    loadLogs();
  }, [user, userLoading, router, loadLogs]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadLogs();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      completed: 'default',
      processing: 'secondary',
      failed: 'destructive',
      pending: 'secondary'
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  const getServiceBadge = (service: string) => {
    return (
      <Badge variant="outline" className="uppercase">
        {service}
      </Badge>
    );
  };

  const resultSummary = (log: SyncLogEntry) => {
    if (log.error_message) {
      return <span className="text-bad text-sm">{log.error_message}</span>;
    }
    const parts: string[] = [];
    if (log.direction === 'upload' && log.success_count != null) {
      parts.push(`${log.success_count} uploaded`);
    }
    if (log.direction === 'download' && log.matched_count != null) {
      parts.push(`${log.matched_count} confirmed`);
    }
    return parts.length > 0 ? <span className="text-ok text-sm">{parts.join(', ')}</span> : '-';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar title="Sync Activity" actions={
          <Button variant="ghost" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
        } />
        <main className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-fg-2" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar title="Sync Activity" actions={
        <Button variant="ghost" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>
      } />
      <main className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Sync Activity</CardTitle>
                <CardDescription>
                  QRZ and LoTW upload/download runs across all your stations — including failures
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                {refreshing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-fg-2">No sync activity yet. Runs appear here once QSOs sync to QRZ or LoTW.</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Service</TableHead>
                        <TableHead>Direction</TableHead>
                        <TableHead>Station</TableHead>
                        <TableHead>Trigger</TableHead>
                        <TableHead>QSOs</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Result</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.log_key}>
                          <TableCell>{getServiceBadge(log.service)}</TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1 text-sm">
                              {log.direction === 'upload' ? (
                                <Upload className="h-3 w-3" />
                              ) : (
                                <Download className="h-3 w-3" />
                              )}
                              {log.direction}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium">{log.station_callsign || '-'}</TableCell>
                          <TableCell className="text-fg-2 text-sm">{log.trigger}</TableCell>
                          <TableCell>{log.qso_count ?? '-'}</TableCell>
                          <TableCell>{getStatusBadge(log.status)}</TableCell>
                          <TableCell className="text-sm">{formatDate(log.started_at)}</TableCell>
                          <TableCell>{resultSummary(log)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
