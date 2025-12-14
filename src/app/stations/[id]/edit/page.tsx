'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Combobox } from '@/components/ui/combobox';
import { ArrowLeft, Save, Radio, Loader2, CheckCircle, AlertCircle, Eye, EyeOff, Upload } from 'lucide-react';
import Navbar from '@/components/Navbar';
import ApiKeyManager from '@/components/stations/ApiKeyManager';

interface Station {
  id: number;
  user_id: number;
  callsign: string;
  station_name: string;
  operator_name?: string;
  qth_name?: string;
  street_address?: string;
  city?: string;
  county?: string;
  state_province?: string;
  postal_code?: string;
  country?: string;
  dxcc_entity_code?: number;
  grid_locator?: string;
  latitude?: number;
  longitude?: number;
  itu_zone?: number;
  cq_zone?: number;
  power_watts?: number;
  rig_info?: string;
  antenna_info?: string;
  station_equipment?: string;
  is_active: boolean;
  is_default: boolean;
  qrz_api_key?: string;
  club_callsign?: string;
  lotw_username?: string;
  lotw_password?: string;
}

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
  qth_name: string;
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
  lotw_username: string;
  lotw_password: string;
}

export default function EditStationPage({ params }: { params: Promise<{ id: string }> }) {
  const [stationId, setStationId] = useState<string>('');
  const [station, setStation] = useState<Station | null>(null);
  const [dxccEntities, setDxccEntities] = useState<DxccEntity[]>([]);
  const [statesProvinces, setStatesProvinces] = useState<StateProvince[]>([]);
  const [selectedDxcc, setSelectedDxcc] = useState<string>('');
  const [selectedState, setSelectedState] = useState<string>('');
  const [formData, setFormData] = useState<StationFormData>({
    callsign: '',
    station_name: '',
    operator_name: '',
    qth_name: '',
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
    lotw_username: '',
    lotw_password: '',
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [validatingQrz, setValidatingQrz] = useState(false);
  const [qrzValidation, setQrzValidation] = useState<{ valid: boolean; message: string } | null>(null);
  const [showLotwPassword, setShowLotwPassword] = useState(false);
  // const [testingLotw, setTestingLotw] = useState(false); // Unused - for future LoTW validation
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certName, setCertName] = useState('');
  const [uploadingCert, setUploadingCert] = useState(false);
  const [certificates, setCertificates] = useState<Array<{
    id: number;
    name: string;
    callsign: string;
    cert_created_at: string;
    is_active: boolean;
  }>>([]);
  const [selectedCertId, setSelectedCertId] = useState<number | null>(null);
  const [settingActive, setSettingActive] = useState(false);
  const [success, setSuccess] = useState('');
  const router = useRouter();

  useEffect(() => {
    params.then(({ id }) => {
      setStationId(id);
    });
  }, [params]);

  useEffect(() => {
    if (stationId) {
      fetchStation();
      fetchDxccEntities();
      fetchCertificates();
    }
  }, [stationId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedDxcc) {
      fetchStatesProvinces(selectedDxcc);
    } else {
      setStatesProvinces([]);
      setSelectedState('');
    }
  }, [selectedDxcc]);

  const fetchStation = async () => {
    try {
      const response = await fetch(`/api/stations/${stationId}`);
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      
      const data = await response.json();
      if (response.ok) {
        setStation(data);
        // Populate form with station data
        setFormData({
          callsign: data.callsign || '',
          station_name: data.station_name || '',
          operator_name: data.operator_name || '',
          qth_name: data.qth_name || '',
          street_address: data.street_address || '',
          city: data.city || '',
          county: data.county || '',
          state_province: data.state_province || '',
          postal_code: data.postal_code || '',
          country: data.country || '',
          dxcc_entity_code: data.dxcc_entity_code?.toString() || '',
          grid_locator: data.grid_locator || '',
          latitude: data.latitude?.toString() || '',
          longitude: data.longitude?.toString() || '',
          itu_zone: data.itu_zone?.toString() || '',
          cq_zone: data.cq_zone?.toString() || '',
          power_watts: data.power_watts?.toString() || '',
          rig_info: data.rig_info || '',
          antenna_info: data.antenna_info || '',
          station_equipment: data.station_equipment || '',
          is_active: data.is_active ?? true,
          is_default: data.is_default ?? false,
          qrz_api_key: data.qrz_api_key || '',
          club_callsign: data.club_callsign || '',
          lotw_username: data.lotw_username || '',
          lotw_password: '',
        });
        
        // Set initial DXCC and state selections
        if (data.dxcc_entity_code) {
          setSelectedDxcc(data.dxcc_entity_code.toString());
        }
        if (data.state_province) {
          setSelectedState(data.state_province);
        }
      } else {
        setError(data.error || 'Failed to fetch station');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDxccEntities = async () => {
    try {
      const response = await fetch('/api/dxcc');
      if (response.ok) {
        const data = await response.json();
        setDxccEntities(data.entities || []);
      }
    } catch (error) {
      console.error('Error fetching DXCC entities:', error);
    }
  };

  const fetchStatesProvinces = async (dxccCode: string) => {
    try {
      const response = await fetch(`/api/states?dxcc=${dxccCode}`);
      if (response.ok) {
        const data = await response.json();
        setStatesProvinces(data.states || []);
      }
    } catch (error) {
      console.error('Error fetching states/provinces:', error);
    }
  };

  const fetchCertificates = async () => {
    try {
      const response = await fetch(`/api/lotw/certificate?station_id=${stationId}`);
      if (response.ok) {
        const data = await response.json();
        setCertificates(data.certificates || []);

        // Set the active certificate as selected
        const activeCert = data.certificates?.find((cert: { is_active: boolean }) => cert.is_active);
        if (activeCert) {
          setSelectedCertId(activeCert.id);
        }
      }
    } catch (error) {
      console.error('Error fetching certificates:', error);
    }
  };

  const handleInputChange = (field: keyof StationFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear QRZ validation when API key changes
    if (field === 'qrz_api_key') {
      setQrzValidation(null);
    }
  };

  const handleSetActiveCertificate = async (certId: number) => {
    if (certId === selectedCertId) return; // Already active

    try {
      setSettingActive(true);
      setError('');

      // Deactivate all certificates for this station
      await fetch(`/api/lotw/certificate/set-active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          station_id: parseInt(stationId),
          certificate_id: certId
        })
      });

      // Refresh certificates list
      await fetchCertificates();
      setSuccess('Active certificate updated successfully!');
      setTimeout(() => setSuccess(''), 3000);

    } catch (error) {
      console.error('Error setting active certificate:', error);
      setError('Failed to set active certificate');
    } finally {
      setSettingActive(false);
    }
  };

  const handleValidateQrzApiKey = async () => {
    if (!formData.qrz_api_key.trim()) {
      setQrzValidation({ valid: false, message: 'Please enter a QRZ API key first' });
      return;
    }

    setValidatingQrz(true);
    setQrzValidation(null);

    try {
      const response = await fetch(`/api/stations/${stationId}/qrz-api-key/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          qrz_api_key: formData.qrz_api_key.trim()
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setQrzValidation({ valid: true, message: data.message || 'QRZ API key is valid' });
      } else {
        setQrzValidation({ valid: false, message: data.error || 'QRZ API key validation failed' });
      }
    } catch {
      setQrzValidation({ valid: false, message: 'Network error during validation' });
    } finally {
      setValidatingQrz(false);
    }
  };

  const handleDxccChange = (dxccCode: string) => {
    setSelectedDxcc(dxccCode);
    setSelectedState('');
    handleInputChange('dxcc_entity_code', dxccCode);
    handleInputChange('state_province', '');
  };

  const handleStateChange = (stateCode: string) => {
    setSelectedState(stateCode);
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
    setSaving(true);
    setError('');

    try {
      // Prepare data for submission
      const submitData: Partial<StationFormData & { [key: string]: unknown }> = {};

      // Only include fields that have changed
      if (formData.callsign.trim().toUpperCase() !== station?.callsign) {
        submitData.callsign = formData.callsign.trim().toUpperCase();
      }
      if (formData.station_name.trim() !== station?.station_name) {
        submitData.station_name = formData.station_name.trim();
      }
      if (formData.is_active !== station?.is_active) {
        submitData.is_active = formData.is_active;
      }
      if (formData.is_default !== station?.is_default) {
        submitData.is_default = formData.is_default;
      }

      // Handle optional string fields
      const optionalFields = [
        'operator_name', 'qth_name', 'street_address', 'city', 'county',
        'state_province', 'postal_code', 'country', 'grid_locator',
        'rig_info', 'antenna_info', 'station_equipment', 'qrz_api_key',
        'club_callsign', 'lotw_username', 'lotw_password'
      ];

      optionalFields.forEach(field => {
        const formValue = formData[field as keyof StationFormData] as string;
        const stationValue = station?.[field as keyof Station] as string;
        const trimmedValue = formValue?.trim() || '';
        
        if (trimmedValue !== (stationValue || '')) {
          submitData[field] = trimmedValue || null;
        }
      });

      // Handle numeric fields
      const numericFields = [
        { key: 'dxcc_entity_code', parser: parseInt },
        { key: 'latitude', parser: parseFloat },
        { key: 'longitude', parser: parseFloat },
        { key: 'itu_zone', parser: parseInt },
        { key: 'cq_zone', parser: parseInt },
        { key: 'power_watts', parser: parseInt }
      ];

      numericFields.forEach(({ key, parser }) => {
        const formValue = formData[key as keyof StationFormData] as string;
        const stationValue = station?.[key as keyof Station] as number;
        
        if (formValue && formValue.trim()) {
          const parsedValue = parser(formValue);
          if (parsedValue !== stationValue) {
            submitData[key] = parsedValue;
          }
        } else if (stationValue !== undefined && stationValue !== null) {
          submitData[key] = null;
        }
      });

      // Only proceed if there are changes
      if (Object.keys(submitData).length === 0) {
        router.push('/stations');
        return;
      }

      const response = await fetch(`/api/stations/${stationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      const data = await response.json();

      if (response.ok) {
        router.push('/stations');
      } else {
        setError(data.error || 'Failed to update station');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-lg">Loading station...</span>
        </div>
      </div>
    );
  }

  if (!station) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Station Not Found</h2>
          <p className="text-muted-foreground mb-4">The requested station could not be found.</p>
          <Button asChild>
            <Link href="/stations">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Stations
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar 
        breadcrumbs={[
          { label: "Stations", href: "/stations" },
          { label: `Edit ${station.station_name}` }
        ]}
        actions={
          <Button variant="ghost" asChild>
            <Link href="/stations">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Stations
            </Link>
          </Button>
        }
      />

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {error && (
            <div className="bg-destructive/15 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm mb-6">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50/50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-3 rounded-md text-sm mb-6">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Same form structure as new station form, but with pre-filled data */}
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

            {/* Location Information */}
            <Card>
              <CardHeader>
                <CardTitle>Location Information</CardTitle>
                <CardDescription>
                  Geographic details for your station location
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="dxcc_entity">DXCC Entity *</Label>
                  <Combobox
                    options={dxccEntities.map(entity => ({
                      value: entity.adif.toString(),
                      label: entity.name,
                      secondary: entity.prefix
                    }))}
                    value={selectedDxcc}
                    onValueChange={handleDxccChange}
                    placeholder="Select DXCC entity..."
                    searchPlaceholder="Search DXCC entities..."
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
                    <Combobox
                      options={statesProvinces.map(state => ({
                        value: state.code,
                        label: state.name,
                        secondary: state.code
                      }))}
                      value={selectedState}
                      onValueChange={handleStateChange}
                      placeholder="Select state/province..."
                      searchPlaceholder="Search states/provinces..."
                      emptyText="No state/province found."
                      disabled={!selectedDxcc}
                    />
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            {/* Equipment and Integration cards - same as new form */}
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
                  <div className="flex space-x-2">
                    <Input
                      id="qrz_api_key"
                      type="password"
                      value={formData.qrz_api_key}
                      onChange={(e) => handleInputChange('qrz_api_key', e.target.value)}
                      placeholder="Your QRZ.com API key"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleValidateQrzApiKey}
                      disabled={validatingQrz || !formData.qrz_api_key.trim()}
                    >
                      {validatingQrz ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Validate'
                      )}
                    </Button>
                  </div>
                  
                  {qrzValidation && (
                    <div className={`flex items-center space-x-2 text-sm ${
                      qrzValidation.valid 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      {qrzValidation.valid ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      <span>{qrzValidation.message}</span>
                    </div>
                  )}
                  
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
                    . This API key is used for logbook sync operations.
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

            {/* LoTW Integration */}
            <Card>
              <CardHeader>
                <CardTitle>LoTW Integration</CardTitle>
                <CardDescription>
                  Logbook of The World credentials and certificate for this station
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lotw_username">LoTW Username</Label>
                    <Input
                      id="lotw_username"
                      value={formData.lotw_username}
                      onChange={(e) => handleInputChange('lotw_username', e.target.value)}
                      placeholder="Your LoTW username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lotw_password">LoTW Password</Label>
                    <div className="relative">
                      <Input
                        id="lotw_password"
                        type={showLotwPassword ? 'text' : 'password'}
                        value={formData.lotw_password}
                        onChange={(e) => handleInputChange('lotw_password', e.target.value)}
                        placeholder={station?.lotw_password ? '••••••••' : 'Your LoTW password'}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowLotwPassword(!showLotwPassword)}
                      >
                        {showLotwPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Leave blank to keep existing password
                    </p>
                  </div>
                </div>

                {/* Existing Certificates */}
                {certificates.length > 0 && (
                  <div className="border-t pt-4 mt-4">
                    <h4 className="font-medium mb-4">Active Certificate</h4>
                    <div className="space-y-2">
                      <Label htmlFor="active-cert">Select Active Certificate</Label>
                      <select
                        id="active-cert"
                        value={selectedCertId || ''}
                        onChange={(e) => {
                          const certId = parseInt(e.target.value);
                          setSelectedCertId(certId);
                          handleSetActiveCertificate(certId);
                        }}
                        disabled={settingActive}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Select a certificate</option>
                        {certificates.map((cert) => (
                          <option key={cert.id} value={cert.id}>
                            {cert.name} - {cert.callsign} {cert.is_active ? '(Active)' : ''}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-muted-foreground">
                        {certificates.length} certificate{certificates.length !== 1 ? 's' : ''} uploaded.
                        The selected certificate will be used for LoTW uploads.
                      </p>
                    </div>
                  </div>
                )}

                {/* Certificate Upload */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium mb-4">Upload New Certificate</h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="cert-name">Certificate Name</Label>
                      <Input
                        id="cert-name"
                        type="text"
                        value={certName}
                        onChange={(e) => setCertName(e.target.value)}
                        placeholder="e.g., Main LoTW Cert, Backup Cert"
                      />
                      <p className="text-xs text-muted-foreground">
                        Give this certificate a name to identify it later
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cert-file">Certificate File (.p12)</Label>
                      <Input
                        id="cert-file"
                        type="file"
                        accept=".p12,.pfx"
                        onChange={(e) => setCertFile(e.target.files?.[0] || null)}
                      />
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        if (!certFile || !formData.callsign || !certName.trim()) {
                          setError('Please enter a certificate name, callsign, and choose a certificate file');
                          return;
                        }

                        try {
                          setUploadingCert(true);
                          setError('');
                          setSuccess('');

                          const certFormData = new FormData();
                          certFormData.append('p12_file', certFile);
                          certFormData.append('station_id', stationId);
                          certFormData.append('callsign', formData.callsign);
                          certFormData.append('cert_name', certName.trim());

                          const response = await fetch('/api/lotw/certificate', {
                            method: 'POST',
                            body: certFormData
                          });

                          const data = await response.json();

                          if (response.ok) {
                            setSuccess('LoTW certificate uploaded successfully!');
                            setCertFile(null);
                            setCertName('');
                            const fileInput = document.getElementById('cert-file') as HTMLInputElement;
                            if (fileInput) fileInput.value = '';
                            // Refresh certificates list
                            await fetchCertificates();
                            setTimeout(() => setSuccess(''), 3000);
                          } else {
                            setError(data.error || 'Certificate upload failed');
                          }
                        } catch (error) {
                          console.error('Certificate upload error:', error);
                          setError('Certificate upload failed');
                        } finally {
                          setUploadingCert(false);
                        }
                      }}
                      disabled={uploadingCert || !certFile || !formData.callsign || !certName.trim()}
                    >
                      {uploadingCert ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      Upload Certificate
                    </Button>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2 text-sm">
                    LoTW Integration
                  </h4>
                  <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                    <li>Enter your ARRL LoTW website username and password</li>
                    <li>Upload your .p12 certificate file to enable QSO uploads</li>
                    <li>Credentials are encrypted and stored securely per station</li>
                    <li>Click individual upload/download icons in the contact list</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* API Key Management */}
            <ApiKeyManager stationId={parseInt(stationId)} />

            <div className="flex justify-end space-x-4">
              <Button type="button" variant="outline" asChild>
                <Link href="/stations">Cancel</Link>
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Radio className="h-4 w-4 mr-2 animate-spin" />
                    Updating Station...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Update Station
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