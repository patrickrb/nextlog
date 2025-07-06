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
import { ArrowLeft, Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import Navbar from '@/components/Navbar';

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

export default function ImportPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<string>('');
  const [stationsLoaded, setStationsLoaded] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
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
        setError(data.error || 'Failed to fetch stations');
        setStationsLoaded(true);
      }
    } catch {
      setError('Network error. Please try again.');
      setStationsLoaded(true);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setFile(selectedFile || null);
    setResult(null);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      setError('Please select an ADIF file to upload');
      return;
    }
    
    if (!selectedStationId) {
      setError('Please select a station to associate the contacts with');
      return;
    }

    setUploading(true);
    setProgress(0);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('stationId', selectedStationId);

      const response = await fetch('/api/import/adif', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
        setProgress(100);
        // Reset form
        setFile(null);
        const fileInput = document.getElementById('adif-file') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        setError(data.error || 'Failed to import ADIF file');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const isValidAdifFile = (filename: string) => {
    const extension = filename.toLowerCase().split('.').pop();
    return extension === 'adi' || extension === 'adif';
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar 
        title="Import ADIF"
        actions={
          <Button variant="ghost" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
        }
      />

      <main className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 space-y-6">
          {/* Import Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Upload className="h-5 w-5 mr-2" />
                Import ADIF File
              </CardTitle>
              <CardDescription>
                Upload an ADIF (.adi or .adif) file to import your amateur radio contacts. 
                Select the station to associate these contacts with.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
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
                      accept=".adi,.adif"
                      onChange={handleFileChange}
                      disabled={uploading}
                    />
                  </div>
                  {file && (
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <span>{file.name}</span>
                      <span>({(file.size / 1024).toFixed(1)} KB)</span>
                      {!isValidAdifFile(file.name) && (
                        <span className="text-destructive">(Invalid file type)</span>
                      )}
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Supported formats: .adi, .adif (ADIF 3.1.5 compatible)
                  </p>
                </div>

                {/* Error Display */}
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Progress */}
                {uploading && (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Processing ADIF file...</span>
                    </div>
                    <Progress value={progress} className="w-full" />
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

          {/* Results */}
          {result && (
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
                      <div className="text-2xl font-bold text-green-600">{result.imported}</div>
                      <div className="text-sm text-green-700 dark:text-green-300">Imported</div>
                    </div>
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                      <div className="text-2xl font-bold text-yellow-600">{result.skipped}</div>
                      <div className="text-sm text-yellow-700 dark:text-yellow-300">Skipped</div>
                    </div>
                    <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{result.errors}</div>
                      <div className="text-sm text-red-700 dark:text-red-300">Errors</div>
                    </div>
                  </div>
                  
                  {result.message && (
                    <Alert>
                      <AlertDescription>{result.message}</AlertDescription>
                    </Alert>
                  )}

                  {result.details && result.details.length > 0 && (
                    <div className="space-y-2">
                      <Label>Details:</Label>
                      <div className="bg-muted p-3 rounded-md text-sm">
                        {result.details.map((detail, index) => (
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
                        setResult(null);
                        setProgress(0);
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

          {/* Information */}
          <Card>
            <CardHeader>
              <CardTitle>About ADIF Import</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Supported Fields</h4>
                <p className="text-sm text-muted-foreground">
                  NodeLog supports the most common ADIF fields including: callsign, frequency, mode, 
                  band, date/time, RST sent/received, QTH, grid locator, name, and more.
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Duplicate Handling</h4>
                <p className="text-sm text-muted-foreground">
                  Contacts with the same callsign, date, time, and frequency will be skipped to avoid duplicates.
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Station Assignment</h4>
                <p className="text-sm text-muted-foreground">
                  All imported contacts will be associated with the selected station. Make sure to choose 
                  the correct station before importing.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}