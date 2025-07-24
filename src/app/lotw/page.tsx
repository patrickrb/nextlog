'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Upload, Download, Settings, ArrowLeft, RefreshCw, FileText } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { useUser } from '@/contexts/UserContext';

interface Station {
  id: number;
  callsign: string;
  station_name: string;
  is_default: boolean;
}

interface UploadLog {
  id: number;
  station_callsign: string;
  qso_count: number;
  status: string;
  started_at: string;
  completed_at?: string;
  success_count: number;
  error_count: number;
  error_message?: string;
}

interface DownloadLog {
  id: number;
  station_callsign: string;
  confirmations_found: number;
  confirmations_matched: number;
  confirmations_unmatched: number;
  status: string;
  started_at: string;
  completed_at?: string;
  error_message?: string;
}

export default function LotwPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [uploadLogs, setUploadLogs] = useState<UploadLog[]>([]);
  const [downloadLogs, setDownloadLogs] = useState<DownloadLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Form states
  const [selectedStation, setSelectedStation] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certCallsign, setCertCallsign] = useState('');

  const { user } = useUser();
  const router = useRouter();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load stations
      const stationsResponse = await fetch('/api/stations');
      if (stationsResponse.ok) {
        const stationsData = await stationsResponse.json();
        setStations(stationsData.stations || []);
        
        // Set default station if none selected
        if (!selectedStation && stationsData.stations?.length > 0) {
          const defaultStation = stationsData.stations.find((s: Station) => s.is_default) || stationsData.stations[0];
          setSelectedStation(defaultStation.id.toString());
        }
      }

      // Load upload logs
      const uploadResponse = await fetch('/api/lotw/upload');
      if (uploadResponse.ok) {
        const uploadData = await uploadResponse.json();
        setUploadLogs(uploadData.upload_logs || []);
      }

      // Load download logs
      const downloadResponse = await fetch('/api/lotw/download');
      if (downloadResponse.ok) {
        const downloadData = await downloadResponse.json();
        setDownloadLogs(downloadData.download_logs || []);
      }

    } catch (error) {
      console.error('Failed to load data:', error);
      setMessage({ type: 'error', text: 'Failed to load LoTW data' });
    } finally {
      setLoading(false);
    }
  }, [selectedStation]);

  useEffect(() => {
    if (!user && !loading) {
      router.push('/login');
      return;
    }
    loadData();
  }, [user, router, loading, loadData]);

  const handleUpload = async () => {
    if (!selectedStation) {
      setMessage({ type: 'error', text: 'Please select a station' });
      return;
    }

    try {
      setUploading(true);
      setMessage(null);

      const response = await fetch('/api/lotw/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          station_id: parseInt(selectedStation),
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          upload_method: 'manual'
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ 
          type: 'success', 
          text: `Upload ${data.success ? 'completed' : 'failed'}: ${data.qso_count || 0} QSOs processed${data.error_message ? ` - ${data.error_message}` : ''}` 
        });
        await loadData(); // Reload logs
      } else {
        setMessage({ type: 'error', text: data.error || 'Upload failed' });
      }

    } catch (error) {
      console.error('Upload error:', error);
      setMessage({ type: 'error', text: 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async () => {
    if (!selectedStation) {
      setMessage({ type: 'error', text: 'Please select a station' });
      return;
    }

    try {
      setDownloading(true);
      setMessage(null);

      const response = await fetch('/api/lotw/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          station_id: parseInt(selectedStation),
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          download_method: 'manual'
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ 
          type: 'success', 
          text: `Download ${data.success ? 'completed' : 'failed'}: ${data.confirmations_found || 0} confirmations found, ${data.confirmations_matched || 0} matched${data.error_message ? ` - ${data.error_message}` : ''}` 
        });
        await loadData(); // Reload logs
      } else {
        setMessage({ type: 'error', text: data.error || 'Download failed' });
      }

    } catch (error) {
      console.error('Download error:', error);
      setMessage({ type: 'error', text: 'Download failed' });
    } finally {
      setDownloading(false);
    }
  };

  const handleCertificateUpload = async () => {
    if (!certFile || !selectedStation || !certCallsign) {
      setMessage({ type: 'error', text: 'Please select a station, enter callsign, and choose a certificate file' });
      return;
    }

    try {
      setUploadingCert(true);
      setMessage(null);

      const formData = new FormData();
      formData.append('p12_file', certFile);
      formData.append('station_id', selectedStation);
      formData.append('callsign', certCallsign);

      const response = await fetch('/api/lotw/certificate', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Certificate uploaded successfully' });
        setCertFile(null);
        setCertCallsign('');
        // Reset file input
        const fileInput = document.getElementById('cert-file') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        setMessage({ type: 'error', text: data.error || 'Certificate upload failed' });
      }

    } catch (error) {
      console.error('Certificate upload error:', error);
      setMessage({ type: 'error', text: 'Certificate upload failed' });
    } finally {
      setUploadingCert(false);
    }
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar title="LoTW Integration" actions={
          <Button variant="ghost" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
        } />
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin mr-2" />
              <span className="text-lg">Loading LoTW integration...</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar 
        title="LoTW Integration" 
        actions={
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
          </div>
        }
      />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 space-y-6">
          
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">LoTW Sync</h1>
              <p className="text-muted-foreground mt-2">
                Upload QSOs to and download confirmations from ARRL Logbook of The World
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/settings">
                <Settings className="h-4 w-4 mr-2" />
                LoTW Settings
              </Link>
            </Button>
          </div>

          {/* Error/Success Messages */}
          {message && (
            <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          {/* Manual Sync Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Manual Sync</CardTitle>
              <CardDescription>
                Upload QSOs to LoTW or download confirmations manually
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Station and Date Selection */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="station">Station</Label>
                  <Select value={selectedStation} onValueChange={setSelectedStation}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select station" />
                    </SelectTrigger>
                    <SelectContent>
                      {stations.map((station) => (
                        <SelectItem key={station.id} value={station.id.toString()}>
                          {station.callsign} - {station.station_name}
                          {station.is_default && ' (Default)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date-from">From Date (Optional)</Label>
                  <Input
                    id="date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date-to">To Date (Optional)</Label>
                  <Input
                    id="date-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>

              {/* Upload/Download Buttons */}
              <div className="flex flex-wrap gap-4">
                <Button
                  onClick={handleUpload}
                  disabled={uploading || !selectedStation}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Upload to LoTW
                </Button>

                <Button
                  variant="outline"
                  onClick={handleDownload}
                  disabled={downloading || !selectedStation}
                >
                  {downloading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Download Confirmations
                </Button>
              </div>

              {/* Certificate Upload */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium mb-4">Upload Certificate</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload a .p12 certificate file to enable LoTW uploads for the selected station.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cert-callsign">Callsign</Label>
                    <Input
                      id="cert-callsign"
                      type="text"
                      value={certCallsign}
                      onChange={(e) => setCertCallsign(e.target.value.toUpperCase())}
                      placeholder="Enter callsign"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cert-file">Certificate File</Label>
                    <Input
                      id="cert-file"
                      type="file"
                      accept=".p12,.pfx"
                      onChange={(e) => setCertFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={handleCertificateUpload}
                      disabled={uploadingCert || !certFile || !selectedStation || !certCallsign}
                    >
                      {uploadingCert ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4 mr-2" />
                      )}
                      Upload Certificate
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sync History */}
          <Card>
            <CardHeader>
              <CardTitle>Sync History</CardTitle>
              <CardDescription>
                Recent upload and download activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="uploads" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="uploads">Uploads ({uploadLogs.length})</TabsTrigger>
                  <TabsTrigger value="downloads">Downloads ({downloadLogs.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="uploads" className="mt-6">
                  {uploadLogs.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No upload history found.</p>
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Station</TableHead>
                            <TableHead>QSOs</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Started</TableHead>
                            <TableHead>Success/Error</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {uploadLogs.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell className="font-medium">{log.station_callsign}</TableCell>
                              <TableCell>{log.qso_count}</TableCell>
                              <TableCell>{getStatusBadge(log.status)}</TableCell>
                              <TableCell>{formatDate(log.started_at)}</TableCell>
                              <TableCell>
                                {log.status === 'completed' ? (
                                  <span className="text-green-600">{log.success_count} success</span>
                                ) : log.error_message ? (
                                  <span className="text-red-600 text-sm">{log.error_message}</span>
                                ) : (
                                  '-'
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="downloads" className="mt-6">
                  {downloadLogs.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No download history found.</p>
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Station</TableHead>
                            <TableHead>Found</TableHead>
                            <TableHead>Matched</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Started</TableHead>
                            <TableHead>Notes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {downloadLogs.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell className="font-medium">{log.station_callsign}</TableCell>
                              <TableCell>{log.confirmations_found}</TableCell>
                              <TableCell>{log.confirmations_matched}</TableCell>
                              <TableCell>{getStatusBadge(log.status)}</TableCell>
                              <TableCell>{formatDate(log.started_at)}</TableCell>
                              <TableCell>
                                {log.error_message ? (
                                  <span className="text-red-600 text-sm">{log.error_message}</span>
                                ) : log.confirmations_unmatched > 0 ? (
                                  <span className="text-yellow-600 text-sm">{log.confirmations_unmatched} unmatched</span>
                                ) : (
                                  '-'
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}