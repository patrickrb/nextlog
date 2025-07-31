'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Key, 
  Plus, 
  Eye, 
  EyeOff, 
  Copy, 
  Trash2, 
  Calendar, 
  Activity,
  CheckCircle
} from 'lucide-react';
// Utility function to format date distance
const formatDistanceToNow = (date: Date, options?: { addSuffix?: boolean }) => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ${options?.addSuffix ? 'ago' : ''}`.trim();
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ${options?.addSuffix ? 'ago' : ''}`.trim();
  } else if (diffMinutes > 0) {
    return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ${options?.addSuffix ? 'ago' : ''}`.trim();
  } else {
    return options?.addSuffix ? 'just now' : 'now';
  }
};

interface ApiKey {
  id: number;
  key_name: string;
  api_key: string;
  is_enabled: boolean;
  read_only: boolean;
  rate_limit_per_hour: number;
  last_used_at?: string;
  total_requests: number;
  created_at: string;
  expires_at?: string;
}


interface NewApiKeyForm {
  key_name: string;
  read_only: boolean;
  rate_limit_per_hour: number;
  expires_in_days?: number;
}

export default function ApiKeyManager({ stationId }: { stationId: number }) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<ApiKey | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<number>>(new Set());
  const [newKeyData, setNewKeyData] = useState<{ key: string } | null>(null);
  const [error, setError] = useState<string>('');
  
  const [newKeyForm, setNewKeyForm] = useState<NewApiKeyForm>({
    key_name: '',
    read_only: false,
    rate_limit_per_hour: 1000,
    expires_in_days: undefined
  });

  const fetchApiKeys = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/stations/${stationId}/api-keys`);
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data.api_keys || []);
      } else {
        setError('Failed to load API keys');
      }
    } catch {
      setError('Network error loading API keys');
    } finally {
      setLoading(false);
    }
  }, [stationId]);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  const handleCreateApiKey = async () => {
    if (!newKeyForm.key_name.trim()) {
      setError('API key name is required');
      return;
    }

    try {
      setCreating(true);
      setError('');
      
      const requestData = {
        key_name: newKeyForm.key_name.trim(),
        read_only: newKeyForm.read_only,
        rate_limit_per_hour: newKeyForm.rate_limit_per_hour,
        expires_in_days: newKeyForm.expires_in_days || null
      };

      const response = await fetch(`/api/stations/${stationId}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      const data = await response.json();

      if (response.ok) {
        setNewKeyData({
          key: data.api_key
        });
        setNewKeyForm({
          key_name: '',
          read_only: false,
          rate_limit_per_hour: 1000,
          expires_in_days: undefined
        });
        setShowCreateDialog(false);
        fetchApiKeys(); // Refresh the list
      } else {
        setError(data.error || 'Failed to create API key');
      }
    } catch {
      setError('Network error creating API key');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleEnabled = async (keyId: number, enabled: boolean) => {
    try {
      const response = await fetch(`/api/stations/${stationId}/api-keys/${keyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled: enabled })
      });

      if (response.ok) {
        fetchApiKeys(); // Refresh the list
      } else {
        setError('Failed to update API key');
      }
    } catch {
      setError('Network error updating API key');
    }
  };

  const handleDeleteApiKey = async () => {
    if (!keyToDelete) return;

    try {
      const response = await fetch(`/api/stations/${stationId}/api-keys/${keyToDelete.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchApiKeys(); // Refresh the list
        setShowDeleteDialog(false);
        setKeyToDelete(null);
      } else {
        setError('Failed to delete API key');
      }
    } catch {
      setError('Network error deleting API key');
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  const toggleKeyVisibility = (keyId: number) => {
    const newVisible = new Set(visibleKeys);
    if (newVisible.has(keyId)) {
      newVisible.delete(keyId);
    } else {
      newVisible.add(keyId);
    }
    setVisibleKeys(newVisible);
  };

  const formatApiKey = (key: string, visible: boolean) => {
    if (visible) return key;
    const prefix = key.substring(0, 12); // "nextlog_" + 4 chars
    const suffix = key.substring(key.length - 4);
    return `${prefix}${'*'.repeat(key.length - 16)}${suffix}`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Key className="h-5 w-5 mr-2" />
            API Key Management
          </CardTitle>
          <CardDescription>Loading API keys...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Key className="h-5 w-5 mr-2" />
              API Key Management
            </div>
            <Button type="button" onClick={() => setShowCreateDialog(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Create API Key
            </Button>
          </CardTitle>
          <CardDescription>
            Manage API keys for Cloudlog compatibility and third-party integrations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-destructive/15 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {apiKeys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No API keys created</p>
              <p className="text-sm mb-4">Create your first API key to enable third-party integrations</p>
              <Button type="button" onClick={() => setShowCreateDialog(true)} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Create First API Key
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((apiKey) => (
                <div key={apiKey.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <h4 className="font-medium">{apiKey.key_name}</h4>
                      <div className="flex items-center space-x-2">
                        <Badge variant={apiKey.is_enabled ? "default" : "secondary"}>
                          {apiKey.is_enabled ? "Enabled" : "Disabled"}
                        </Badge>
                        {apiKey.read_only && (
                          <Badge variant="outline">Read Only</Badge>
                        )}
                        {apiKey.expires_at && (
                          <Badge variant="destructive">
                            <Calendar className="h-3 w-3 mr-1" />
                            Expires {formatDistanceToNow(new Date(apiKey.expires_at), { addSuffix: true })}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={apiKey.is_enabled}
                        onCheckedChange={(checked) => handleToggleEnabled(apiKey.id, checked)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setKeyToDelete(apiKey);
                          setShowDeleteDialog(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Label className="text-xs font-medium text-muted-foreground">API Key:</Label>
                      <code className="flex-1 px-2 py-1 bg-muted rounded text-sm font-mono">
                        {formatApiKey(apiKey.api_key, visibleKeys.has(apiKey.id))}
                      </code>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleKeyVisibility(apiKey.id)}
                      >
                        {visibleKeys.has(apiKey.id) ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(apiKey.api_key)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        <Activity className="h-3 w-3" />
                        <span>{apiKey.total_requests} requests</span>
                      </div>
                      <div>Rate limit: {apiKey.rate_limit_per_hour}/hour</div>
                    </div>
                    <div>
                      {apiKey.last_used_at ? (
                        `Last used ${formatDistanceToNow(new Date(apiKey.last_used_at), { addSuffix: true })}`
                      ) : (
                        "Never used"
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create API Key Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New API Key</DialogTitle>
            <DialogDescription>
              Generate a new API key for third-party integrations with your station
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key_name">Key Name *</Label>
              <Input
                id="key_name"
                value={newKeyForm.key_name}
                onChange={(e) => setNewKeyForm(prev => ({ ...prev, key_name: e.target.value }))}
                placeholder="e.g., Ham Radio Deluxe, N1MM Logger+"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="read_only"
                checked={newKeyForm.read_only}
                onCheckedChange={(checked) => setNewKeyForm(prev => ({ ...prev, read_only: checked }))}
              />
              <Label htmlFor="read_only">Read-only access</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rate_limit">Rate Limit (requests per hour)</Label>
              <Input
                id="rate_limit"
                type="number"
                min="1"
                max="10000"
                value={newKeyForm.rate_limit_per_hour}
                onChange={(e) => setNewKeyForm(prev => ({ ...prev, rate_limit_per_hour: parseInt(e.target.value) || 1000 }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expires_in">Expires in (days, optional)</Label>
              <Input
                id="expires_in"
                type="number"
                min="1"
                max="3650"
                value={newKeyForm.expires_in_days || ''}
                onChange={(e) => setNewKeyForm(prev => ({ ...prev, expires_in_days: e.target.value ? parseInt(e.target.value) : undefined }))}
                placeholder="Leave empty for no expiration"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateApiKey} disabled={creating}>
              {creating ? "Creating..." : "Create API Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New API Key Display Dialog */}
      {newKeyData && (
        <Dialog open={true} onOpenChange={() => setNewKeyData(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
                API Key Created Successfully
              </DialogTitle>
              <DialogDescription>
                <CheckCircle className="h-4 w-4 inline mr-2 text-green-500" />
                Your Cloudlog-compatible API key has been created successfully!
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>API Key</Label>
                <div className="flex items-center space-x-2">
                  <code className="flex-1 px-3 py-2 bg-muted rounded text-sm font-mono break-all">
                    {newKeyData.key}
                  </code>
                  <Button type="button" variant="ghost" size="sm" onClick={() => copyToClipboard(newKeyData.key)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Cloudlog Compatible:</strong> This API key works with any software that supports Cloudlog&apos;s API format. Use it in the X-API-Key header or api_key parameter.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setNewKeyData(null)}>
                Got it!
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the API key &quot;{keyToDelete?.key_name}&quot;? 
              This action cannot be undone and will immediately disable any applications using this key.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteApiKey} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete API Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}