'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, User, Key, MapPin } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { useUser } from '@/contexts/UserContext';

interface User {
  id: number;
  email: string;
  name: string;
  callsign?: string;
  grid_locator?: string;
  qrz_username?: string;
  qrz_password?: string;
}

export default function ProfilePage() {
  const [, setUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    callsign: '',
    grid_locator: '',
    qrz_username: '',
    qrz_password: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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
          qrz_password: data.user.qrz_password || ''
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

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
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
                    <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-4">
                      <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                        QRZ.com Account Required:
                      </h4>
                      <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                        <li>You need a valid QRZ.com account to use callsign lookup</li>
                        <li>Enter your QRZ.com username and password above</li>
                        <li>This enables automatic lookup of callsign information when adding contacts</li>
                        <li>Your credentials are stored securely and only used for lookups</li>
                      </ul>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-2">
                        <strong>Note:</strong> QRZ.com subscription may be required for full XML API access.
                      </p>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="bg-destructive/15 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-3 rounded-md text-sm">
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
        </div>
      </main>
    </div>
  );
}