'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useUser } from '@/contexts/UserContext';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Image as ImageIcon, Calendar, Radio, MapPin, AlertCircle, ChevronLeft, 
  ChevronRight, Play, Square, Settings, Wifi, WifiOff, Signal, 
  Link as LinkIcon, Filter
} from 'lucide-react';

interface SSTVImageWithContact {
  id: number;
  contact_id?: number;
  station_id?: number;
  frequency_mhz?: number;
  mode: string;
  sstv_mode?: string;
  decode_timestamp: string;
  signal_strength?: number;
  filename: string;
  original_filename?: string;
  file_size: number;
  mime_type: string;
  storage_url?: string;
  width?: number;
  height?: number;
  quality_score?: number;
  radio_model?: string;
  cat_interface?: string;
  audio_source?: string;
  callsign_detected?: string;
  location_detected?: string;
  description?: string;
  tags?: string[];
  auto_linked: boolean;
  manual_review: boolean;
  created_at: string;
  updated_at: string;
  // Contact information (if linked)
  callsign?: string;
  datetime?: string;
  contact_frequency?: string;
  contact_mode?: string;
  qth?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface MonitorStatus {
  active: boolean;
  radio_connected: boolean;
  audio_connected: boolean;
  current_frequency?: number;
  signal_strength?: number;
  sstv_mode_detected?: string;
  last_activity?: string;
  error_message?: string;
}

interface RadioConfig {
  id?: number;
  radio_model: string;
  cat_interface: string;
  audio_source: string;
  auto_decode?: boolean;
  auto_log?: boolean;
  frequency_mhz?: number;
  active: boolean;
}

export default function SSTVPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [images, setImages] = useState<SSTVImageWithContact[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false
  });
  const [loadingImages, setLoadingImages] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Monitor states
  const [monitorStatus, setMonitorStatus] = useState<MonitorStatus>({
    active: false,
    radio_connected: false,
    audio_connected: false
  });
  const [radioConfig, setRadioConfig] = useState<RadioConfig | null>(null);
  const [supportedRadios, setSupportedRadios] = useState<Array<{
    model: string;
    cat_interfaces: string[];
    audio_sources: string[];
    dax_supported: boolean;
  }>>([]);
  
  // Filter states
  const [filterMode, setFilterMode] = useState<string>('all');
  const [filterLinked, setFilterLinked] = useState<string>('all');
  const [selectedImage, setSelectedImage] = useState<SSTVImageWithContact | null>(null);

  // Check authentication
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const fetchImages = useCallback(async (page: number = 1) => {
    try {
      setLoadingImages(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
      });

      if (filterMode !== 'all') {
        params.append('mode', filterMode);
      }
      
      if (filterLinked === 'linked') {
        params.append('linked_only', 'true');
      } else if (filterLinked === 'unlinked') {
        params.append('unlinked_only', 'true');
      }

      const response = await fetch(`/api/sstv-images?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch SSTV images');
      }

      const data = await response.json();
      setImages(data.images);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error fetching SSTV images:', err);
      setError(err instanceof Error ? err.message : 'Failed to load SSTV images');
    } finally {
      setLoadingImages(false);
    }
  }, [pagination.limit, filterMode, filterLinked]);

  const fetchMonitorStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/sstv-monitor');
      if (response.ok) {
        const data = await response.json();
        setMonitorStatus(data.status);
        setRadioConfig(data.config);
        setSupportedRadios(data.supported_radios);
      }
    } catch (err) {
      console.error('Error fetching monitor status:', err);
    }
  }, []);

  const toggleMonitoring = async () => {
    try {
      const action = monitorStatus.active ? 'stop' : 'start';
      const response = await fetch('/api/sstv-monitor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          config: radioConfig
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMonitorStatus(data.status);
        await fetchImages(); // Refresh images in case new ones were decoded
      }
    } catch (err) {
      console.error('Error toggling monitor:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchImages();
      fetchMonitorStatus();
    }
  }, [user, fetchImages, fetchMonitorStatus]);

  const handlePageChange = (newPage: number) => {
    fetchImages(newPage);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">SSTV Gallery</h1>
            <p className="text-muted-foreground">
              Decoded SSTV images from radio monitoring
            </p>
          </div>
        </div>

        <Tabs defaultValue="gallery" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="gallery">Image Gallery</TabsTrigger>
            <TabsTrigger value="monitor">Monitor Control</TabsTrigger>
          </TabsList>

          <TabsContent value="gallery" className="space-y-6">
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  <div className="space-y-2">
                    <Label>SSTV Mode</Label>
                    <Select value={filterMode} onValueChange={setFilterMode}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Modes</SelectItem>
                        <SelectItem value="Scottie1">Scottie 1</SelectItem>
                        <SelectItem value="Scottie2">Scottie 2</SelectItem>
                        <SelectItem value="Martin1">Martin 1</SelectItem>
                        <SelectItem value="Martin2">Martin 2</SelectItem>
                        <SelectItem value="Robot36">Robot 36</SelectItem>
                        <SelectItem value="PD120">PD 120</SelectItem>
                        <SelectItem value="PD180">PD 180</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>QSO Link Status</Label>
                    <Select value={filterLinked} onValueChange={setFilterLinked}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Images</SelectItem>
                        <SelectItem value="linked">Linked to QSO</SelectItem>
                        <SelectItem value="unlinked">Not Linked</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Images Grid */}
            {error && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {loadingImages ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-muted-foreground">Loading SSTV images...</div>
              </div>
            ) : images.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <ImageIcon className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No SSTV Images</h3>
                  <p className="text-muted-foreground text-center max-w-md">
                    No SSTV images have been decoded yet. Start monitoring to automatically decode SSTV signals.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {images.map((image) => (
                  <Card key={image.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="aspect-square relative">
                      {image.storage_url ? (
                        <Image
                          src={image.storage_url}
                          alt={`SSTV image ${image.filename}`}
                          fill
                          className="object-cover cursor-pointer"
                          onClick={() => setSelectedImage(image)}
                        />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <ImageIcon className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                      
                      {/* Quality indicator */}
                      {image.quality_score && (
                        <Badge 
                          className="absolute top-2 right-2"
                          variant={image.quality_score > 0.8 ? 'default' : 
                                   image.quality_score > 0.6 ? 'secondary' : 'destructive'}
                        >
                          {Math.round(image.quality_score * 100)}%
                        </Badge>
                      )}
                      
                      {/* Link indicator */}
                      {image.contact_id && (
                        <Badge className="absolute top-2 left-2 bg-green-500">
                          <LinkIcon className="h-3 w-3 mr-1" />
                          QSO
                        </Badge>
                      )}
                    </div>
                    
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {image.sstv_mode || 'SSTV'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatFileSize(image.file_size)}
                          </span>
                        </div>
                        
                        {image.frequency_mhz && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Radio className="h-3 w-3" />
                            {image.frequency_mhz} MHz
                          </div>
                        )}
                        
                        {image.callsign_detected && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {image.callsign_detected}
                          </div>
                        )}
                        
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatTimestamp(image.decode_timestamp)}
                        </div>
                        
                        {image.signal_strength && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Signal className="h-3 w-3" />
                            {image.signal_strength} dBm
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} images)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={!pagination.hasPrevPage}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={!pagination.hasNextPage}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="monitor" className="space-y-6">
            {/* Monitor Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {monitorStatus.active ? (
                    <Wifi className="h-5 w-5 text-green-500" />
                  ) : (
                    <WifiOff className="h-5 w-5 text-muted-foreground" />
                  )}
                  Monitor Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">SSTV Monitoring</span>
                        <Badge variant={monitorStatus.active ? 'default' : 'secondary'}>
                          {monitorStatus.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      {radioConfig && (
                        <p className="text-xs text-muted-foreground">
                          {radioConfig.radio_model} via {radioConfig.cat_interface}
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={toggleMonitoring}
                      variant={monitorStatus.active ? 'destructive' : 'default'}
                      disabled={!radioConfig}
                    >
                      {monitorStatus.active ? (
                        <>
                          <Square className="h-4 w-4 mr-2" />
                          Stop
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Start
                        </>
                      )}
                    </Button>
                  </div>

                  {monitorStatus.error_message && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{monitorStatus.error_message}</AlertDescription>
                    </Alert>
                  )}

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Radio Connection:</span>
                      <Badge variant={monitorStatus.radio_connected ? 'default' : 'secondary'}>
                        {monitorStatus.radio_connected ? 'Connected' : 'Disconnected'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Audio Connection:</span>
                      <Badge variant={monitorStatus.audio_connected ? 'default' : 'secondary'}>
                        {monitorStatus.audio_connected ? 'Connected' : 'Disconnected'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Radio Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Radio Configuration
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!radioConfig ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">
                      No radio configuration found. Configure your radio to start monitoring.
                    </p>
                    <Link href="/sstv/radio-config">
                      <Button>
                        <Settings className="h-4 w-4 mr-2" />
                        Configure Radio
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Radio Model:</span>
                        <p className="text-muted-foreground">{radioConfig.radio_model}</p>
                      </div>
                      <div>
                        <span className="font-medium">CAT Interface:</span>
                        <p className="text-muted-foreground">{radioConfig.cat_interface}</p>
                      </div>
                      <div>
                        <span className="font-medium">Audio Source:</span>
                        <p className="text-muted-foreground">{radioConfig.audio_source}</p>
                      </div>
                      {radioConfig.frequency_mhz && (
                        <div>
                          <span className="font-medium">Frequency:</span>
                          <p className="text-muted-foreground">{radioConfig.frequency_mhz} MHz</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="auto-decode"
                          checked={radioConfig.auto_decode}
                          disabled
                        />
                        <Label htmlFor="auto-decode">Auto Decode</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="auto-log"
                          checked={radioConfig.auto_log}
                          disabled
                        />
                        <Label htmlFor="auto-log">Auto Log</Label>
                      </div>
                    </div>
                    
                    <Link href="/sstv/radio-config">
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4 mr-2" />
                        Edit Configuration
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Supported Radios */}
            <Card>
              <CardHeader>
                <CardTitle>Supported Radios</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {supportedRadios.map((radio, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-2">
                      <h4 className="font-medium">{radio.model}</h4>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>
                          <span className="font-medium">CAT:</span> {radio.cat_interfaces.join(', ')}
                        </div>
                        <div>
                          <span className="font-medium">Audio:</span> {radio.audio_sources.join(', ')}
                        </div>
                        {radio.dax_supported && (
                          <Badge variant="secondary" className="text-xs">
                            DAX Supported
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Image Modal */}
        {selectedImage && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-lg max-w-4xl max-h-full overflow-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold">SSTV Image Details</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedImage(null)}
                  >
                    ×
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    {selectedImage.storage_url && (
                      <Image
                        src={selectedImage.storage_url}
                        alt={`SSTV image ${selectedImage.filename}`}
                        width={selectedImage.width || 320}
                        height={selectedImage.height || 240}
                        className="rounded-lg w-full"
                      />
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Mode:</span>
                        <p className="text-muted-foreground">{selectedImage.sstv_mode || 'SSTV'}</p>
                      </div>
                      <div>
                        <span className="font-medium">Frequency:</span>
                        <p className="text-muted-foreground">
                          {selectedImage.frequency_mhz ? `${selectedImage.frequency_mhz} MHz` : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium">Decoded:</span>
                        <p className="text-muted-foreground">
                          {formatTimestamp(selectedImage.decode_timestamp)}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium">Quality:</span>
                        <p className="text-muted-foreground">
                          {selectedImage.quality_score ? 
                            `${Math.round(selectedImage.quality_score * 100)}%` : 'N/A'}
                        </p>
                      </div>
                      {selectedImage.callsign_detected && (
                        <>
                          <div>
                            <span className="font-medium">Callsign:</span>
                            <p className="text-muted-foreground">{selectedImage.callsign_detected}</p>
                          </div>
                        </>
                      )}
                      {selectedImage.radio_model && (
                        <div>
                          <span className="font-medium">Radio:</span>
                          <p className="text-muted-foreground">{selectedImage.radio_model}</p>
                        </div>
                      )}
                    </div>
                    
                    {selectedImage.contact_id ? (
                      <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                        <h4 className="font-medium text-green-700 dark:text-green-300 mb-2">
                          Linked to QSO
                        </h4>
                        <div className="text-sm space-y-1">
                          <div>Callsign: {selectedImage.callsign}</div>
                          <div>Date: {selectedImage.datetime && new Date(selectedImage.datetime).toLocaleString()}</div>
                          <div>Mode: {selectedImage.contact_mode}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                        <h4 className="font-medium text-yellow-700 dark:text-yellow-300 mb-2">
                          Not Linked to QSO
                        </h4>
                        <p className="text-sm text-yellow-600 dark:text-yellow-400">
                          This SSTV image has not been linked to a contact log entry.
                        </p>
                        <Button size="sm" className="mt-2" variant="outline">
                          Link to QSO
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}