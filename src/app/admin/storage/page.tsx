'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Database, Eye, EyeOff, Trash2, Edit } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface StorageConfig {
  id: number;
  config_type: string;
  account_name: string;
  account_key: string;
  container_name: string;
  endpoint_url: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
  created_by_name: string;
}

export default function StorageConfigPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [configs, setConfigs] = useState<StorageConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editingConfig, setEditingConfig] = useState<StorageConfig | null>(null);
  
  // Form state for new/edit config
  const [formData, setFormData] = useState({
    config_type: 'azure_blob',
    account_name: '',
    account_key: '',
    container_name: '',
    endpoint_url: '',
    is_enabled: false
  });

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
      fetchConfigs();
    }
  }, [user, loading, router]);

  const fetchConfigs = async () => {
    try {
      setError('');
      const response = await fetch('/api/admin/storage');
      const data = await response.json();
      
      if (response.ok) {
        setConfigs(data.configs || []);
      } else {
        setError(data.error || 'Failed to fetch storage configurations');
      }
    } catch {
      setError('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const isEditing = editingConfig !== null;
      const method = isEditing ? 'PUT' : 'POST';
      const bodyData = isEditing ? { ...formData, id: editingConfig.id } : formData;
      
      const response = await fetch('/api/admin/storage', {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyData),
      });

      const data = await response.json();
      
      if (response.ok) {
        setSuccess(`Storage configuration ${isEditing ? 'updated' : 'created'} successfully!`);
        handleCancelForm();
        fetchConfigs();
      } else {
        setError(data.error || `Failed to ${isEditing ? 'update' : 'create'} storage configuration`);
      }
    } catch {
      setError('Network error occurred');
    }
  };

  const handleEditConfig = (config: StorageConfig) => {
    setEditingConfig(config);
    setFormData({
      config_type: config.config_type,
      account_name: config.account_name,
      account_key: '', // Don't pre-fill encrypted key
      container_name: config.container_name,
      endpoint_url: config.endpoint_url || '',
      is_enabled: config.is_enabled
    });
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingConfig(null);
    setFormData({
      config_type: 'azure_blob',
      account_name: '',
      account_key: '',
      container_name: '',
      endpoint_url: '',
      is_enabled: false
    });
  };

  const handleToggleEnabled = async (configId: number, currentEnabled: boolean) => {
    try {
      setError('');
      const response = await fetch('/api/admin/storage', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: configId,
          is_enabled: !currentEnabled
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setSuccess(`Storage configuration ${!currentEnabled ? 'enabled' : 'disabled'} successfully!`);
        fetchConfigs();
      } else {
        setError(data.error || 'Failed to update storage configuration');
      }
    } catch {
      setError('Network error occurred');
    }
  };

  const handleDelete = async (configId: number) => {
    if (!confirm('Are you sure you want to delete this storage configuration?')) {
      return;
    }

    try {
      setError('');
      const response = await fetch(`/api/admin/storage?id=${configId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (response.ok) {
        setSuccess('Storage configuration deleted successfully!');
        fetchConfigs();
      } else {
        setError(data.error || 'Failed to delete storage configuration');
      }
    } catch {
      setError('Network error occurred');
    }
  };

  if (loading || !isAuthorized) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar title="Storage Configuration" breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Storage' }]} />
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar 
        title="Storage Configuration" 
        breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Storage' }]}
        actions={
          <Button onClick={() => showForm ? handleCancelForm() : setShowForm(true)}>
            {showForm ? 'Cancel' : 'Add Configuration'}
          </Button>
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

        {showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{editingConfig ? 'Edit Storage Configuration' : 'Add Storage Configuration'}</CardTitle>
              <CardDescription>
                Configure Azure Blob Storage for file uploads and backups
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="account_name">Storage Account Name *</Label>
                    <Input
                      id="account_name"
                      value={formData.account_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, account_name: e.target.value }))}
                      placeholder="mystorageaccount"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="container_name">Container Name *</Label>
                    <Input
                      id="container_name"
                      value={formData.container_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, container_name: e.target.value }))}
                      placeholder="nodelog-files"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="account_key">Account Key {editingConfig ? '(leave empty to keep current)' : '*'}</Label>
                  <div className="relative">
                    <Input
                      id="account_key"
                      type={showPassword ? "text" : "password"}
                      value={formData.account_key}
                      onChange={(e) => setFormData(prev => ({ ...prev, account_key: e.target.value }))}
                      placeholder={editingConfig ? "Leave empty to keep current key" : "Enter your Azure storage account key"}
                      required={!editingConfig}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="endpoint_url">Custom Endpoint (Optional)</Label>
                  <Input
                    id="endpoint_url"
                    value={formData.endpoint_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, endpoint_url: e.target.value }))}
                    placeholder="https://mystorageaccount.blob.core.windows.net"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_enabled"
                    checked={formData.is_enabled}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_enabled: checked }))}
                  />
                  <Label htmlFor="is_enabled">Enable this configuration</Label>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={handleCancelForm}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingConfig ? 'Update Configuration' : 'Create Configuration'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Current Configurations</h2>
          
          {isLoading ? (
            <div className="text-center py-8">Loading configurations...</div>
          ) : configs.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Database className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No storage configurations</h3>
                <p className="text-muted-foreground mb-4">
                  Add your first storage configuration to enable file uploads and backups.
                </p>
                <Button onClick={() => setShowForm(true)}>
                  Add Configuration
                </Button>
              </CardContent>
            </Card>
          ) : (
            configs.map((config) => (
              <Card key={config.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center">
                        <Database className="mr-2 h-5 w-5" />
                        {config.config_type.replace('_', ' ').toUpperCase()}
                      </CardTitle>
                      <CardDescription>
                        Account: {config.account_name} | Container: {config.container_name}
                      </CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={config.is_enabled ? "default" : "secondary"}>
                        {config.is_enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Account Name:</p>
                      <p className="font-medium">{config.account_name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Container:</p>
                      <p className="font-medium">{config.container_name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Account Key:</p>
                      <p className="font-medium">{config.account_key}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Created By:</p>
                      <p className="font-medium">{config.created_by_name || 'Unknown'}</p>
                    </div>
                    {config.endpoint_url && (
                      <div className="md:col-span-2">
                        <p className="text-muted-foreground">Custom Endpoint:</p>
                        <p className="font-medium break-all">{config.endpoint_url}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-end space-x-2 mt-4 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditConfig(config)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleToggleEnabled(config.id, config.is_enabled)}
                    >
                      {config.is_enabled ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(config.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}