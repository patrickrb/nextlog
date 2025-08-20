'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Save, Radio, TestTube, AlertCircle, CheckCircle, Usb, Mic, RefreshCw } from 'lucide-react';

interface SupportedRadio {
  model: string;
  cat_interfaces: string[];
  audio_sources: string[];
  dax_supported: boolean;
}

interface RadioConfig {
  id?: number;
  user_id?: number;
  station_id?: number;
  radio_model: string;
  cat_interface: string;
  cat_port?: string;
  cat_baud_rate?: number;
  audio_source: string;
  audio_device?: string;
  dax_enabled?: boolean;
  auto_decode?: boolean;
  auto_log?: boolean;
  frequency_mhz?: number;
  active: boolean;
}

interface Station {
  id: number;
  callsign: string;
  station_name: string;
  is_default: boolean;
}

interface USBDevice {
  vendorId: number;
  productId: number;
  productName?: string;
  manufacturerName?: string;
  serialNumber?: string;
}

interface AudioDevice {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
  groupId: string;
}

export default function RadioConfigPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [supportedRadios, setSupportedRadios] = useState<SupportedRadio[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [usbDevices, setUsbDevices] = useState<USBDevice[]>([]);
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [enumeratingDevices, setEnumeratingDevices] = useState(false);
  const [config, setConfig] = useState<RadioConfig>({
    radio_model: '',
    cat_interface: '',
    cat_port: '',
    cat_baud_rate: 9600,
    audio_source: '',
    audio_device: '',
    dax_enabled: false,
    auto_decode: true,
    auto_log: true,
    frequency_mhz: 14.230,
    active: true
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [testResult, setTestResult] = useState<{
    radio_connected: boolean;
    audio_connected: boolean;
    error_message?: string;
  } | null>(null);

  // Check authentication
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Fetch initial data
  useEffect(() => {
    if (user) {
      fetchSupportedRadios();
      fetchStations();
      fetchExistingConfig();
      enumerateDevices();
    }
  }, [user]);

  const fetchSupportedRadios = async () => {
    try {
      const response = await fetch('/api/sstv-monitor');
      if (response.ok) {
        const data = await response.json();
        setSupportedRadios(data.supported_radios || []);
      }
    } catch (err) {
      console.error('Error fetching supported radios:', err);
    }
  };

  const fetchStations = async () => {
    try {
      const response = await fetch('/api/stations');
      if (response.ok) {
        const data = await response.json();
        setStations(data.stations || []);
      }
    } catch (err) {
      console.error('Error fetching stations:', err);
    }
  };

  const fetchExistingConfig = async () => {
    try {
      const response = await fetch('/api/sstv-monitor');
      if (response.ok) {
        const data = await response.json();
        if (data.config) {
          setConfig({
            ...data.config,
            frequency_mhz: data.config.frequency_mhz || 14.230,
            cat_baud_rate: data.config.cat_baud_rate || 9600
          });
        }
      }
    } catch (err) {
      console.error('Error fetching existing config:', err);
    }
  };

  const enumerateDevices = async () => {
    try {
      setEnumeratingDevices(true);
      
      // Enumerate USB devices (requires user gesture for WebUSB)
      if ('usb' in navigator && navigator.usb) {
        try {
          const devices = await navigator.usb.getDevices();
          const mappedDevices: USBDevice[] = devices.map(device => ({
            vendorId: device.vendorId,
            productId: device.productId,
            productName: device.productName,
            manufacturerName: device.manufacturerName,
            serialNumber: device.serialNumber
          }));
          setUsbDevices(mappedDevices);
        } catch (usbError) {
          console.log('USB enumeration failed (may require user gesture):', usbError);
        }
      }

      // Enumerate audio devices
      if ('mediaDevices' in navigator && navigator.mediaDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const audioInputs = devices
            .filter(device => device.kind === 'audioinput')
            .map(device => ({
              deviceId: device.deviceId,
              label: device.label || `Audio Input ${device.deviceId.slice(0, 8)}`,
              kind: device.kind,
              groupId: device.groupId
            }));
          setAudioDevices(audioInputs);
        } catch (audioError) {
          console.error('Audio enumeration failed:', audioError);
        }
      }
    } catch (err) {
      console.error('Error enumerating devices:', err);
    } finally {
      setEnumeratingDevices(false);
    }
  };

  const requestUSBAccess = async () => {
    try {
      if ('usb' in navigator && navigator.usb) {
        // Request access to USB devices - this requires user gesture
        const device = await navigator.usb.requestDevice({
          filters: [
            { vendorId: 0x0451 }, // Texas Instruments (common for radio interfaces)
            { vendorId: 0x0403 }, // FTDI
            { vendorId: 0x10C4 }, // Silicon Labs (CP210x)
            { vendorId: 0x067B }, // Prolific
            { vendorId: 0x1A86 }, // QinHeng Electronics (CH340)
            { vendorId: 0x0483 }, // STMicroelectronics
            { vendorId: 0x16C0 }, // Van Ooijen Technische Informatica (VOTI)
            { vendorId: 0x1B1C }, // Corsair
            // Add more vendor IDs for common radio manufacturers
            { vendorId: 0x0C26 }, // Icom
            { vendorId: 0x04D8 }, // Microchip (used by some Kenwood)
          ]
        });
        
        if (device) {
          // Re-enumerate devices to include the newly granted device
          await enumerateDevices();
        }
      }
    } catch (err) {
      console.log('USB access request cancelled or failed:', err);
    }
  };

  const requestAudioAccess = async () => {
    try {
      if ('mediaDevices' in navigator && navigator.mediaDevices) {
        // Request audio access to get device labels
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Stop the stream immediately - we just needed permission
        stream.getTracks().forEach(track => track.stop());
        // Re-enumerate to get proper labels
        await enumerateDevices();
      }
    } catch (err) {
      console.log('Audio access request failed:', err);
    }
  };

  const getSelectedRadio = () => {
    return supportedRadios.find(radio => radio.model === config.radio_model);
  };

  const handleRadioModelChange = (value: string) => {
    const selectedRadio = supportedRadios.find(radio => radio.model === value);
    setConfig(prev => ({
      ...prev,
      radio_model: value,
      cat_interface: selectedRadio?.cat_interfaces[0] || '',
      audio_source: selectedRadio?.audio_sources[0] || '',
      dax_enabled: selectedRadio?.dax_supported && prev.dax_enabled
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      // Validate required fields
      if (!config.radio_model || !config.cat_interface || !config.audio_source) {
        setError('Please fill in all required fields: Radio Model, CAT Interface, and Audio Source');
        return;
      }

      const response = await fetch('/api/sstv-monitor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'start',
          config: {
            ...config,
            frequency_mhz: config.frequency_mhz ? parseFloat(config.frequency_mhz.toString()) : null,
            cat_baud_rate: config.cat_baud_rate ? parseInt(config.cat_baud_rate.toString()) : 9600
          }
        }),
      });

      if (response.ok) {
        setSuccess('Radio configuration saved successfully!');
        setTimeout(() => {
          router.push('/sstv');
        }, 2000);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save configuration');
      }
    } catch (err) {
      setError('Failed to save configuration. Please try again.');
      console.error('Error saving config:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setTestResult(null);

      const response = await fetch('/api/sstv-monitor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'test_connection',
          config
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTestResult(data.test_results);
      } else {
        const data = await response.json();
        setTestResult({
          radio_connected: false,
          audio_connected: false,
          error_message: data.error || 'Test failed'
        });
      }
    } catch {
      setTestResult({
        radio_connected: false,
        audio_connected: false,
        error_message: 'Test connection failed'
      });
    } finally {
      setTesting(false);
    }
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

  const selectedRadio = getSelectedRadio();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/sstv">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to SSTV Gallery
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Radio Configuration</h1>
            <p className="text-muted-foreground">
              Configure your radio for SSTV monitoring and decoding
            </p>
          </div>
        </div>

        {error && (
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6 border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Radio Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="h-5 w-5" />
                Radio Setup
              </CardTitle>
              <CardDescription>
                Configure your radio model and control interface
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Station Selection */}
              {stations.length > 1 && (
                <div className="space-y-2">
                  <Label htmlFor="station">Station</Label>
                  <Select
                    value={config.station_id?.toString() || ''}
                    onValueChange={(value) => setConfig(prev => ({ 
                      ...prev, 
                      station_id: value ? parseInt(value) : undefined 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select station (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No specific station</SelectItem>
                      {stations.map((station) => (
                        <SelectItem key={station.id} value={station.id.toString()}>
                          {station.callsign} - {station.station_name}
                          {station.is_default && ' (Default)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Radio Model */}
              <div className="space-y-2">
                <Label htmlFor="radio_model">Radio Model *</Label>
                <Select value={config.radio_model} onValueChange={handleRadioModelChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select radio model" />
                  </SelectTrigger>
                  <SelectContent>
                    {supportedRadios.map((radio) => (
                      <SelectItem key={radio.model} value={radio.model}>
                        {radio.model}
                        {radio.dax_supported && ' (DAX)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* CAT Interface */}
              {selectedRadio && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="cat_interface">CAT Interface *</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={requestUSBAccess}
                        disabled={enumeratingDevices}
                      >
                        <Usb className="h-3 w-3 mr-1" />
                        USB Access
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={enumerateDevices}
                        disabled={enumeratingDevices}
                      >
                        <RefreshCw className={`h-3 w-3 mr-1 ${enumeratingDevices ? 'animate-spin' : ''}`} />
                        Refresh
                      </Button>
                    </div>
                  </div>
                  <Select
                    value={config.cat_interface}
                    onValueChange={(value) => setConfig(prev => ({ ...prev, cat_interface: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select CAT interface" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Static interface options */}
                      {selectedRadio.cat_interfaces.map((catInterface) => (
                        <SelectItem key={catInterface} value={catInterface}>
                          {catInterface}
                        </SelectItem>
                      ))}
                      
                      {/* Enumerated USB devices */}
                      {usbDevices.length > 0 && (
                        <>
                          <SelectItem value="separator-usb" disabled>
                            ─── USB Devices ───
                          </SelectItem>
                          {usbDevices.map((device, index) => (
                            <SelectItem 
                              key={`usb-${index}`} 
                              value={`USB:${device.vendorId.toString(16)}:${device.productId.toString(16)}`}
                            >
                              {device.productName || device.manufacturerName || `USB Device ${device.vendorId.toString(16)}:${device.productId.toString(16)}`}
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  {usbDevices.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Click &quot;USB Access&quot; to enumerate connected USB devices
                    </p>
                  )}
                </div>
              )}

              {/* CAT Port (for serial interfaces) */}
              {config.cat_interface && ['RS232', 'USB'].includes(config.cat_interface) && (
                <div className="space-y-2">
                  <Label htmlFor="cat_port">CAT Port</Label>
                  <Input
                    id="cat_port"
                    value={config.cat_port || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, cat_port: e.target.value }))}
                    placeholder="e.g., COM3, /dev/ttyUSB0"
                  />
                </div>
              )}

              {/* Baud Rate (for serial interfaces) */}
              {config.cat_interface && ['RS232', 'CI-V'].includes(config.cat_interface) && (
                <div className="space-y-2">
                  <Label htmlFor="cat_baud_rate">Baud Rate</Label>
                  <Select
                    value={config.cat_baud_rate?.toString() || '9600'}
                    onValueChange={(value) => setConfig(prev => ({ 
                      ...prev, 
                      cat_baud_rate: parseInt(value) 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1200">1200</SelectItem>
                      <SelectItem value="4800">4800</SelectItem>
                      <SelectItem value="9600">9600</SelectItem>
                      <SelectItem value="19200">19200</SelectItem>
                      <SelectItem value="38400">38400</SelectItem>
                      <SelectItem value="57600">57600</SelectItem>
                      <SelectItem value="115200">115200</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Audio Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Audio Setup</CardTitle>
              <CardDescription>
                Configure audio source for SSTV decoding
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Audio Source */}
              {selectedRadio && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="audio_source">Audio Source *</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={requestAudioAccess}
                      disabled={enumeratingDevices}
                    >
                      <Mic className="h-3 w-3 mr-1" />
                      Audio Access
                    </Button>
                  </div>
                  <Select
                    value={config.audio_source}
                    onValueChange={(value) => setConfig(prev => ({ ...prev, audio_source: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select audio source" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Static audio source options */}
                      {selectedRadio.audio_sources.map((source) => (
                        <SelectItem key={source} value={source}>
                          {source}
                        </SelectItem>
                      ))}
                      
                      {/* Enumerated audio devices */}
                      {audioDevices.length > 0 && (
                        <>
                          <SelectItem value="separator-audio" disabled>
                            ─── Audio Input Devices ───
                          </SelectItem>
                          {audioDevices.map((device) => (
                            <SelectItem 
                              key={device.deviceId} 
                              value={`AudioInput:${device.deviceId}`}
                            >
                              {device.label}
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  {audioDevices.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Click &quot;Audio Access&quot; to enumerate available audio input devices
                    </p>
                  )}
                </div>
              )}

              {/* Audio Device */}
              <div className="space-y-2">
                <Label htmlFor="audio_device">Audio Device</Label>
                <Input
                  id="audio_device"
                  value={config.audio_device || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, audio_device: e.target.value }))}
                  placeholder="e.g., USB Audio Device, Built-in Audio"
                />
              </div>

              {/* DAX Enabled */}
              {selectedRadio?.dax_supported && config.audio_source === 'DAX Audio' && (
                <div className="flex items-center space-x-2">
                  <Switch
                    id="dax_enabled"
                    checked={config.dax_enabled || false}
                    onCheckedChange={(checked) => setConfig(prev => ({ 
                      ...prev, 
                      dax_enabled: checked 
                    }))}
                  />
                  <Label htmlFor="dax_enabled">Enable DAX Audio</Label>
                </div>
              )}

              {/* Frequency */}
              <div className="space-y-2">
                <Label htmlFor="frequency_mhz">Default Frequency (MHz)</Label>
                <Input
                  id="frequency_mhz"
                  type="number"
                  step="0.001"
                  value={config.frequency_mhz || ''}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev, 
                    frequency_mhz: e.target.value ? parseFloat(e.target.value) : undefined 
                  }))}
                  placeholder="14.230"
                />
                <p className="text-xs text-muted-foreground">
                  Common SSTV frequencies: 14.230, 21.340, 28.680 MHz
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monitoring Options */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Monitoring Options</CardTitle>
            <CardDescription>
              Configure automatic decoding and logging behavior
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center space-x-2">
                <Switch
                  id="auto_decode"
                  checked={config.auto_decode || false}
                  onCheckedChange={(checked) => setConfig(prev => ({ 
                    ...prev, 
                    auto_decode: checked 
                  }))}
                />
                <div>
                  <Label htmlFor="auto_decode">Auto Decode</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically decode detected SSTV signals
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="auto_log"
                  checked={config.auto_log || false}
                  onCheckedChange={(checked) => setConfig(prev => ({ 
                    ...prev, 
                    auto_log: checked 
                  }))}
                />
                <div>
                  <Label htmlFor="auto_log">Auto Log</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically save decoded images
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test Results */}
        {testResult && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Connection Test Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>Radio Connection:</span>
                  <span className={testResult.radio_connected ? 'text-green-600' : 'text-red-600'}>
                    {testResult.radio_connected ? 'Connected' : 'Failed'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Audio Connection:</span>
                  <span className={testResult.audio_connected ? 'text-green-600' : 'text-red-600'}>
                    {testResult.audio_connected ? 'Connected' : 'Failed'}
                  </span>
                </div>
                {testResult.error_message && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {testResult.error_message}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between mt-8">
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={testing || !config.radio_model || !config.cat_interface || !config.audio_source}
          >
            <TestTube className="h-4 w-4 mr-2" />
            {testing ? 'Testing...' : 'Test Connection'}
          </Button>
          
          <div className="flex items-center gap-4">
            <Link href="/sstv">
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}