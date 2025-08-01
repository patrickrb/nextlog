'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, CheckCircle, Settings, Save, RotateCcw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SystemSetting {
  id: number;
  setting_key: string;
  setting_value: string;
  data_type: 'string' | 'number' | 'boolean' | 'json';
  category: string;
  description?: string;
  is_public: boolean;
}

interface SettingsByCategory {
  [category: string]: SystemSetting[];
}

export default function AdminSettingsPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [settings, setSettings] = useState<SettingsByCategory>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [modifiedSettings, setModifiedSettings] = useState<Record<string, string>>({});

  const fetchSettings = async () => {
    try {
      setError('');
      const response = await fetch('/api/admin/settings');
      const data = await response.json();
      
      if (response.ok) {
        // Group settings by category
        const grouped = data.settings.reduce((acc: SettingsByCategory, setting: SystemSetting) => {
          if (!acc[setting.category]) {
            acc[setting.category] = [];
          }
          acc[setting.category].push(setting);
          return acc;
        }, {});
        
        setSettings(grouped);
        setModifiedSettings({});
      } else {
        setError(data.error || 'Failed to fetch settings');
      }
    } catch {
      setError('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
        return;
      }
      
      if (user.role !== 'admin') {
        router.push('/dashboard');
        return;
      }
      
      setIsAuthorized(true);
      fetchSettings();
    }
  }, [user, loading, router]);

  const handleSettingChange = (key: string, value: string) => {
    setModifiedSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveSettings = async () => {
    if (Object.keys(modifiedSettings).length === 0) {
      setError('No changes to save');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ settings: modifiedSettings }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Updated ${Object.keys(modifiedSettings).length} settings successfully`);
        setModifiedSettings({});
        await fetchSettings(); // Refresh to get updated values
      } else {
        setError(data.error || 'Failed to update settings');
      }
    } catch {
      setError('Network error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleResetCategory = (category: string) => {
    const categorySettings = settings[category] || [];
    const resetSettings = { ...modifiedSettings };
    
    categorySettings.forEach(setting => {
      delete resetSettings[setting.setting_key];
    });
    
    setModifiedSettings(resetSettings);
  };

  const getSettingValue = (setting: SystemSetting): string => {
    return modifiedSettings[setting.setting_key] ?? setting.setting_value;
  };

  const renderSettingInput = (setting: SystemSetting) => {
    const value = getSettingValue(setting);
    const isModified = setting.setting_key in modifiedSettings;

    switch (setting.data_type) {
      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Switch
              checked={value === 'true'}
              onCheckedChange={(checked) => 
                handleSettingChange(setting.setting_key, checked.toString())
              }
            />
            <span className="text-sm">{value === 'true' ? 'Enabled' : 'Disabled'}</span>
          </div>
        );
      
      case 'number':
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => handleSettingChange(setting.setting_key, e.target.value)}
            className={isModified ? 'border-orange-300' : ''}
          />
        );
      
      case 'string':
      default:
        return (
          <Input
            type="text"
            value={value}
            onChange={(e) => handleSettingChange(setting.setting_key, e.target.value)}
            className={isModified ? 'border-orange-300' : ''}
          />
        );
    }
  };

  const categoryTitles = {
    import: 'Import Settings',
    general: 'General Settings', 
    auth: 'Authentication',
    limits: 'User Limits',
    ui: 'User Interface'
  };

  const categoryDescriptions = {
    import: 'Configure ADIF import limits and processing settings',
    general: 'Basic application configuration',
    auth: 'User authentication and registration settings',
    limits: 'Resource and usage limits',
    ui: 'User interface defaults and preferences'
  };

  if (loading || !isAuthorized) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar title="System Settings" breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Settings' }]} />
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  const hasModifications = Object.keys(modifiedSettings).length > 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar 
        title="System Settings" 
        breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Settings' }]}
        actions={
          <div className="flex space-x-2">
            {hasModifications && (
              <Button 
                variant="outline" 
                onClick={() => setModifiedSettings({})}
                disabled={saving}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset Changes
              </Button>
            )}
            <Button onClick={handleSaveSettings} disabled={!hasModifications || saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        }
      />
      
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {error && (
          <Alert className="mb-6 border-destructive/20 bg-destructive/10">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-destructive">{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-200">{success}</AlertDescription>
          </Alert>
        )}

        {hasModifications && (
          <Alert className="mb-6 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
            <Settings className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            <AlertDescription className="text-orange-800 dark:text-orange-200">
              You have unsaved changes. Click &quot;Save Changes&quot; to apply them.
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="text-center py-8">Loading settings...</div>
        ) : Object.keys(settings).length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No settings found. Make sure the system_settings table exists and contains data.</p>
          </div>
        ) : (
          <Tabs defaultValue={Object.keys(settings)[0]} className="space-y-6">
            <TabsList className={`grid w-full grid-cols-${Math.min(Object.keys(settings).length, 5)}`}>
              {Object.keys(settings).map((category) => (
                <TabsTrigger key={category} value={category} className="capitalize">
                  {categoryTitles[category as keyof typeof categoryTitles] || category}
                </TabsTrigger>
              ))}
            </TabsList>

            {Object.entries(settings).map(([category, categorySettings]) => (
              <TabsContent key={category} value={category}>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center">
                          <Settings className="mr-2 h-5 w-5" />
                          {categoryTitles[category as keyof typeof categoryTitles] || category}
                        </CardTitle>
                        <CardDescription>
                          {categoryDescriptions[category as keyof typeof categoryDescriptions] || 
                           `Configure ${category} settings`}
                        </CardDescription>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleResetCategory(category)}
                        disabled={!categorySettings.some(s => s.setting_key in modifiedSettings)}
                      >
                        Reset Category
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {categorySettings.map((setting) => {
                        const isModified = setting.setting_key in modifiedSettings;
                        return (
                          <div key={setting.setting_key} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label htmlFor={setting.setting_key} className="flex items-center space-x-2">
                                <span>{setting.setting_key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                                {isModified && (
                                  <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                                    Modified
                                  </span>
                                )}
                              </Label>
                              <span className="text-xs text-muted-foreground">
                                {setting.data_type}
                              </span>
                            </div>
                            {renderSettingInput(setting)}
                            {setting.description && (
                              <p className="text-sm text-muted-foreground">
                                {setting.description}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </div>
  );
}