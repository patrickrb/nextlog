'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Upload, Download, FileText, CheckCircle, AlertCircle, Loader2, Calendar } from 'lucide-react';
import Navbar from '@/components/Navbar';
import AutoImportADIF from '@/components/AutoImportADIF';

interface Station {
  id: number;
  callsign: string;
  station_name: string;
  is_active: boolean;
  is_default: boolean;
}

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: number;
  message?: string;
  details?: string[];
}

export default function ADIFPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<string>('');
  const [exportStationId, setExportStationId] = useState<string>('');
  const [stationsLoaded, setStationsLoaded] = useState(false);
  
  // Import states
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importError, setImportError] = useState('');
  
  // Export states
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  
  const router = useRouter();

  useEffect(() => {
    fetchStations();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select default station when stations are loaded
  useEffect(() => {
    if (stations.length > 0 && !selectedStationId) {
      const defaultStation = stations.find((s: Station) => s.is_default);
      
      let defaultId = '';
      if (defaultStation) {
        defaultId = defaultStation.id.toString();
      } else if (stations.length === 1) {
        defaultId = stations[0].id.toString();
      }
      
      if (defaultId) {
        setSelectedStationId(defaultId);
        setExportStationId(defaultId);
      }
    }
  }, [stations, selectedStationId]);

  const fetchStations = async () => {
    try {
      const response = await fetch('/api/stations');
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      
      const data = await response.json();
      if (response.ok) {
        const stations = data.stations || [];
        setStations(stations);
        setStationsLoaded(true);
      } else {
        setImportError(data.error || 'Failed to fetch stations');
        setStationsLoaded(true);
      }
    } catch {
      setImportError('Network error. Please try again.');
      setStationsLoaded(true);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    
    if (selectedFile) {
      // Check file size (10MB limit for Vercel)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (selectedFile.size > maxSize) {
        setImportError(`File size (${(selectedFile.size / 1024 / 1024).toFixed(1)}MB) exceeds the 10MB limit. Please use a smaller file or split your ADIF file into chunks.`);
        setFile(null);
        e.target.value = '';
        return;
      }
      
      // Check file extension
      const fileName = selectedFile.name.toLowerCase();
      if (!fileName.endsWith('.adi') && !fileName.endsWith('.adif') && !fileName.endsWith('.txt')) {
        setImportError('Please select a valid ADIF file (.adi, .adif, or .txt)');
        setFile(null);
        e.target.value = '';
        return;
      }
    }
    
    setFile(selectedFile || null);
    setImportResult(null);
    setImportError('');
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      setImportError('Please select an ADIF file to upload');
      return;
    }
    
    if (!selectedStationId) {
      setImportError('Please select a station to associate the contacts with');
      return;
    }

    setUploading(true);
    setImportProgress(0);
    setImportError('');
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('stationId', selectedStationId);

      // Show progress while uploading
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + 5, 90));
      }, 500);

      const response = await fetch('/api/adif/import', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setImportProgress(95);

      const data = await response.json();

      if (response.ok) {
        setImportResult(data);
        setImportProgress(100);
        // Reset form
        setFile(null);
        const fileInput = document.getElementById('adif-file') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        // Provide specific error messages based on status
        let errorMessage = data.error || 'Failed to import ADIF file';
        
        if (response.status === 413) {
          errorMessage = data.error || 'File too large to process. Please use a smaller file.';
        } else if (response.status === 408) {
          errorMessage = data.error || 'Import timed out. Please try with a smaller file.';
        } else if (response.status === 500) {
          errorMessage = data.error || 'Server error during import. Please try with a smaller file or contact support.';
        }
        
        setImportError(errorMessage);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setImportError('Upload was cancelled.');
      } else {
        setImportError('Network error. Please check your connection and try again. For large files, consider splitting them into smaller chunks.');
      }
    } finally {
      setUploading(false);
      setImportProgress(0);
    }
  };

  const handleExportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!exportStationId) {
      setExportError('Please select a station to export contacts from');
      return;
    }

    setExporting(true);
    setExportError('');

    try {
      const response = await fetch('/api/adif/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stationId: exportStationId,
          startDate: startDate || null,
          endDate: endDate || null,
        }),
      });

      if (response.ok) {
        // Download the file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        
        // Get filename from Content-Disposition header or use default
        const contentDisposition = response.headers.get('Content-Disposition');
        const filename = contentDisposition 
          ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
          : 'export.adi';
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const data = await response.json();
        setExportError(data.error || 'Failed to export ADIF file');
      }
    } catch {
      setExportError('Network error. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const isValidAdifFile = (filename: string) => {
    const extension = filename.toLowerCase().split('.').pop();
    return extension === 'adi' || extension === 'adif' || extension === 'txt';
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar 
        title="ADIF Import/Export"
        actions={
          <Button variant="ghost" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
        }
      />

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 space-y-6">
          <Tabs defaultValue="auto-import" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="import" className="flex items-center space-x-2">
                <Upload className="h-4 w-4" />
                <span>Manual Import</span>
              </TabsTrigger>
              <TabsTrigger value="auto-import" className="flex items-center space-x-2">
                <FileText className="h-4 w-4" />
                <span>Auto Import</span>
              </TabsTrigger>
              <TabsTrigger value="export" className="flex items-center space-x-2">
                <Download className="h-4 w-4" />
                <span>Export</span>
              </TabsTrigger>
            </TabsList>

            {/* Import Tab */}
            <TabsContent value="import" className="space-y-6">
              {/* Import Form */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Upload className="h-5 w-5 mr-2" />
                    Manual ADIF Import
                  </CardTitle>
                  <CardDescription>
                    Upload smaller ADIF files (recommended: &lt;1000 contacts). For large files with 1000+ contacts, 
                    use the &quot;Auto Import&quot; tab which automatically splits and processes files in reliable chunks.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleImportSubmit} className="space-y-6">
                    {/* Station Selection */}
                    <div className="space-y-2">
                      <Label htmlFor="station">Station *</Label>
                      <div className="space-y-1">
                        {stationsLoaded ? (
                          <Select value={selectedStationId} onValueChange={setSelectedStationId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a station..." />
                            </SelectTrigger>
                            <SelectContent>
                              {stations.map((station) => (
                                <SelectItem key={station.id} value={station.id.toString()}>
                                  <div className="flex items-center space-x-2">
                                    <span className="font-mono">{station.callsign}</span>
                                    <span>-</span>
                                    <span>{station.station_name}</span>
                                    {station.is_default && (
                                      <span className="text-xs text-muted-foreground">(Default)</span>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
                            Loading stations...
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        All imported contacts will be associated with this station
                      </p>
                    </div>

                    {/* File Upload */}
                    <div className="space-y-2">
                      <Label htmlFor="adif-file">ADIF File *</Label>
                      <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Input
                          id="adif-file"
                          type="file"
                          accept=".adi,.adif,.txt"
                          onChange={handleFileChange}
                          disabled={uploading}
                        />
                      </div>
                      {file && (
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <FileText className="h-4 w-4" />
                          <span>{file.name}</span>
                          <span>({file.size > 1024 * 1024 ? (file.size / 1024 / 1024).toFixed(1) + ' MB' : (file.size / 1024).toFixed(1) + ' KB'})</span>
                          {!isValidAdifFile(file.name) && (
                            <span className="text-destructive">(Invalid file type)</span>
                          )}
                        </div>
                      )}
                      <p className="text-sm text-muted-foreground">
                        Supported formats: .adi, .adif, .txt (ADIF 3.1.5 compatible). Max size: 10MB, Max records: 5,000
                      </p>
                    </div>

                    {/* Error Display */}
                    {importError && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{importError}</AlertDescription>
                      </Alert>
                    )}

                    {/* Progress */}
                    {uploading && (
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">Processing ADIF file...</span>
                        </div>
                        <Progress value={importProgress} className="w-full" />
                      </div>
                    )}

                    {/* Submit Button */}
                    <Button 
                      type="submit" 
                      disabled={!file || !selectedStationId || uploading || (file && !isValidAdifFile(file.name))}
                      className="w-full"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Import ADIF File
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Import Results */}
              {importResult && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
                      Import Results
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">{importResult.imported}</div>
                          <div className="text-sm text-green-700 dark:text-green-300">Imported</div>
                        </div>
                        <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                          <div className="text-2xl font-bold text-yellow-600">{importResult.skipped}</div>
                          <div className="text-sm text-yellow-700 dark:text-yellow-300">Skipped</div>
                        </div>
                        <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                          <div className="text-2xl font-bold text-red-600">{importResult.errors}</div>
                          <div className="text-sm text-red-700 dark:text-red-300">Errors</div>
                        </div>
                      </div>
                      
                      {importResult.message && (
                        <Alert>
                          <AlertDescription>{importResult.message}</AlertDescription>
                        </Alert>
                      )}

                      {importResult.details && importResult.details.length > 0 && (
                        <div className="space-y-2">
                          <Label>Details:</Label>
                          <div className="bg-muted p-3 rounded-md text-sm">
                            {importResult.details.map((detail, index) => (
                              <div key={index}>{detail}</div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex space-x-2">
                        <Button asChild variant="outline">
                          <Link href="/dashboard">View Dashboard</Link>
                        </Button>
                        <Button 
                          onClick={() => {
                            setImportResult(null);
                            setImportProgress(0);
                          }}
                          variant="outline"
                        >
                          Import Another File
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Auto Import Tab */}
            <TabsContent value="auto-import" className="space-y-6">
              {stationsLoaded && stations.length > 0 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="auto-station">Select Station for Auto Import *</Label>
                    <Select
                      value={selectedStationId}
                      onValueChange={setSelectedStationId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a station to associate contacts with" />
                      </SelectTrigger>
                      <SelectContent>
                        {stations.map((station) => (
                          <SelectItem key={station.id} value={station.id.toString()}>
                            {station.callsign} - {station.station_name}
                            {station.is_default && <span className="ml-1 text-xs text-blue-600">(Default)</span>}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedStationId && (
                    <AutoImportADIF stationId={parseInt(selectedStationId)} />
                  )}

                  {!selectedStationId && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Please select a station above to enable auto-import functionality.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {!stationsLoaded && (
                <div className="text-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  <p className="text-sm text-muted-foreground mt-2">Loading stations...</p>
                </div>
              )}

              {stationsLoaded && stations.length === 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No stations found. Please <Link href="/stations/new" className="underline">create a station</Link> first before importing contacts.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            {/* Export Tab */}
            <TabsContent value="export" className="space-y-6">
              {/* Export Form */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Download className="h-5 w-5 mr-2" />
                    Export ADIF File
                  </CardTitle>
                  <CardDescription>
                    Export your amateur radio contacts to an ADIF file. Select a station and optionally filter by date range.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleExportSubmit} className="space-y-6">
                    {/* Station Selection */}
                    <div className="space-y-2">
                      <Label htmlFor="export-station">Station *</Label>
                      <div className="space-y-1">
                        {stationsLoaded ? (
                          <Select value={exportStationId} onValueChange={setExportStationId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a station..." />
                            </SelectTrigger>
                            <SelectContent>
                              {stations.map((station) => (
                                <SelectItem key={station.id} value={station.id.toString()}>
                                  <div className="flex items-center space-x-2">
                                    <span className="font-mono">{station.callsign}</span>
                                    <span>-</span>
                                    <span>{station.station_name}</span>
                                    {station.is_default && (
                                      <span className="text-xs text-muted-foreground">(Default)</span>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
                            Loading stations...
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        All contacts from this station will be exported
                      </p>
                    </div>

                    {/* Date Range */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="start-date" className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          Start Date (Optional)
                        </Label>
                        <Input
                          id="start-date"
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          disabled={exporting}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="end-date" className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          End Date (Optional)
                        </Label>
                        <Input
                          id="end-date"
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          disabled={exporting}
                        />
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Leave dates empty to export all contacts from the selected station
                    </p>

                    {/* Error Display */}
                    {exportError && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{exportError}</AlertDescription>
                      </Alert>
                    )}

                    {/* Submit Button */}
                    <Button 
                      type="submit" 
                      disabled={!exportStationId || exporting}
                      className="w-full"
                    >
                      {exporting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Exporting...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Export ADIF File
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Information */}
          <Card>
            <CardHeader>
              <CardTitle>About ADIF Import/Export</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Supported Fields</h4>
                <p className="text-sm text-muted-foreground">
                  Nextlog supports the most common ADIF fields including: callsign, frequency, mode, 
                  band, date/time, RST sent/received, QTH, grid locator, name, and more.
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Import Features</h4>
                <p className="text-sm text-muted-foreground">
                  Contacts with the same callsign, date, time, and frequency will be skipped to avoid duplicates.
                  All imported contacts will be associated with the selected station.
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Export Features</h4>
                <p className="text-sm text-muted-foreground">
                  Export contacts from any of your stations. Use the optional date range to filter contacts
                  by QSO date. The exported file will be compatible with other amateur radio logging software.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}