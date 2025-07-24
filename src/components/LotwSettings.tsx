'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, Settings, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react';

interface LotwCredentials {
  lotw_username: string | null;
  has_password: boolean;
}

interface Station {
  id: number;
  callsign: string;
  station_name: string;
  is_default: boolean;
}

interface LotwSettingsProps {
  stations: Station[];
}

export default function LotwSettings({ stations }: LotwSettingsProps) {
  const [userCredentials, setUserCredentials] = useState<LotwCredentials>({ lotw_username: null, has_password: false });
  const [stationCredentials, setStationCredentials] = useState<Record<number, LotwCredentials>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Form states
  const [userForm, setUserForm] = useState({ username: '', password: '' });
  const [stationForms, setStationForms] = useState<Record<number, { username: string; password: string }>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadCredentials();
  }, [loadCredentials]);

  const loadCredentials = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load user-level credentials
      const userResponse = await fetch('/api/lotw/credentials');
      if (userResponse.ok) {
        const userData = await userResponse.json();
        setUserCredentials(userData);
        setUserForm({ username: userData.lotw_username || '', password: '' });
      }

      // Load station-level credentials
      const stationCreds: Record<number, LotwCredentials> = {};
      const stationForms: Record<number, { username: string; password: string }> = {};

      for (const station of stations) {
        const stationResponse = await fetch(`/api/lotw/credentials?station_id=${station.id}`);
        if (stationResponse.ok) {
          const stationData = await stationResponse.json();
          stationCreds[station.id] = stationData;
          stationForms[station.id] = { username: stationData.lotw_username || '', password: '' };
        }
      }

      setStationCredentials(stationCreds);
      setStationForms(stationForms);

    } catch (error) {
      console.error('Failed to load LoTW credentials:', error);
      setMessage({ type: 'error', text: 'Failed to load LoTW credentials' });
    } finally {
      setLoading(false);
    }
  }, [stations]);

  const saveUserCredentials = async () => {
    if (!userForm.username || !userForm.password) {
      setMessage({ type: 'error', text: 'Both username and password are required' });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);

      const response = await fetch('/api/lotw/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: userForm.username,
          password: userForm.password
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'User LoTW credentials saved successfully' });
        setUserForm(prev => ({ ...prev, password: '' })); // Clear password field
        await loadCredentials(); // Reload to update status
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save credentials' });
      }

    } catch (error) {
      console.error('Save credentials error:', error);
      setMessage({ type: 'error', text: 'Failed to save credentials' });
    } finally {
      setSaving(false);
    }
  };

  const saveStationCredentials = async (stationId: number) => {
    const form = stationForms[stationId];
    if (!form?.username || !form?.password) {
      setMessage({ type: 'error', text: 'Both username and password are required' });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);

      const response = await fetch('/api/lotw/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username,
          password: form.password,
          station_id: stationId
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Station LoTW credentials saved successfully' });
        // Clear password field for this station
        setStationForms(prev => ({
          ...prev,
          [stationId]: { ...prev[stationId], password: '' }
        }));
        await loadCredentials(); // Reload to update status
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save credentials' });
      }

    } catch (error) {
      console.error('Save station credentials error:', error);
      setMessage({ type: 'error', text: 'Failed to save credentials' });
    } finally {
      setSaving(false);
    }
  };

  const testCredentials = async (username: string, password: string) => {
    if (!username || !password) {
      setMessage({ type: 'error', text: 'Both username and password are required for testing' });
      return;
    }

    try {
      setTesting(true);
      setMessage(null);

      const response = await fetch('/api/lotw/credentials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ 
          type: data.valid ? 'success' : 'error', 
          text: data.message 
        });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to test credentials' });
      }

    } catch (error) {
      console.error('Test credentials error:', error);
      setMessage({ type: 'error', text: 'Failed to test credentials' });
    } finally {
      setTesting(false);
    }
  };

  const removeCredentials = async (stationId?: number) => {
    try {
      setSaving(true);
      setMessage(null);

      const url = stationId ? `/api/lotw/credentials?station_id=${stationId}` : '/api/lotw/credentials';
      const response = await fetch(url, { method: 'DELETE' });
      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message });
        await loadCredentials(); // Reload to update status
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to remove credentials' });
      }

    } catch (error) {
      console.error('Remove credentials error:', error);
      setMessage({ type: 'error', text: 'Failed to remove credentials' });
    } finally {
      setSaving(false);
    }
  };

  const togglePasswordVisibility = (key: string) => {
    setShowPasswords(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="mr-2 h-5 w-5" />
            LoTW Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading LoTW settings...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Settings className="mr-2 h-5 w-5" />
          LoTW Integration
        </CardTitle>
        <CardDescription>
          Configure Logbook of The World credentials for uploading QSOs and downloading confirmations
        </CardDescription>
      </CardHeader>
      <CardContent>
        {message && (
          <Alert variant={message.type === 'error' ? 'destructive' : 'default'} className="mb-6">
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="user" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="user">User Credentials</TabsTrigger>
            <TabsTrigger value="stations">Station Credentials</TabsTrigger>
          </TabsList>

          <TabsContent value="user" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Default LoTW Credentials</h3>
                  <p className="text-sm text-muted-foreground">
                    These credentials will be used for all stations that don&apos;t have specific credentials configured.
                  </p>
                </div>
                {userCredentials.lotw_username && (
                  <Badge variant="secondary" className="flex items-center">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Configured
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="user-username">LoTW Username</Label>
                  <Input
                    id="user-username"
                    type="text"
                    value={userForm.username}
                    onChange={(e) => setUserForm(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="Your LoTW username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-password">LoTW Password</Label>
                  <div className="relative">
                    <Input
                      id="user-password"
                      type={showPasswords['user'] ? 'text' : 'password'}
                      value={userForm.password}
                      onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                      placeholder={userCredentials.has_password ? 'Password is configured' : 'Your LoTW password'}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => togglePasswordVisibility('user')}
                    >
                      {showPasswords['user'] ? (
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
                  onClick={saveUserCredentials}
                  disabled={saving || !userForm.username || !userForm.password}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Save Credentials
                </Button>

                <Button
                  variant="outline"
                  onClick={() => testCredentials(userForm.username, userForm.password)}
                  disabled={testing || !userForm.username || !userForm.password}
                >
                  {testing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Test Connection
                </Button>

                {userCredentials.lotw_username && (
                  <Button
                    variant="destructive"
                    onClick={() => removeCredentials()}
                    disabled={saving}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Remove Credentials
                  </Button>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="stations" className="space-y-6">
            {stations.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No stations configured. Please add a station first.</p>
              </div>
            ) : (
              stations.map((station) => {
                const stationCreds = stationCredentials[station.id];
                const stationForm = stationForms[station.id] || { username: '', password: '' };

                return (
                  <div key={station.id} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium flex items-center">
                          {station.callsign}
                          {station.is_default && (
                            <Badge variant="outline" className="ml-2">Default</Badge>
                          )}
                        </h3>
                        <p className="text-sm text-muted-foreground">{station.station_name}</p>
                      </div>
                      {stationCreds?.lotw_username && (
                        <Badge variant="secondary" className="flex items-center">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Configured
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`station-${station.id}-username`}>LoTW Username</Label>
                        <Input
                          id={`station-${station.id}-username`}
                          type="text"
                          value={stationForm.username}
                          onChange={(e) => setStationForms(prev => ({
                            ...prev,
                            [station.id]: { ...prev[station.id], username: e.target.value }
                          }))}
                          placeholder="LoTW username for this station"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`station-${station.id}-password`}>LoTW Password</Label>
                        <div className="relative">
                          <Input
                            id={`station-${station.id}-password`}
                            type={showPasswords[`station-${station.id}`] ? 'text' : 'password'}
                            value={stationForm.password}
                            onChange={(e) => setStationForms(prev => ({
                              ...prev,
                              [station.id]: { ...prev[station.id], password: e.target.value }
                            }))}
                            placeholder={stationCreds?.has_password ? 'Password is configured' : 'LoTW password'}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => togglePasswordVisibility(`station-${station.id}`)}
                          >
                            {showPasswords[`station-${station.id}`] ? (
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
                        onClick={() => saveStationCredentials(station.id)}
                        disabled={saving || !stationForm.username || !stationForm.password}
                        size="sm"
                      >
                        {saving ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Save
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testCredentials(stationForm.username, stationForm.password)}
                        disabled={testing || !stationForm.username || !stationForm.password}
                      >
                        {testing ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-2" />
                        )}
                        Test
                      </Button>

                      {stationCreds?.lotw_username && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeCredentials(station.id)}
                          disabled={saving}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>
        </Tabs>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h4 className="font-medium mb-2">About LoTW Integration</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Use your ARRL LoTW website username and password</li>
            <li>• Passwords are encrypted and stored securely</li>
            <li>• Station-specific credentials override user-level credentials</li>
            <li>• You&apos;ll also need to upload a .p12 certificate for each station to enable uploads</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}