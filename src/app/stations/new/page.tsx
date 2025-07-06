'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Radio } from 'lucide-react';
import { Combobox } from '@/components/ui/combobox';
import { CreateStationData } from '@/models/Station';

interface DxccEntity {
  adif: number;
  name: string;
  prefix: string;
  continent: string;
  deleted: boolean;
}

interface StateProvince {
  id: number;
  code: string;
  name: string;
  type: string;
  cq_zone?: string;
  itu_zone?: string;
}

interface StationFormData {
  callsign: string;
  station_name: string;
  operator_name: string;
  street_address: string;
  city: string;
  county: string;
  state_province: string;
  postal_code: string;
  country: string;
  dxcc_entity_code: string;
  grid_locator: string;
  latitude: string;
  longitude: string;
  itu_zone: string;
  cq_zone: string;
  power_watts: string;
  rig_info: string;
  antenna_info: string;
  station_equipment: string;
  is_active: boolean;
  is_default: boolean;
  qrz_api_key: string;
  club_callsign: string;
}

export default function NewStationPage() {
  const [dxccEntities, setDxccEntities] = useState<DxccEntity[]>([]);
  const [statesProvinces, setStatesProvinces] = useState<StateProvince[]>([]);
  const [formData, setFormData] = useState<StationFormData>({
    callsign: '',
    station_name: '',
    operator_name: '',
    street_address: '',
    city: '',
    county: '',
    state_province: '',
    postal_code: '',
    country: '',
    dxcc_entity_code: '',
    grid_locator: '',
    latitude: '',
    longitude: '',
    itu_zone: '',
    cq_zone: '',
    power_watts: '',
    rig_info: '',
    antenna_info: '',
    station_equipment: '',
    is_active: true,
    is_default: false,
    qrz_api_key: '',
    club_callsign: '',
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchDxccEntities();
  }, []);

  useEffect(() => {
    if (formData.dxcc_entity_code) {
      fetchStatesProvinces(parseInt(formData.dxcc_entity_code));
    } else {
      setStatesProvinces([]);
      setFormData(prev => ({ ...prev, state_province: '' }));
    }
  }, [formData.dxcc_entity_code]);

  const fetchDxccEntities = async () => {
    try {
      const response = await fetch('/api/dxcc');
      if (response.ok) {
        const data = await response.json();
        setDxccEntities(data.entities || []);
      }
    } catch {
      // Silent error handling for DXCC fetch
    }
  };

  const fetchStatesProvinces = async (dxccId: number) => {
    try {
      const response = await fetch(`/api/states?dxcc=${dxccId}`);
      if (response.ok) {
        const data = await response.json();
        setStatesProvinces(data.states || []);
      }
    } catch {
      // Silent error handling for states fetch
    }
  };

  const handleInputChange = (field: keyof StationFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleStateChange = (stateCode: string) => {
    handleInputChange('state_province', stateCode);
    
    // Auto-populate zones if available
    const selectedStateData = statesProvinces.find(state => state.code === stateCode);
    if (selectedStateData) {
      if (selectedStateData.cq_zone) {
        handleInputChange('cq_zone', selectedStateData.cq_zone);
      }
      if (selectedStateData.itu_zone) {
        handleInputChange('itu_zone', selectedStateData.itu_zone);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Prepare data for submission
      const submitData: Partial<CreateStationData> = {
        callsign: formData.callsign.trim().toUpperCase(),
        station_name: formData.station_name.trim(),
        is_active: formData.is_active,
        is_default: formData.is_default,
      };

      // Add optional string fields only if they have values
      if (formData.operator_name && formData.operator_name.trim()) {
        submitData.operator_name = formData.operator_name.trim();
      }
      if (formData.street_address && formData.street_address.trim()) {
        submitData.street_address = formData.street_address.trim();
      }
      if (formData.city && formData.city.trim()) {
        submitData.city = formData.city.trim();
      }
      if (formData.county && formData.county.trim()) {
        submitData.county = formData.county.trim();
      }
      if (formData.state_province && formData.state_province.trim()) {
        submitData.state_province = formData.state_province.trim();
      }
      if (formData.postal_code && formData.postal_code.trim()) {
        submitData.postal_code = formData.postal_code.trim();
      }
      if (formData.country && formData.country.trim()) {
        submitData.country = formData.country.trim();
      }
      if (formData.grid_locator && formData.grid_locator.trim()) {
        submitData.grid_locator = formData.grid_locator.trim();
      }
      if (formData.rig_info && formData.rig_info.trim()) {
        submitData.rig_info = formData.rig_info.trim();
      }
      if (formData.antenna_info && formData.antenna_info.trim()) {
        submitData.antenna_info = formData.antenna_info.trim();
      }
      if (formData.station_equipment && formData.station_equipment.trim()) {
        submitData.station_equipment = formData.station_equipment.trim();
      }
      if (formData.qrz_api_key && formData.qrz_api_key.trim()) {
        submitData.qrz_api_key = formData.qrz_api_key.trim();
      }
      if (formData.club_callsign && formData.club_callsign.trim()) {
        submitData.club_callsign = formData.club_callsign.trim();
      }

      // Handle numeric fields
      if (formData.dxcc_entity_code && formData.dxcc_entity_code.trim()) {
        submitData.dxcc_entity_code = parseInt(formData.dxcc_entity_code);
      }
      if (formData.latitude && formData.latitude.trim()) {
        submitData.latitude = parseFloat(formData.latitude);
      }
      if (formData.longitude && formData.longitude.trim()) {
        submitData.longitude = parseFloat(formData.longitude);
      }
      if (formData.itu_zone && formData.itu_zone.trim()) {
        submitData.itu_zone = parseInt(formData.itu_zone);
      }
      if (formData.cq_zone && formData.cq_zone.trim()) {
        submitData.cq_zone = parseInt(formData.cq_zone);
      }
      if (formData.power_watts && formData.power_watts.trim()) {
        submitData.power_watts = parseInt(formData.power_watts);
      }

      const response = await fetch('/api/stations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      const data = await response.json();

      if (response.ok) {
        router.push('/stations');
      } else {
        setError(data.error || 'Failed to create station');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-xl font-semibold hover:text-primary">
                NodeLog
              </Link>
              <span className="mx-2 text-muted-foreground">/</span>
              <Link href="/dashboard/stations" className="hover:text-primary">
                Stations
              </Link>
              <span className="mx-2 text-muted-foreground">/</span>
              <h1 className="text-xl font-semibold">Add Station</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" asChild>
                <Link href="/dashboard/stations">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Stations
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {error && (
            <div className="bg-destructive/15 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Radio className="h-5 w-5 mr-2" />
                  Basic Station Information
                </CardTitle>
                <CardDescription>
                  Essential details about your amateur radio station
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="callsign">Callsign *</Label>
                    <Input
                      id="callsign"
                      value={formData.callsign}
                      onChange={(e) => handleInputChange('callsign', e.target.value)}
                      placeholder="e.g., W1ABC"
                      className="font-mono"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="station_name">Station Name *</Label>
                    <Input
                      id="station_name"
                      value={formData.station_name}
                      onChange={(e) => handleInputChange('station_name', e.target.value)}
                      placeholder="e.g., Home QTH, Club Station"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="operator_name">Operator Name</Label>
                  <Input
                    id="operator_name"
                    value={formData.operator_name}
                    onChange={(e) => handleInputChange('operator_name', e.target.value)}
                    placeholder="Station operator's name"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={formData.is_active}
                      onChange={(e) => handleInputChange('is_active', e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="is_active">Station is active</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="is_default"
                      checked={formData.is_default}
                      onChange={(e) => handleInputChange('is_default', e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="is_default">Set as default station</Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Location Information</CardTitle>
                <CardDescription>
                  Geographic details for your station location
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="dxcc_entity">DXCC Entity</Label>
                  <Combobox
                    options={dxccEntities.map(entity => ({
                      value: entity.adif.toString(),
                      label: entity.name,
                      secondary: `${entity.prefix} (${entity.adif})`
                    }))}
                    value={formData.dxcc_entity_code}
                    onValueChange={(value) => handleInputChange('dxcc_entity_code', value)}
                    placeholder="Select DXCC entity..."
                    searchPlaceholder="Search countries..."
                    emptyText="No DXCC entity found."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="street_address">Street Address</Label>
                  <Input
                    id="street_address"
                    value={formData.street_address}
                    onChange={(e) => handleInputChange('street_address', e.target.value)}
                    placeholder="Street address"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      placeholder="City"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="county">County</Label>
                    <Input
                      id="county"
                      value={formData.county}
                      onChange={(e) => handleInputChange('county', e.target.value)}
                      placeholder="County"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state_province">State/Province</Label>
                    {statesProvinces.length > 0 ? (
                      <Select value={formData.state_province} onValueChange={handleStateChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select state/province" />
                        </SelectTrigger>
                        <SelectContent>
                          {statesProvinces.map(state => (
                            <SelectItem key={state.id} value={state.code}>
                              {state.name} ({state.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id="state_province"
                        value={formData.state_province}
                        onChange={(e) => handleInputChange('state_province', e.target.value)}
                        placeholder="State or Province"
                        disabled={!formData.dxcc_entity_code}
                      />
                    )}
                    {formData.dxcc_entity_code && statesProvinces.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No predefined states/provinces for this DXCC entity
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="postal_code">Postal Code</Label>
                    <Input
                      id="postal_code"
                      value={formData.postal_code}
                      onChange={(e) => handleInputChange('postal_code', e.target.value)}
                      placeholder="ZIP or postal code"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={formData.country}
                      onChange={(e) => handleInputChange('country', e.target.value)}
                      placeholder="Country"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="grid_locator">Grid Locator</Label>
                  <Input
                    id="grid_locator"
                    value={formData.grid_locator}
                    onChange={(e) => handleInputChange('grid_locator', e.target.value)}
                    placeholder="e.g., FN20XR"
                    className="font-mono"
                  />
                  <p className="text-sm text-muted-foreground">
                    Find your grid locator at{' '}
                    <a 
                      href="https://zone-check.eu/?m=loc" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      zone-check.eu
                    </a>
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dxcc_entity_code">DXCC Entity Code</Label>
                    <Input
                      id="dxcc_entity_code"
                      type="number"
                      value={formData.dxcc_entity_code}
                      onChange={(e) => handleInputChange('dxcc_entity_code', e.target.value)}
                      placeholder="e.g., 291"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="itu_zone">ITU Zone</Label>
                    <Input
                      id="itu_zone"
                      type="number"
                      min="1"
                      max="90"
                      value={formData.itu_zone}
                      onChange={(e) => handleInputChange('itu_zone', e.target.value)}
                      placeholder="1-90"
                    />
                    <p className="text-xs text-muted-foreground">
                      Auto-populated when state/province is selected
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cq_zone">CQ Zone</Label>
                    <Input
                      id="cq_zone"
                      type="number"
                      min="1"
                      max="40"
                      value={formData.cq_zone}
                      onChange={(e) => handleInputChange('cq_zone', e.target.value)}
                      placeholder="1-40"
                    />
                    <p className="text-xs text-muted-foreground">
                      Auto-populated when state/province is selected
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Station Equipment</CardTitle>
                <CardDescription>
                  Technical details about your station setup
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="power_watts">Power Output (Watts)</Label>
                  <Input
                    id="power_watts"
                    type="number"
                    min="1"
                    max="100000"
                    value={formData.power_watts}
                    onChange={(e) => handleInputChange('power_watts', e.target.value)}
                    placeholder="e.g., 100"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rig_info">Radio Equipment</Label>
                  <Textarea
                    id="rig_info"
                    value={formData.rig_info}
                    onChange={(e) => handleInputChange('rig_info', e.target.value)}
                    placeholder="Describe your radio equipment"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="antenna_info">Antenna Information</Label>
                  <Textarea
                    id="antenna_info"
                    value={formData.antenna_info}
                    onChange={(e) => handleInputChange('antenna_info', e.target.value)}
                    placeholder="Describe your antenna system"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="station_equipment">Additional Equipment</Label>
                  <Textarea
                    id="station_equipment"
                    value={formData.station_equipment}
                    onChange={(e) => handleInputChange('station_equipment', e.target.value)}
                    placeholder="Other station equipment and accessories"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Integration Settings</CardTitle>
                <CardDescription>
                  API keys and credentials for external services (optional)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="qrz_api_key">QRZ.com API Key</Label>
                  <Input
                    id="qrz_api_key"
                    type="password"
                    value={formData.qrz_api_key}
                    onChange={(e) => handleInputChange('qrz_api_key', e.target.value)}
                    placeholder="Your QRZ.com API key"
                  />
                  <p className="text-sm text-muted-foreground">
                    Get your API key from{' '}
                    <a 
                      href="https://www.qrz.com/page/current_spec.html" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      QRZ.com API documentation
                    </a>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="club_callsign">Club Callsign</Label>
                  <Input
                    id="club_callsign"
                    value={formData.club_callsign}
                    onChange={(e) => handleInputChange('club_callsign', e.target.value)}
                    placeholder="Associated club callsign"
                    className="font-mono"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end space-x-4">
              <Button type="button" variant="outline" asChild>
                <Link href="/dashboard/stations">Cancel</Link>
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Radio className="h-4 w-4 mr-2 animate-spin" />
                    Creating Station...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Create Station
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}