'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, User, Key, MapPin, Settings, Radio, Upload, CheckCircle, Eye, EyeOff } from 'lucide-react';
import Navbar from '@/components/Navbar';
import ThemeToggle from '@/components/ThemeToggle';

interface User {
  id: number;
  email: string;
  name: string;
  callsign?: string;
  grid_locator?: string;
  qrz_username?: string;
  qrz_password?: string;
  qrz_auto_sync?: boolean;
}

export default function ProfilePage() {
  const [, setUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    callsign: '',
    grid_locator: '',
    qrz_username: '',
    qrz_password: '',
    qrz_auto_sync: false,
    lotw_username: '',
    lotw_password: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showLotwPassword, setShowLotwPassword] = useState(false);
  const [testingLotw, setTestingLotw] = useState(false);
  const [validatingQrz, setValidatingQrz] = useState(false);
  const [qrzValidationResult, setQrzValidationResult] = useState<{valid?: boolean; error?: string} | null>(null);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [stations, setStations] = useState<{id: number; callsign: string; station_name: string; is_default: boolean}[]>([]);
  const [selectedStation, setSelectedStation] = useState<string>('');
  const router = useRouter();

  const fetchUser = useCallback(async () => {
    try {
      const response = await fetch('/api/user');
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      
      const data = await response.json();
      if (response.ok) {
        setUser(data.user);
        setFormData({
          name: data.user.name || '',
          callsign: data.user.callsign || '',
          grid_locator: data.user.grid_locator || '',
          qrz_username: data.user.qrz_username || '',
          qrz_password: data.user.qrz_password || '',
          qrz_auto_sync: data.user.qrz_auto_sync || false,
          lotw_username: data.user.third_party_services?.lotw?.username || '',
          lotw_password: ''
        });
      } else {
        setError(data.error || 'Failed to fetch user profile');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  const fetchStations = useCallback(async () => {
    try {
      const response = await fetch('/api/stations');
      if (response.ok) {
        const data = await response.json();
        setStations(data.stations || []);
        
        // Set default station if none selected
        if (!selectedStation && data.stations?.length > 0) {
          const defaultStation = data.stations.find((s: {is_default: boolean}) => s.is_default) || data.stations[0];
          setSelectedStation(defaultStation.id.toString());
        }
      }
    } catch (error) {
      console.error('Failed to load stations:', error);
    }
  }, [selectedStation]);

  useEffect(() => {
    fetchUser();
    fetchStations();
  }, [fetchUser, fetchStations]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateQrzCredentials = async () => {
    if (!formData.qrz_username || !formData.qrz_password) {
      setQrzValidationResult({ valid: false, error: 'Both QRZ username and password are required' });
      return;
    }

    try {
      setValidatingQrz(true);
      setQrzValidationResult(null);

      const response = await fetch('/api/user/qrz/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (response.ok) {
        setQrzValidationResult({ valid: true });
      } else {
        setQrzValidationResult({ valid: false, error: data.error || 'QRZ validation failed' });
      }

    } catch (error) {
      console.error('QRZ validation error:', error);
      setQrzValidationResult({ valid: false, error: 'Network error during validation' });
    } finally {
      setValidatingQrz(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.status === 401) {
        router.push('/login');
        return;
      }

      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        setSuccess('Profile updated successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Failed to update profile');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const testLotwCredentials = async () => {
    if (!formData.lotw_username || !formData.lotw_password) {
      setError('Both LoTW username and password are required for testing');
      return;
    }

    try {
      setTestingLotw(true);
      setError('');
      setSuccess('');

      const response = await fetch('/api/lotw/credentials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: formData.lotw_username, 
          password: formData.lotw_password 
        })
      });

      const data = await response.json();

      if (response.ok) {
        if (data.valid) {
          setSuccess('LoTW credentials are valid!');
        } else {
          setError('Invalid LoTW credentials. Please check your username and password.');
        }
      } else {
        setError(data.error || 'Failed to test credentials');
      }

    } catch (error) {
      console.error('Test credentials error:', error);
      setError('Failed to test credentials');
    } finally {
      setTestingLotw(false);
    }
  };

  const saveLotwCredentials = async () => {
    if (!formData.lotw_username || !formData.lotw_password) {
      setError('Both LoTW username and password are required');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const response = await fetch('/api/lotw/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.lotw_username,
          password: formData.lotw_password
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('LoTW credentials saved successfully!');
        setFormData(prev => ({ ...prev, lotw_password: '' })); // Clear password field
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Failed to save LoTW credentials');
      }

    } catch (error) {
      console.error('Save LoTW credentials error:', error);
      setError('Failed to save LoTW credentials');
    } finally {
      setSaving(false);
    }
  };

  const handleCertificateUpload = async () => {
    if (!certFile || !selectedStation || !formData.callsign) {
      setError('Please select a station, enter your callsign, and choose a certificate file');
      return;
    }

    try {
      setUploadingCert(true);
      setError('');
      setSuccess('');

      const certFormData = new FormData();
      certFormData.append('p12_file', certFile);
      certFormData.append('station_id', selectedStation);
      certFormData.append('callsign', formData.callsign);

      const response = await fetch('/api/lotw/certificate', {
        method: 'POST',
        body: certFormData
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('LoTW certificate uploaded successfully!');
        setCertFile(null);
        // Reset file input
        const fileInput = document.getElementById('cert-file') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
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
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-lg">Loading profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar 
        title="User Profile"
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
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="h-5 w-5 mr-2" />
                Basic Information
              </CardTitle>
              <CardDescription>
                Update your personal information and amateur radio details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      type="text"
                      name="name"
                      id="name"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Your full name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="callsign">Callsign</Label>
                    <Input
                      type="text"
                      name="callsign"
                      id="callsign"
                      value={formData.callsign}
                      onChange={handleChange}
                      placeholder="e.g., W1AW"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="grid_locator" className="flex items-center">
                      <MapPin className="h-4 w-4 mr-1" />
                      Grid Locator
                    </Label>
                    <Input
                      type="text"
                      name="grid_locator"
                      id="grid_locator"
                      value={formData.grid_locator}
                      onChange={handleChange}
                      placeholder="e.g., FN31pr"
                      className="md:w-1/2"
                    />
                    <p className="text-sm text-muted-foreground">
                      Your grid locator is used to center the contact map on your QTH
                    </p>
                  </div>
                </div>

                {/* QRZ Configuration */}
                <div className="border-t pt-6">
                  <div className="flex items-center mb-4">
                    <Key className="h-5 w-5 mr-2" />
                    <h3 className="text-lg font-medium">QRZ.com Callsign Lookup</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="qrz_username">QRZ Username</Label>
                        <Input
                          type="text"
                          name="qrz_username"
                          id="qrz_username"
                          value={formData.qrz_username}
                          onChange={handleChange}
                          placeholder="Your QRZ.com username"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="qrz_password">QRZ Password</Label>
                        <Input
                          type="password"
                          name="qrz_password"
                          id="qrz_password"
                          value={formData.qrz_password}
                          onChange={handleChange}
                          placeholder="Your QRZ.com password"
                        />
                      </div>
                    </div>
                    <div className="bg-red-200 dark:bg-blue-950/50 border-2 border-red-500 dark:border-blue-800 rounded-md p-4">
                      <h4 className="font-medium text-red-900 dark:text-blue-100 mb-2">
                        QRZ.com Account Required:
                      </h4>
                      <ul className="text-sm text-red-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                        <li>You need a valid QRZ.com account to use callsign lookup</li>
                        <li>Enter your QRZ.com username and password above</li>
                        <li>This enables automatic lookup of callsign information when adding contacts</li>
                        <li>Your credentials are stored securely and only used for lookups</li>
                      </ul>
                      <p className="text-sm text-red-700 dark:text-blue-300 mt-2">
                        <strong>Note:</strong> QRZ.com subscription may be required for full XML API access.
                      </p>
                    </div>
                    
                    {/* QRZ Validation and Auto-sync */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={validateQrzCredentials}
                          disabled={validatingQrz || !formData.qrz_username || !formData.qrz_password}
                          className="min-w-[120px]"
                        >
                          {validatingQrz ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Testing...
                            </>
                          ) : (
                            'Validate Credentials'
                          )}
                        </Button>
                        
                        {qrzValidationResult && (
                          <div className="flex items-center">
                            {qrzValidationResult.valid ? (
                              <div className="flex items-center text-green-600">
                                <CheckCircle className="h-4 w-4 mr-1" />
                                <span className="text-sm">Valid</span>
                              </div>
                            ) : (
                              <div className="text-red-600 text-sm">
                                {qrzValidationResult.error}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="qrz_auto_sync"
                          checked={formData.qrz_auto_sync}
                          onCheckedChange={(checked) => 
                            setFormData(prev => ({ ...prev, qrz_auto_sync: checked }))
                          }
                        />
                        <Label htmlFor="qrz_auto_sync" className="text-sm font-medium">
                          Auto-sync new contacts to QRZ logbook
                        </Label>
                      </div>
                      
                      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1 text-sm">
                          QRZ Logbook Sync
                        </h4>
                        <p className="text-xs text-blue-800 dark:text-blue-200">
                          When enabled, new contacts will automatically sync to your QRZ.com logbook. 
                          You can also manually sync individual contacts or bulk sync from the contacts page.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* LoTW Configuration */}
                <div className="border-t pt-6">
                  <div className="flex items-center mb-4">
                    <Radio className="h-5 w-5 mr-2" />
                    <h3 className="text-lg font-medium">Logbook of The World (LoTW)</h3>
                  </div>
                  <div className="space-y-6">
                    {/* LoTW Credentials */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="lotw_username">LoTW Username</Label>
                          <Input
                            type="text"
                            name="lotw_username"
                            id="lotw_username"
                            value={formData.lotw_username}
                            onChange={handleChange}
                            placeholder="Your LoTW username"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lotw_password">LoTW Password</Label>
                          <div className="relative">
                            <Input
                              type={showLotwPassword ? 'text' : 'password'}
                              name="lotw_password"
                              id="lotw_password"
                              value={formData.lotw_password}
                              onChange={handleChange}
                              placeholder="Your LoTW password"
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
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={saveLotwCredentials}
                          disabled={saving || !formData.lotw_username || !formData.lotw_password}
                        >
                          {saving ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4 mr-2" />
                          )}
                          Save LoTW Credentials
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          onClick={testLotwCredentials}
                          disabled={testingLotw || !formData.lotw_username || !formData.lotw_password}
                        >
                          {testingLotw ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-2" />
                          )}
                          Test Connection
                        </Button>
                      </div>
                    </div>

                    {/* Certificate Upload */}
                    {stations.length > 0 && (
                      <div className="border-t pt-4">
                        <h4 className="font-medium mb-4">Upload LoTW Certificate</h4>
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="station-select">Station</Label>
                              <select
                                id="station-select"
                                value={selectedStation}
                                onChange={(e) => setSelectedStation(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <option value="">Select a station</option>
                                {stations.map((station) => (
                                  <option key={station.id} value={station.id.toString()}>
                                    {station.callsign} - {station.station_name}
                                    {station.is_default && ' (Default)'}
                                  </option>
                                ))}
                              </select>
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
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleCertificateUpload}
                            disabled={uploadingCert || !certFile || !selectedStation || !formData.callsign}
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
                    )}

                    <div className="bg-red-200 dark:bg-blue-950/50 border-2 border-red-500 dark:border-blue-800 rounded-md p-4">
                      <h4 className="font-medium text-red-900 dark:text-blue-100 mb-2">
                        LoTW Integration:
                      </h4>
                      <ul className="text-sm text-red-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                        <li>Enter your ARRL LoTW website username and password</li>
                        <li>Upload your .p12 certificate file for each station to enable uploads</li>
                        <li>Use the LoTW sync page to upload QSOs and download confirmations</li>
                        <li>Your credentials are encrypted and stored securely</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="bg-destructive/15 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="bg-green-50/50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-3 rounded-md text-sm">
                    {success}
                  </div>
                )}

                <div className="flex justify-end space-x-3">
                  <Button type="button" variant="outline" asChild>
                    <Link href="/dashboard">
                      Cancel
                    </Link>
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                Preferences
              </CardTitle>
              <CardDescription>
                Customize your Nextlog experience
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ThemeToggle />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}