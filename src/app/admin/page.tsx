'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Database, FileText, Settings, Radio, Globe, Upload, Download, RefreshCw, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboard() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [qrzSyncing, setQrzSyncing] = useState(false);
  const [qrzDownloading, setQrzDownloading] = useState(false);
  const [lotwUploading, setLotwUploading] = useState(false);
  const [lotwDownloading, setLotwDownloading] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleBulkQrzSync = async () => {
    try {
      setQrzSyncing(true);
      setSyncMessage(null);

      // First, get all contacts not sent to QRZ
      const response = await fetch('/api/contacts?qrz_sync_status=not_synced');
      if (!response.ok) {
        throw new Error('Failed to fetch contacts');
      }

      const data = await response.json();
      const unsentContacts = data.contacts;

      if (!unsentContacts || unsentContacts.length === 0) {
        setSyncMessage({ type: 'success', text: 'No contacts need to be sent to QRZ' });
        return;
      }

      // Get all contact IDs
      const contactIds = unsentContacts.map((c: { id: number }) => c.id);

      // Sync to QRZ
      const syncResponse = await fetch('/api/contacts/qrz-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactIds })
      });

      const syncResult = await syncResponse.json();

      if (syncResponse.ok) {
        const { successful, failed, skipped, already_existed } = syncResult.summary;
        let message = `QRZ upload completed: ${successful} sent to QRZ`;
        
        if (already_existed > 0) {
          message += `, ${already_existed} already existed in QRZ (marked as sent)`;
        }
        if (skipped > 0) {
          message += `, ${skipped} skipped (already sent)`;
        }
        if (failed > 0) {
          message += `, ${failed} failed`;
        }
        
        setSyncMessage({ 
          type: failed > 0 ? 'error' : 'success', 
          text: message
        });
      } else {
        setSyncMessage({ type: 'error', text: syncResult.error || 'Upload failed' });
      }

    } catch (error) {
      console.error('Bulk QRZ sync error:', error);
      setSyncMessage({ type: 'error', text: 'Failed to sync contacts' });
    } finally {
      setQrzSyncing(false);
    }
  };

  const handleBulkQrzDownload = async () => {
    try {
      setQrzDownloading(true);
      setSyncMessage(null);

      // Download confirmations from QRZ
      const downloadResponse = await fetch('/api/contacts/qrz-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) // Download for all stations
      });

      const downloadResult = await downloadResponse.json();

      if (downloadResponse.ok) {
        const { successful, failed, totalQsosDownloaded, totalConfirmations } = downloadResult.summary;
        let message = `QRZ download completed: ${totalConfirmations} confirmations found`;
        
        if (totalQsosDownloaded > 0) {
          message += ` from ${totalQsosDownloaded} QSOs downloaded`;
        }
        if (successful > 0) {
          message += ` across ${successful} stations`;
        }
        if (failed > 0) {
          message += `, ${failed} stations failed`;
        }
        
        setSyncMessage({ 
          type: failed > 0 ? 'error' : 'success', 
          text: message
        });
      } else {
        setSyncMessage({ type: 'error', text: downloadResult.error || 'Download failed' });
      }

    } catch (error) {
      console.error('Bulk QRZ download error:', error);
      setSyncMessage({ type: 'error', text: 'Failed to download confirmations from QRZ' });
    } finally {
      setQrzDownloading(false);
    }
  };

  const handleBulkLotwUpload = async () => {
    setLotwUploading(true);
    setSyncMessage(null);
    
    try {
      // TODO: Implement bulk LoTW upload
      setSyncMessage({ type: 'error', text: 'LoTW bulk upload functionality coming soon!' });
    } finally {
      setLotwUploading(false);
    }
  };

  const handleBulkLotwDownload = async () => {
    setLotwDownloading(true);
    setSyncMessage(null);
    
    try {
      // TODO: Implement bulk LoTW download
      setSyncMessage({ type: 'error', text: 'LoTW bulk download functionality coming soon!' });
    } finally {
      setLotwDownloading(false);
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
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar title="Admin Panel" />
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar title="Admin Panel" />
      
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Manage users, configure storage, and monitor system activity.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* User Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="mr-2 h-5 w-5" />
                User Management
              </CardTitle>
              <CardDescription>
                Manage user accounts, roles, and permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button asChild className="w-full justify-start">
                  <Link href="/admin/users">
                    <Users className="mr-2 h-4 w-4" />
                    Manage Users
                  </Link>
                </Button>
                <p className="text-sm text-muted-foreground">
                  View, create, edit, and manage user accounts and their roles.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Storage Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="mr-2 h-5 w-5" />
                Storage Configuration
              </CardTitle>
              <CardDescription>
                Configure Azure Blob Storage and other storage options
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button asChild className="w-full justify-start" variant="outline">
                  <Link href="/admin/storage">
                    <Settings className="mr-2 h-4 w-4" />
                    Storage Settings
                  </Link>
                </Button>
                <p className="text-sm text-muted-foreground">
                  Set up and manage cloud storage configurations.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* System Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="mr-2 h-5 w-5" />
                System Settings
              </CardTitle>
              <CardDescription>
                Configure application limits and behavior
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button asChild className="w-full justify-start" variant="outline">
                  <Link href="/admin/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Configure Settings
                  </Link>
                </Button>
                <p className="text-sm text-muted-foreground">
                  Manage ADIF import limits, timeouts, and system preferences.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Audit Logs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="mr-2 h-5 w-5" />
                Audit Logs
              </CardTitle>
              <CardDescription>
                View system activity and admin actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button asChild className="w-full justify-start" variant="outline">
                  <Link href="/admin/audit">
                    <FileText className="mr-2 h-4 w-4" />
                    View Audit Logs
                  </Link>
                </Button>
                <p className="text-sm text-muted-foreground">
                  Monitor all administrative actions and system changes.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* System Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="mr-2 h-5 w-5" />
                System Information
              </CardTitle>
              <CardDescription>
                System status and configuration details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Your Role:</span>
                  <span className="font-medium capitalize">{user?.role}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-medium capitalize text-green-600">{user?.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Admin Since:</span>
                  <span className="font-medium">Today</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Integration Management */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Radio className="mr-2 h-5 w-5" />
                Integration Management
              </CardTitle>
              <CardDescription>
                Manage LoTW and QRZ.com synchronization for all users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {/* LoTW Sync Section */}
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center">
                    <Globe className="mr-2 h-4 w-4" />
                    LoTW Synchronization
                  </h4>
                  <div className="space-y-2">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={handleBulkLotwUpload}
                      disabled={lotwUploading || qrzSyncing || lotwDownloading}
                    >
                      {lotwUploading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      {lotwUploading ? 'Uploading...' : 'Bulk Upload to LoTW'}
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={handleBulkLotwDownload}
                      disabled={lotwUploading || qrzSyncing || lotwDownloading}
                    >
                      {lotwDownloading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-4 w-4" />
                      )}
                      {lotwDownloading ? 'Downloading...' : 'Bulk Download from LoTW'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Upload QSOs to LoTW or download confirmations for all configured stations
                  </p>
                </div>

                {/* QRZ Sync Section */}
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center">
                    <Radio className="mr-2 h-4 w-4" />
                    QRZ.com Synchronization
                  </h4>
                  <div className="space-y-2">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={handleBulkQrzSync}
                      disabled={lotwUploading || qrzSyncing || qrzDownloading || lotwDownloading}
                    >
                      {qrzSyncing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      {qrzSyncing ? 'Uploading...' : 'Bulk Upload to QRZ'}
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={handleBulkQrzDownload}
                      disabled={lotwUploading || qrzSyncing || qrzDownloading || lotwDownloading}
                    >
                      {qrzDownloading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-4 w-4" />
                      )}
                      {qrzDownloading ? 'Downloading...' : 'Download QRZ Confirmations'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Upload QSOs to QRZ.com logbook and download QSL confirmations for all users with configured API keys
                  </p>
                </div>
              </div>

              {/* Sync Statistics */}
              <div className="mt-6 pt-4 border-t">
                <h4 className="font-medium mb-3">Sync Statistics</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">--</div>
                    <div className="text-xs text-muted-foreground">LoTW Pending</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">--</div>
                    <div className="text-xs text-muted-foreground">LoTW Synced</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">--</div>
                    <div className="text-xs text-muted-foreground">QRZ Pending</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">--</div>
                    <div className="text-xs text-muted-foreground">QRZ Synced</div>
                  </div>
                </div>
              </div>

              {/* Sync Message */}
              {syncMessage && (
                <div className={`mt-4 p-3 rounded-md ${
                  syncMessage.type === 'success' 
                    ? 'bg-green-50 text-green-700 border border-green-200' 
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {syncMessage.text}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 p-4 bg-card rounded-lg border border-border">
          <h3 className="font-semibold text-card-foreground mb-2">
            🔐 Admin Access Granted
          </h3>
          <p className="text-muted-foreground text-sm">
            You have full administrative access to Nextlog. Use these tools responsibly to manage 
            users, configure system settings, and monitor activity. All admin actions are logged 
            for security and auditing purposes.
          </p>
        </div>
      </div>
    </div>
  );
}