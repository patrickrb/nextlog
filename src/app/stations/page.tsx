'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Star, StarOff, Radio, BarChart3 } from 'lucide-react';
import Navbar from '@/components/Navbar';

interface Station {
  id: number;
  callsign: string;
  station_name: string;
  operator_name?: string;
  qth_name?: string;
  grid_locator?: string;
  power_watts?: number;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
}

interface StationStats {
  totalContacts: number;
  countries: number;
  modes: number;
  bands: number;
}

export default function StationsPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [stationStats, setStationStats] = useState<Record<number, StationStats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  const fetchStations = async () => {
    try {
      const response = await fetch('/api/stations');
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      
      const data = await response.json();
      if (response.ok) {
        setStations(data.stations || []);
        // Fetch stats for each station
        data.stations?.forEach((station: Station) => {
          fetchStationStats(station.id);
        });
      } else {
        setError(data.error || 'Failed to fetch stations');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchStationStats = async (stationId: number) => {
    try {
      const response = await fetch(`/api/stations/${stationId}/stats`);
      if (response.ok) {
        const stats = await response.json();
        setStationStats(prev => ({ ...prev, [stationId]: stats }));
      }
    } catch {
      // Silent error handling for stats
    }
  };

  const handleSetDefault = async (stationId: number) => {
    try {
      const response = await fetch(`/api/stations/${stationId}/set-default`, {
        method: 'POST',
      });
      
      if (response.ok) {
        // Update local state
        setStations(prev => prev.map(station => ({
          ...station,
          is_default: station.id === stationId
        })));
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to set default station');
      }
    } catch {
      setError('Network error. Please try again.');
    }
  };

  const handleDelete = async (stationId: number) => {
    if (!confirm('Are you sure you want to delete this station? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/stations/${stationId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setStations(prev => prev.filter(station => station.id !== stationId));
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete station');
      }
    } catch {
      setError('Network error. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center space-x-2">
          <Radio className="h-6 w-6 animate-spin" />
          <span className="text-lg">Loading stations...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar 
        title="Station Logbooks"
        actions={
          <Button asChild>
            <Link href="/stations/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Station
            </Link>
          </Button>
        }
      />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 space-y-6">
          {error && (
            <div className="bg-destructive/15 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Your Station Logbooks</CardTitle>
              <CardDescription>
                Manage your amateur radio station configurations and logbooks. Each station can have its own settings and contact log.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stations.length === 0 ? (
                <div className="text-center py-8">
                  <Radio className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">No stations configured</p>
                  <p className="text-muted-foreground mb-4">
                    Get started by adding your first station location.
                  </p>
                  <Button asChild>
                    <Link href="/stations/new">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Station
                    </Link>
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Station</TableHead>
                      <TableHead>Callsign</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Grid</TableHead>
                      <TableHead>Power</TableHead>
                      <TableHead>Contacts</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stations.map((station) => {
                      const stats = stationStats[station.id];
                      return (
                        <TableRow key={station.id}>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              {station.is_default && (
                                <Star className="h-4 w-4 text-yellow-500 fill-current" />
                              )}
                              <div>
                                <div className="font-medium">{station.station_name}</div>
                                {station.operator_name && (
                                  <div className="text-sm text-muted-foreground">
                                    Op: {station.operator_name}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono font-medium">
                            {station.callsign}
                          </TableCell>
                          <TableCell>
                            {station.qth_name || '-'}
                          </TableCell>
                          <TableCell className="font-mono">
                            {station.grid_locator || '-'}
                          </TableCell>
                          <TableCell>
                            {station.power_watts ? `${station.power_watts}W` : '-'}
                          </TableCell>
                          <TableCell>
                            {stats ? (
                              <div className="text-sm">
                                <div>{stats.totalContacts} QSOs</div>
                                <div className="text-muted-foreground">
                                  {stats.countries} countries, {stats.modes} modes
                                </div>
                              </div>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col space-y-1">
                              {station.is_default && (
                                <Badge variant="default" className="w-fit">Default</Badge>
                              )}
                              <Badge 
                                variant={station.is_active ? "secondary" : "outline"}
                                className="w-fit"
                              >
                                {station.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              {!station.is_default && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSetDefault(station.id)}
                                  title="Set as default station"
                                >
                                  <StarOff className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                asChild
                                title="View station details"
                              >
                                <Link href={`/dashboard/stations/${station.id}`}>
                                  <BarChart3 className="h-4 w-4" />
                                </Link>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                asChild
                                title="Edit station"
                              >
                                <Link href={`/stations/${station.id}/edit`}>
                                  <Edit className="h-4 w-4" />
                                </Link>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(station.id)}
                                className="text-destructive hover:text-destructive"
                                title="Delete station"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}