'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3, Radio, Calendar, Activity, Loader2 } from 'lucide-react';

interface Station {
  id: number;
  callsign: string;
  station_name: string;
}

interface StatsData {
  qsosByYear: Array<{ year: number; count: number }>;
  qsosByMode: Array<{ mode: string; count: number }>;
  qsosByBand: Array<{ band: string; count: number }>;
  qsosByModeAndBand: Array<{ mode: string; band: string; count: number }>;
  availableYears: number[];
  totalQsos: number;
}

export default function StatsPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
        return;
      }
      fetchStations();
    }
  }, [user, loading, router]);

  const fetchStations = async () => {
    try {
      const response = await fetch('/api/stations');
      if (response.ok) {
        const data = await response.json();
        setStations(data.stations || []);
      }
    } catch (error) {
      console.error('Error fetching stations:', error);
    }
  };

  const fetchStats = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams();
      if (selectedStation !== 'all') {
        params.append('stationId', selectedStation);
      }
      if (selectedYear !== 'all') {
        params.append('year', selectedYear);
      }

      const response = await fetch(`/api/stats?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setStatsData(data);
      } else {
        setError('Failed to fetch statistics');
      }
    } catch (err) {
      setError('Network error occurred');
      console.error('Stats fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, selectedStation, selectedYear]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const createModeAndBandMatrix = () => {
    if (!statsData) return null;

    // Get unique modes and bands
    const modes = [...new Set(statsData.qsosByMode.map(item => item.mode))];
    const bands = [...new Set(statsData.qsosByBand.map(item => item.band))];

    // Create lookup map for quick access
    const matrixData = new Map<string, number>();
    statsData.qsosByModeAndBand.forEach(item => {
      matrixData.set(`${item.mode}-${item.band}`, item.count);
    });

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold">Mode</TableHead>
              {bands.map(band => (
                <TableHead key={band} className="text-center font-semibold min-w-[80px]">
                  {band}
                </TableHead>
              ))}
              <TableHead className="text-center font-semibold bg-muted">
                Total
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {modes.map(mode => {
              const modeTotal = statsData.qsosByMode.find(m => m.mode === mode)?.count || 0;
              return (
                <TableRow key={mode}>
                  <TableCell className="font-medium">{mode}</TableCell>
                  {bands.map(band => {
                    const count = matrixData.get(`${mode}-${band}`) || 0;
                    return (
                      <TableCell key={`${mode}-${band}`} className="text-center">
                        {count > 0 ? count.toLocaleString() : '-'}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center font-semibold bg-muted">
                    {modeTotal.toLocaleString()}
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow className="bg-muted font-semibold">
              <TableCell>Total</TableCell>
              {bands.map(band => {
                const bandTotal = statsData.qsosByBand.find(b => b.band === band)?.count || 0;
                return (
                  <TableCell key={`total-${band}`} className="text-center">
                    {bandTotal.toLocaleString()}
                  </TableCell>
                );
              })}
              <TableCell className="text-center">
                {statsData.totalQsos.toLocaleString()}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar title="Statistics" />
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            <p className="mt-2">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar 
        title="Statistics" 
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Statistics' }]}
      />
      
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="mr-2 h-5 w-5" />
                Logbook Statistics
              </CardTitle>
              <CardDescription>
                View comprehensive statistics about your amateur radio contacts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Station</label>
                  <Select value={selectedStation} onValueChange={setSelectedStation}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select station" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stations</SelectItem>
                      {stations.map(station => (
                        <SelectItem key={station.id} value={station.id.toString()}>
                          {station.callsign} - {station.station_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Year</label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Years</SelectItem>
                      {statsData?.availableYears.map(year => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto" />
              <p className="mt-2">Loading statistics...</p>
            </div>
          ) : error ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-destructive">{error}</p>
              </CardContent>
            </Card>
          ) : statsData ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <Activity className="h-8 w-8 text-blue-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-muted-foreground">Total QSOs</p>
                        <p className="text-2xl font-bold">{statsData.totalQsos.toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <Radio className="h-8 w-8 text-green-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-muted-foreground">Unique Modes</p>
                        <p className="text-2xl font-bold">{statsData.qsosByMode.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <BarChart3 className="h-8 w-8 text-purple-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-muted-foreground">Unique Bands</p>
                        <p className="text-2xl font-bold">{statsData.qsosByBand.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <Calendar className="h-8 w-8 text-orange-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-muted-foreground">Years Active</p>
                        <p className="text-2xl font-bold">{statsData.availableYears.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* QSOs by Year */}
                <Card>
                  <CardHeader>
                    <CardTitle>QSOs by Year</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {statsData.qsosByYear.map(item => (
                        <div key={item.year} className="flex justify-between items-center">
                          <span className="font-medium">{item.year}</span>
                          <span className="text-muted-foreground">{item.count.toLocaleString()}</span>
                        </div>
                      ))}
                      {statsData.qsosByYear.length === 0 && (
                        <p className="text-muted-foreground text-center py-4">No data available</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* QSOs by Mode */}
                <Card>
                  <CardHeader>
                    <CardTitle>QSOs by Mode</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {statsData.qsosByMode.map(item => (
                        <div key={item.mode} className="flex justify-between items-center">
                          <span className="font-medium">{item.mode}</span>
                          <span className="text-muted-foreground">{item.count.toLocaleString()}</span>
                        </div>
                      ))}
                      {statsData.qsosByMode.length === 0 && (
                        <p className="text-muted-foreground text-center py-4">No data available</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* QSOs by Band */}
                <Card>
                  <CardHeader>
                    <CardTitle>QSOs by Band</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {statsData.qsosByBand.map(item => (
                        <div key={item.band} className="flex justify-between items-center">
                          <span className="font-medium">{item.band}</span>
                          <span className="text-muted-foreground">{item.count.toLocaleString()}</span>
                        </div>
                      ))}
                      {statsData.qsosByBand.length === 0 && (
                        <p className="text-muted-foreground text-center py-4">No data available</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* QSOs Matrix Table */}
              <Card>
                <CardHeader>
                  <CardTitle>QSOs by Mode and Band</CardTitle>
                  <CardDescription>
                    Matrix showing the number of QSOs for each mode and band combination
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {createModeAndBandMatrix()}
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}