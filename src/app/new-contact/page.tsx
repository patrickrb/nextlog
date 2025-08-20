'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Loader2, Search, Check, AlertCircle, Radio, Clock } from 'lucide-react';
import Navbar from '@/components/Navbar';
import PreviousContacts from '@/components/PreviousContacts';

interface Station {
  id: number;
  callsign: string;
  station_name: string;
  is_default: boolean;
}

interface PreviousContact {
  id: number;
  datetime: string;
  band: string;
  mode: string;
  frequency: number;
  rst_sent?: string;
  rst_received?: string;
  name?: string;
  qth?: string;
  notes?: string;
}

export default function NewContactPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [stationsLoading, setStationsLoading] = useState(true);
  const [selectedStationId, setSelectedStationId] = useState<string>('');
  const [isLiveLogging, setIsLiveLogging] = useState(false);
  const [formData, setFormData] = useState({
    callsign: '',
    frequency: '',
    mode: 'SSB',
    band: '',
    datetime: new Date().toISOString().slice(0, 19),
    rst_sent: '59',
    rst_received: '59',
    name: '',
    qth: '',
    gridLocator: '',
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
    power: '',
    notes: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [lookupResult, setLookupResult] = useState<{
    found: boolean;
    name?: string;
    qth?: string;
    grid_locator?: string;
    latitude?: number;
    longitude?: number;
    error?: string;
  } | null>(null);
  const [previousContacts, setPreviousContacts] = useState<PreviousContact[]>([]);
  const [previousContactsLoading, setPreviousContactsLoading] = useState(false);
  const [previousContactsError, setPreviousContactsError] = useState('');
  const router = useRouter();

  const modes = ['SSB', 'CW', 'FM', 'AM', 'RTTY', 'PSK31', 'FT8', 'FT4', 'JT65', 'JT9', 'MFSK', 'OLIVIA', 'CONTESTIA'];
  const bands = ['160M', '80M', '60M', '40M', '30M', '20M', '17M', '15M', '12M', '10M', '6M', '2M', '1.25M', '70CM', '33CM', '23CM'];

  useEffect(() => {
    fetchStations();
  }, []);

  // Live logging effect - update datetime every second when enabled
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isLiveLogging) {
      interval = setInterval(() => {
        setFormData(prev => ({
          ...prev,
          datetime: new Date().toISOString().slice(0, 19) // Include seconds for visible ticking
        }));
      }, 1000);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isLiveLogging]);

  // Update datetime immediately when toggling to live mode
  useEffect(() => {
    if (isLiveLogging) {
      setFormData(prev => ({
        ...prev,
        datetime: new Date().toISOString().slice(0, 19) // Include seconds for visible ticking
      }));
    }
  }, [isLiveLogging]);

  const handleCallsignLookup = useCallback(async () => {
    if (!formData.callsign.trim()) return;

    setLookupLoading(true);
    setLookupResult(null);

    try {
      const response = await fetch('/api/lookup/callsign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ callsign: formData.callsign }),
      });

      const data = await response.json();

      if (response.ok) {
        setLookupResult(data);
        
        // Auto-fill form if lookup was successful
        if (data.found) {
          setFormData(prev => ({
            ...prev,
            name: data.name || prev.name,
            qth: data.qth || prev.qth,
            gridLocator: data.grid_locator || prev.gridLocator,
            // Use lat/lng from QRZ directly (already calculated in the lookup)
            latitude: data.latitude,
            longitude: data.longitude
          }));
        }
      } else {
        setLookupResult({
          found: false,
          error: data.error || 'Lookup failed'
        });
      }
    } catch {
      setLookupResult({
        found: false,
        error: 'Network error during lookup'
      });
    } finally {
      setLookupLoading(false);
    }
  }, [formData.callsign]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Enter to save
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        const form = document.querySelector('form');
        if (form) {
          form.requestSubmit();
        }
      }
      
      // Ctrl+L to focus callsign field
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        document.getElementById('callsign')?.focus();
      }
      
      // Ctrl+Q to lookup callsign
      if ((e.ctrlKey || e.metaKey) && e.key === 'q') {
        e.preventDefault();
        if (formData.callsign.trim()) {
          handleCallsignLookup();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [formData.callsign, handleCallsignLookup]);

  const fetchPreviousContacts = useCallback(async (callsign: string) => {
    if (!callsign.trim()) {
      setPreviousContacts([]);
      return;
    }

    setPreviousContactsLoading(true);
    setPreviousContactsError('');

    try {
      const response = await fetch(`/api/contacts/previous?callsign=${encodeURIComponent(callsign)}&limit=10`);
      
      if (response.status === 401) {
        // User not authenticated, but don't show error for this
        setPreviousContacts([]);
        return;
      }

      const data = await response.json();

      if (response.ok) {
        setPreviousContacts(data.contacts || []);
      } else {
        setPreviousContactsError(data.error || 'Failed to fetch previous contacts');
        setPreviousContacts([]);
      }
    } catch {
      setPreviousContactsError('Network error while fetching previous contacts');
      setPreviousContacts([]);
    } finally {
      setPreviousContactsLoading(false);
    }
  }, []);

  // Fetch previous contacts when callsign changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchPreviousContacts(formData.callsign);
    }, 500); // Debounce for 500ms to avoid too many API calls

    return () => clearTimeout(timeoutId);
  }, [formData.callsign, fetchPreviousContacts]);

  const fetchStations = async () => {
    try {
      setStationsLoading(true);
      const response = await fetch('/api/stations');
      if (response.ok) {
        const data = await response.json();
        setStations(data.stations || []);
        
        // Auto-select default station
        const defaultStation = data.stations?.find((station: Station) => station.is_default);
        if (defaultStation) {
          setSelectedStationId(defaultStation.id.toString());
        }
      }
    } catch {
      // Silent error handling for stations fetch
    } finally {
      setStationsLoading(false);
    }
  };

  // Validation functions
  const validateCallsign = (callsign: string): string | null => {
    if (!callsign.trim()) return null;
    // Basic amateur radio callsign format validation
    const callsignRegex = /^[A-Z0-9]{1,3}[0-9][A-Z0-9]{0,3}[A-Z]$/i;
    if (!callsignRegex.test(callsign)) {
      return 'Invalid callsign format';
    }
    return null;
  };

  const validateGridLocator = (grid: string): string | null => {
    if (!grid.trim()) return null;
    // Maidenhead grid locator validation (4 or 6 character format)
    const gridRegex = /^[A-R]{2}[0-9]{2}([A-X]{2})?$/i;
    if (!gridRegex.test(grid)) {
      return 'Invalid grid locator format (e.g., FN31pr)';
    }
    return null;
  };

  const validateFrequency = (frequency: string): string | null => {
    if (!frequency.trim()) return null;
    const freq = parseFloat(frequency);
    if (isNaN(freq) || freq < 0.1 || freq > 300000) {
      return 'Frequency must be between 0.1 and 300000 MHz';
    }
    // Check if frequency is in amateur bands
    const isInBand = (
      (freq >= 1.8 && freq <= 2.0) ||
      (freq >= 3.5 && freq <= 4.0) ||
      (freq >= 5.330 && freq <= 5.408) ||
      (freq >= 7.0 && freq <= 7.3) ||
      (freq >= 10.1 && freq <= 10.15) ||
      (freq >= 14.0 && freq <= 14.35) ||
      (freq >= 18.068 && freq <= 18.168) ||
      (freq >= 21.0 && freq <= 21.45) ||
      (freq >= 24.89 && freq <= 24.99) ||
      (freq >= 28.0 && freq <= 29.7) ||
      (freq >= 50.0 && freq <= 54.0) ||
      (freq >= 144.0 && freq <= 148.0) ||
      (freq >= 219.0 && freq <= 225.0) ||
      (freq >= 420.0 && freq <= 450.0) ||
      (freq >= 902.0 && freq <= 928.0) ||
      (freq >= 1240.0 && freq <= 1300.0)
    );
    if (!isInBand) {
      return 'Frequency is outside amateur radio bands';
    }
    return null;
  };

  // Real-time validation
  const validateField = (name: string, value: string) => {
    let error: string | null = null;
    
    switch (name) {
      case 'callsign':
        error = validateCallsign(value);
        break;
      case 'gridLocator':
        error = validateGridLocator(value);
        break;
      case 'frequency':
        error = validateFrequency(value);
        break;
    }

    setValidationErrors(prev => ({
      ...prev,
      [name]: error || ''
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Real-time validation
    validateField(name, value);
    
    // Clear lookup result when callsign changes
    if (name === 'callsign') {
      setLookupResult(null);
      // Previous contacts will be fetched via useEffect with debounce
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => {
      const newData = {
        ...prev,
        [name]: value
      };

      // Auto-adjust RST values based on mode
      if (name === 'mode') {
        if (value === 'CW') {
          newData.rst_sent = '599';
          newData.rst_received = '599';
        } else if (['SSB', 'FM', 'AM'].includes(value)) {
          newData.rst_sent = '59';
          newData.rst_received = '59';
        } else if (['FT8', 'FT4', 'PSK31', 'RTTY', 'MFSK', 'OLIVIA', 'CONTESTIA'].includes(value)) {
          newData.rst_sent = '-10';
          newData.rst_received = '-10';
        }
      }

      return newData;
    });
  };

  const handleFrequencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Real-time validation for frequency
    validateField(name, value);

    if (name === 'frequency') {
      const freq = parseFloat(value);
      if (freq) {
        let band = '';
        if (freq >= 1.8 && freq <= 2.0) band = '160M';
        else if (freq >= 3.5 && freq <= 4.0) band = '80M';
        else if (freq >= 5.330 && freq <= 5.408) band = '60M';
        else if (freq >= 7.0 && freq <= 7.3) band = '40M';
        else if (freq >= 10.1 && freq <= 10.15) band = '30M';
        else if (freq >= 14.0 && freq <= 14.35) band = '20M';
        else if (freq >= 18.068 && freq <= 18.168) band = '17M';
        else if (freq >= 21.0 && freq <= 21.45) band = '15M';
        else if (freq >= 24.89 && freq <= 24.99) band = '12M';
        else if (freq >= 28.0 && freq <= 29.7) band = '10M';
        else if (freq >= 50.0 && freq <= 54.0) band = '6M';
        else if (freq >= 144.0 && freq <= 148.0) band = '2M';
        else if (freq >= 219.0 && freq <= 225.0) band = '1.25M';
        else if (freq >= 420.0 && freq <= 450.0) band = '70CM';
        else if (freq >= 902.0 && freq <= 928.0) band = '33CM';
        else if (freq >= 1240.0 && freq <= 1300.0) band = '23CM';
        
        setFormData(prev => ({ ...prev, band }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Validate all fields before submission
    const errors: {[key: string]: string} = {};
    
    const callsignError = validateCallsign(formData.callsign);
    if (callsignError) errors.callsign = callsignError;
    
    const frequencyError = validateFrequency(formData.frequency);
    if (frequencyError) errors.frequency = frequencyError;
    
    const gridError = validateGridLocator(formData.gridLocator);
    if (gridError) errors.gridLocator = gridError;

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setError('Please fix the validation errors before submitting.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          station_id: selectedStationId ? parseInt(selectedStationId) : undefined,
          grid_locator: formData.gridLocator, // Map camelCase to snake_case
          latitude: formData.latitude,
          longitude: formData.longitude,
          frequency: parseFloat(formData.frequency),
          power: formData.power ? parseFloat(formData.power) : undefined,
          datetime: new Date(formData.datetime).toISOString()
        }),
      });

      if (response.status === 401) {
        router.push('/login');
        return;
      }

      const data = await response.json();

      if (response.ok) {
        router.push('/dashboard');
      } else {
        setError(data.error || 'Failed to create contact');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar 
        title="New Contact"
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
        <div className="px-4 py-6 sm:px-0">
          <Card>
            <CardHeader>
              <CardTitle>Log New Contact</CardTitle>
              <CardDescription>
                Enter the details for your amateur radio contact
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Station Selection */}
                {stations.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="station">Station *</Label>
                    <Select value={selectedStationId} onValueChange={setSelectedStationId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a station">
                          <div className="flex items-center">
                            <Radio className="h-4 w-4 mr-2" />
                            {selectedStationId && stations.find(s => s.id.toString() === selectedStationId)?.station_name}
                          </div>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {stations.map(station => (
                          <SelectItem key={station.id} value={station.id.toString()}>
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center">
                                <Radio className="h-4 w-4 mr-2" />
                                <span className="font-medium">{station.station_name}</span>
                                <span className="ml-2 text-muted-foreground font-mono">
                                  ({station.callsign})
                                </span>
                              </div>
                              {station.is_default && (
                                <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                                  Default
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {stations.length > 1 && (
                      <p className="text-sm text-muted-foreground">
                        Contact will be logged to the selected station logbook
                      </p>
                    )}
                  </div>
                )}

                {/* No stations warning */}
                {!stationsLoading && stations.length === 0 && (
                  <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <div className="flex items-start">
                      <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5 mr-3" />
                      <div className="flex-1">
                        <h3 className="font-medium text-yellow-800 dark:text-yellow-200">
                          No Station Configured
                        </h3>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                          You need to set up at least one station before logging contacts.
                        </p>
                        <div className="mt-3">
                          <Button asChild size="sm" variant="outline">
                            <Link href="/stations/new">
                              <Radio className="h-4 w-4 mr-2" />
                              Add Your First Station
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Basic Contact Information */}
                  <div className="md:col-span-2">
                    <h3 className="text-lg font-medium text-foreground mb-4 pb-2 border-b border-border">
                      Contact Information
                    </h3>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="callsign">Callsign *</Label>
                    <div className="flex space-x-2">
                      <Input
                        type="text"
                        name="callsign"
                        id="callsign"
                        required
                        value={formData.callsign}
                        onChange={handleChange}
                        placeholder="e.g., W1AW"
                        className={`flex-1 ${validationErrors.callsign ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleCallsignLookup}
                        disabled={!formData.callsign.trim() || lookupLoading}
                        title="Lookup callsign on QRZ.com"
                      >
                        {lookupLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    
                    {/* Validation error */}
                    {validationErrors.callsign && (
                      <p className="text-sm text-destructive flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {validationErrors.callsign}
                      </p>
                    )}
                    
                    {/* Lookup result indicator */}
                    {lookupResult && (
                      <div className={`flex items-center text-sm ${
                        lookupResult.found 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {lookupResult.found ? (
                          <>
                            <Check className="h-4 w-4 mr-1" />
                            Callsign found and information auto-filled
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-4 w-4 mr-1" />
                            {lookupResult.error || 'Callsign not found'}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Previous Contacts Section */}
                  {formData.callsign.trim() && (
                    <div className="md:col-span-2">
                      <PreviousContacts 
                        contacts={previousContacts}
                        loading={previousContactsLoading}
                        error={previousContactsError}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="frequency">Frequency (MHz) *</Label>
                    <Input
                      type="number"
                      name="frequency"
                      id="frequency"
                      step="0.001"
                      required
                      value={formData.frequency}
                      onChange={handleFrequencyChange}
                      placeholder="e.g., 14.205"
                      className={validationErrors.frequency ? 'border-destructive focus-visible:ring-destructive' : ''}
                    />
                    {validationErrors.frequency && (
                      <p className="text-sm text-destructive flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {validationErrors.frequency}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mode">Mode *</Label>
                    <Select value={formData.mode} onValueChange={(value) => handleSelectChange('mode', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select mode" />
                      </SelectTrigger>
                      <SelectContent>
                        {modes.map(mode => (
                          <SelectItem key={mode} value={mode}>{mode}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="band">Band *</Label>
                    <Select value={formData.band} onValueChange={(value) => handleSelectChange('band', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select band" />
                      </SelectTrigger>
                      <SelectContent>
                        {bands.map(band => (
                          <SelectItem key={band} value={band}>{band}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date and Time Section */}
                  <div className="md:col-span-2 mt-6">
                    <h3 className="text-lg font-medium text-foreground mb-4 pb-2 border-b border-border">
                      Date & Time
                    </h3>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="datetime">Date & Time *</Label>
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor="live-logging" className="text-sm text-muted-foreground">
                          Live logging
                        </Label>
                        <Switch
                          id="live-logging"
                          checked={isLiveLogging}
                          onCheckedChange={setIsLiveLogging}
                        />
                      </div>
                    </div>
                    <Input
                      type="datetime-local"
                      name="datetime"
                      id="datetime"
                      step={isLiveLogging ? "1" : undefined}
                      required
                      value={formData.datetime}
                      onChange={handleChange}
                      disabled={isLiveLogging}
                      className={isLiveLogging ? "bg-muted" : ""}
                    />
                    {isLiveLogging && (
                      <p className="text-xs text-muted-foreground">
                        ⏱️ Time updates every second - watch the seconds tick!
                      </p>
                    )}
                  </div>

                  {/* Signal Report Section */}
                  <div className="md:col-span-2 mt-6">
                    <h3 className="text-lg font-medium text-foreground mb-4 pb-2 border-b border-border">
                      Signal Reports
                    </h3>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rst_sent">RST Sent</Label>
                    <Input
                      type="text"
                      name="rst_sent"
                      id="rst_sent"
                      value={formData.rst_sent}
                      onChange={handleChange}
                      placeholder="e.g., 59"
                    />
                    <p className="text-xs text-muted-foreground">
                      Auto-adjusts based on mode: CW=599, Voice=59, Digital=-10
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rst_received">RST Received</Label>
                    <Input
                      type="text"
                      name="rst_received"
                      id="rst_received"
                      value={formData.rst_received}
                      onChange={handleChange}
                      placeholder="e.g., 59"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="power">Power (Watts)</Label>
                    <Input
                      type="number"
                      name="power"
                      id="power"
                      min="0"
                      value={formData.power}
                      onChange={handleChange}
                      placeholder="e.g., 100"
                    />
                  </div>

                  {/* Station Information Section */}
                  <div className="md:col-span-2 mt-6">
                    <h3 className="text-lg font-medium text-foreground mb-4 pb-2 border-b border-border">
                      Station Information
                    </h3>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      type="text"
                      name="name"
                      id="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Operator's name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="qth">QTH</Label>
                    <Input
                      type="text"
                      name="qth"
                      id="qth"
                      value={formData.qth}
                      onChange={handleChange}
                      placeholder="Location"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gridLocator">Grid Locator</Label>
                    <Input
                      type="text"
                      name="gridLocator"
                      id="gridLocator"
                      value={formData.gridLocator}
                      onChange={handleChange}
                      placeholder="e.g., FN31pr"
                      className={validationErrors.gridLocator ? 'border-destructive focus-visible:ring-destructive' : ''}
                    />
                    {validationErrors.gridLocator && (
                      <p className="text-sm text-destructive flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {validationErrors.gridLocator}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    name="notes"
                    id="notes"
                    rows={3}
                    value={formData.notes}
                    onChange={handleChange}
                    placeholder="Additional notes about this contact"
                  />
                </div>

                {/* Keyboard shortcuts help */}
                <div className="bg-muted/30 border border-border rounded-md p-3">
                  <p className="text-sm text-muted-foreground font-medium mb-2">⌨️ Keyboard Shortcuts:</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div><kbd className="px-1 py-0.5 bg-muted border rounded text-xs">Ctrl+Enter</kbd> Save contact</div>
                    <div><kbd className="px-1 py-0.5 bg-muted border rounded text-xs">Ctrl+L</kbd> Focus callsign</div>
                    <div><kbd className="px-1 py-0.5 bg-muted border rounded text-xs">Ctrl+Q</kbd> QRZ lookup</div>
                  </div>
                </div>

                {error && (
                  <div className="bg-destructive/15 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
                    {error}
                  </div>
                )}

                <div className="flex justify-end space-x-3">
                  <Button type="button" variant="outline" asChild>
                    <Link href="/dashboard">
                      Cancel
                    </Link>
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      'Save Contact'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}