'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3, Radio, Activity, Loader2, Globe, TrendingUp } from 'lucide-react';
import { YearlyStatsChart } from '@/components/charts/YearlyStatsChart';
import { ModeDistributionChart } from '@/components/charts/ModeDistributionChart';
import { ActivityTrendChart } from '@/components/charts/ActivityTrendChart';
import { BandDistributionChart } from '@/components/charts/BandDistributionChart';
import { BandActivityHeatmap } from '@/components/charts/BandActivityHeatmap';

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

interface AdvancedStatsData {
  monthlyActivity: Array<{ date: string; qsos: number }>;
  dailyActivity: Array<{ date: string; qsos: number }>;
  qsoRates: {
    total_qsos: number;
    active_days: number;
    qsos_per_day: number;
    qsos_per_month: number;
  };
  uniqueCallsigns: {
    unique_callsigns: number;
    total_qsos: number;
    qsos_per_callsign: number;
  };
}

interface GeographicStatsData {
  countryDistribution: Array<{ country: string; continent: string; qsos: number }>;
  continentDistribution: Array<{ continent: string; qsos: number }>;
  gridActivity: Array<{ gridSquare: string; qsos: number }>;
}

interface HeatmapStatsData {
  heatmapData: Array<{ hour: number; day: number; dayName: string; qsos: number }>;
}

export default function StatsPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [advancedStats, setAdvancedStats] = useState<AdvancedStatsData | null>(null);
  const [geographicStats, setGeographicStats] = useState<GeographicStatsData | null>(null);
  const [heatmapStats, setHeatmapStats] = useState<HeatmapStatsData | null>(null);
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

      // Fetch basic stats
      const response = await fetch(`/api/stats?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setStatsData(data);
      } else {
        setError('Failed to fetch statistics');
        return;
      }

      // Fetch advanced analytics in parallel
      const [activityResponse, geographicResponse, heatmapResponse] = await Promise.all([
        fetch(`/api/stats/advanced?type=activity&${params.toString()}`),
        fetch(`/api/stats/advanced?type=geographic&${params.toString()}`),
        fetch(`/api/stats/advanced?type=heatmap&${params.toString()}`)
      ]);

      if (activityResponse.ok) {
        const activityData = await activityResponse.json();
        setAdvancedStats(activityData);
      }

      if (geographicResponse.ok) {
        const geographicData = await geographicResponse.json();
        setGeographicStats(geographicData);
      }

      if (heatmapResponse.ok) {
        const heatmapData = await heatmapResponse.json();
        setHeatmapStats(heatmapData);
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                      <Globe className="h-8 w-8 text-orange-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-muted-foreground">Unique Callsigns</p>
                        <p className="text-2xl font-bold">
                          {advancedStats?.uniqueCallsigns?.unique_callsigns?.toLocaleString() || '-'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* QSO Activity Charts */}
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* QSOs by Year Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle>QSOs by Year</CardTitle>
                      <CardDescription>Annual QSO activity over time</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <YearlyStatsChart data={statsData.qsosByYear} />
                    </CardContent>
                  </Card>

                  {/* QSOs by Mode Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle>QSOs by Mode</CardTitle>
                      <CardDescription>Distribution of QSOs across different modes</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ModeDistributionChart data={statsData.qsosByMode} />
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* QSOs by Band Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle>QSOs by Band</CardTitle>
                      <CardDescription>Band usage following amateur radio frequency order</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <BandDistributionChart data={statsData.qsosByBand} />
                    </CardContent>
                  </Card>

                  {/* Activity Trend Chart */}
                  {advancedStats && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Monthly Activity Trend</CardTitle>
                        <CardDescription>QSO activity patterns over recent months</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ActivityTrendChart 
                          data={advancedStats.monthlyActivity} 
                          timeUnit="month" 
                        />
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>

              {/* Geographic Analytics */}
              {geographicStats && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold flex items-center">
                    <Globe className="mr-2 h-5 w-5" />
                    Geographic Distribution
                  </h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Continent Distribution */}
                    <Card>
                      <CardHeader>
                        <CardTitle>QSOs by Continent</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {geographicStats.continentDistribution.map(item => (
                            <div key={item.continent} className="flex justify-between items-center">
                              <span className="font-medium">{item.continent}</span>
                              <span className="text-muted-foreground">{item.qsos.toLocaleString()}</span>
                            </div>
                          ))}
                          {geographicStats.continentDistribution.length === 0 && (
                            <p className="text-muted-foreground text-center py-4">No data available</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Top Countries */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Top Countries</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {geographicStats.countryDistribution.slice(0, 10).map(item => (
                            <div key={item.country} className="flex justify-between items-center">
                              <span className="font-medium text-sm">{item.country}</span>
                              <span className="text-muted-foreground text-sm">{item.qsos.toLocaleString()}</span>
                            </div>
                          ))}
                          {geographicStats.countryDistribution.length === 0 && (
                            <p className="text-muted-foreground text-center py-4">No data available</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Grid Squares */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Top Grid Squares</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {geographicStats.gridActivity.slice(0, 10).map(item => (
                            <div key={item.gridSquare} className="flex justify-between items-center">
                              <span className="font-medium font-mono">{item.gridSquare}</span>
                              <span className="text-muted-foreground">{item.qsos.toLocaleString()}</span>
                            </div>
                          ))}
                          {geographicStats.gridActivity.length === 0 && (
                            <p className="text-muted-foreground text-center py-4">No data available</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {/* Activity Analysis */}
              {advancedStats && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold flex items-center">
                    <TrendingUp className="mr-2 h-5 w-5" />
                    Activity Analysis
                  </h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Activity Metrics */}
                    <Card>
                      <CardHeader>
                        <CardTitle>QSO Rates</CardTitle>
                        <CardDescription>Activity pattern metrics</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">Active Days</span>
                            <span className="text-sm text-muted-foreground">
                              {advancedStats.qsoRates.active_days?.toLocaleString() || '-'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">QSOs per Day</span>
                            <span className="text-sm text-muted-foreground">
                              {advancedStats.qsoRates.qsos_per_day || '-'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">QSOs per Month</span>
                            <span className="text-sm text-muted-foreground">
                              {advancedStats.qsoRates.qsos_per_month || '-'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">QSOs per Callsign</span>
                            <span className="text-sm text-muted-foreground">
                              {advancedStats.uniqueCallsigns.qsos_per_callsign || '-'}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Activity Heatmap */}
                    {heatmapStats && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Activity Heatmap</CardTitle>
                          <CardDescription>QSO activity by hour and day of week</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <BandActivityHeatmap data={heatmapStats.heatmapData} />
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              )}

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