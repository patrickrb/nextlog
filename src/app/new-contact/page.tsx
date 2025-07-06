'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Loader2, Search, Check, AlertCircle, Radio } from 'lucide-react';
import Navbar from '@/components/Navbar';

interface Station {
  id: number;
  callsign: string;
  station_name: string;
  is_default: boolean;
}

export default function NewContactPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<string>('');
  const [formData, setFormData] = useState({
    callsign: '',
    frequency: '',
    mode: 'SSB',
    band: '',
    datetime: new Date().toISOString().slice(0, 16),
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
  const [lookupResult, setLookupResult] = useState<{
    found: boolean;
    name?: string;
    qth?: string;
    grid_locator?: string;
    latitude?: number;
    longitude?: number;
    error?: string;
  } | null>(null);
  const router = useRouter();

  const modes = ['SSB', 'CW', 'FM', 'AM', 'RTTY', 'PSK31', 'FT8', 'FT4', 'JT65', 'JT9', 'MFSK', 'OLIVIA', 'CONTESTIA'];
  const bands = ['160M', '80M', '60M', '40M', '30M', '20M', '17M', '15M', '12M', '10M', '6M', '2M', '1.25M', '70CM', '33CM', '23CM'];

  useEffect(() => {
    fetchStations();
  }, []);

  const fetchStations = async () => {
    try {
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
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear lookup result when callsign changes
    if (name === 'callsign') {
      setLookupResult(null);
    }
  };

  const handleCallsignLookup = async () => {
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
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

  };

  const handleFrequencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

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
                {stations.length === 0 && (
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
                        className="flex-1"
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
                    />
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

                  <div className="space-y-2">
                    <Label htmlFor="datetime">Date & Time *</Label>
                    <Input
                      type="datetime-local"
                      name="datetime"
                      id="datetime"
                      required
                      value={formData.datetime}
                      onChange={handleChange}
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
                    />
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