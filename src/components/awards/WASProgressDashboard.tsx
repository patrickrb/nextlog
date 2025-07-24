'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Trophy, 
  MapPin, 
  Radio, 
  Zap,
  CheckCircle,
  Circle,
  Clock,
  Download
} from 'lucide-react';
import { WASSummary } from '@/types/awards';

interface Station {
  id: number;
  callsign: string;
  station_name: string;
  is_default: boolean;
}

interface WASProgressDashboardProps {
  stations: Station[];
}

export default function WASProgressDashboard({ stations }: WASProgressDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [selectedStation, setSelectedStation] = useState<string>('');
  const [summary, setSummary] = useState<WASSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Set default station
  useEffect(() => {
    if (stations.length > 0 && !selectedStation) {
      const defaultStation = stations.find(s => s.is_default) || stations[0];
      setSelectedStation(defaultStation.id.toString());
    }
  }, [stations, selectedStation]);

  const loadWASSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedStation) {
        params.append('station_id', selectedStation);
      }

      const response = await fetch(`/api/awards/was/summary?${params}`);
      const data = await response.json();

      if (data.success) {
        // Convert date strings to Date objects
        const processedData = {
          ...data.data,
          recent_confirmations: data.data.recent_confirmations?.map((confirmation: {
            confirmed_date?: string;
            created_at?: string;
            [key: string]: unknown;
          }) => ({
            ...confirmation,
            confirmed_date: confirmation.confirmed_date ? new Date(confirmation.confirmed_date) : null,
            created_at: confirmation.created_at ? new Date(confirmation.created_at) : null
          })) || [],
          overall_progress: {
            ...data.data.overall_progress,
            states: data.data.overall_progress?.states?.map((state: {
              last_worked_date?: string;
              last_confirmed_date?: string;
              [key: string]: unknown;
            }) => ({
              ...state,
              last_worked_date: state.last_worked_date ? new Date(state.last_worked_date) : null,
              last_confirmed_date: state.last_confirmed_date ? new Date(state.last_confirmed_date) : null
            })) || []
          }
        };
        setSummary(processedData);
      } else {
        setError(data.error || 'Failed to load WAS data');
      }
    } catch (err) {
      console.error('Failed to load WAS summary:', err);
      setError('Failed to load WAS data');
    } finally {
      setLoading(false);
    }
  }, [selectedStation]);

  // Load WAS summary data
  useEffect(() => {
    if (selectedStation) {
      loadWASSummary();
    }
  }, [selectedStation, loadWASSummary]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'worked':
        return <Circle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Circle className="h-4 w-4 text-gray-300" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'worked':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium">Loading WAS Progress...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-red-600">{error}</p>
            <Button onClick={loadWASSummary} className="mt-4">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-muted-foreground">No WAS data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">WAS Progress</h1>
          <p className="text-muted-foreground mt-1">Worked All States Award Tracking</p>
        </div>
        
        <div className="flex gap-3">
          <Select value={selectedStation} onValueChange={setSelectedStation}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select station" />
            </SelectTrigger>
            <SelectContent>
              {stations.map((station) => (
                <SelectItem key={station.id} value={station.id.toString()}>
                  {station.callsign} - {station.station_name}
                  {station.is_default && ' (Default)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="icon">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Overall Progress Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Trophy className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Overall Progress</p>
                <div className="flex items-center">
                  <p className="text-2xl font-bold">
                    {summary.overall_progress.worked_states}/{summary.overall_progress.total_states}
                  </p>
                  <Badge variant="secondary" className="ml-2">
                    {summary.overall_progress.progress_percentage}%
                  </Badge>
                </div>
              </div>
            </div>
            <Progress 
              value={summary.overall_progress.progress_percentage} 
              className="mt-3" 
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Confirmed</p>
                <div className="flex items-center">
                  <p className="text-2xl font-bold">
                    {summary.overall_progress.confirmed_states}
                  </p>
                  <Badge variant="secondary" className="ml-2">
                    {summary.overall_progress.confirmed_percentage}%
                  </Badge>
                </div>
              </div>
            </div>
            <Progress 
              value={summary.overall_progress.confirmed_percentage} 
              className="mt-3"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Worked</p>
                <p className="text-2xl font-bold">
                  {summary.overall_progress.worked_states - summary.overall_progress.confirmed_states}
                </p>
                <p className="text-xs text-muted-foreground">Awaiting QSL</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <MapPin className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Needed</p>
                <p className="text-2xl font-bold">
                  {summary.overall_progress.needed_states}
                </p>
                <p className="text-xs text-muted-foreground">States remaining</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Progress Tabs */}
      <Tabs defaultValue="bands" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="bands">By Band</TabsTrigger>
          <TabsTrigger value="modes">By Mode</TabsTrigger>
          <TabsTrigger value="states">State List</TabsTrigger>
          <TabsTrigger value="recent">Recent</TabsTrigger>
        </TabsList>

        <TabsContent value="bands" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Object.entries(summary.band_progress).map(([band, progress]) => (
              <Card key={band}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center">
                    <Radio className="h-4 w-4 mr-2" />
                    {band}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Worked:</span>
                      <span className="font-medium">{progress.worked_states}/{progress.total_states}</span>
                    </div>
                    <Progress value={progress.progress_percentage} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Confirmed: {progress.confirmed_states}</span>
                      <span>{progress.progress_percentage}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="modes" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(summary.mode_progress).map(([mode, progress]) => (
              <Card key={mode}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center">
                    <Zap className="h-4 w-4 mr-2" />
                    {mode}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Worked:</span>
                      <span className="font-medium">{progress.worked_states}/{progress.total_states}</span>
                    </div>
                    <Progress value={progress.progress_percentage} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Confirmed: {progress.confirmed_states}</span>
                      <span>{progress.progress_percentage}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="states" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>State Progress</CardTitle>
              <CardDescription>
                Detailed progress for each US state
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
                {summary.overall_progress.states.map((state) => (
                  <div 
                    key={state.state_code}
                    className={`p-3 rounded-lg border ${getStatusColor(state.status)}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{state.state_code}</p>
                        <p className="text-xs opacity-75">{state.state_name}</p>
                      </div>
                      {getStatusIcon(state.status)}
                    </div>
                    {state.contact_count > 0 && (
                      <p className="text-xs mt-1 opacity-75">
                        {state.contact_count} contact{state.contact_count !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Confirmations</CardTitle>
              <CardDescription>
                Latest WAS confirmations received
              </CardDescription>
            </CardHeader>
            <CardContent>
              {summary.recent_confirmations.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No recent confirmations found
                </p>
              ) : (
                <div className="space-y-3">
                  {summary.recent_confirmations.map((confirmation, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="font-medium">{confirmation.state_code}</p>
                          <p className="text-sm text-muted-foreground">
                            {confirmation.mode}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {confirmation.confirmed_date ? new Date(confirmation.confirmed_date).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Needed States */}
      <Card>
        <CardHeader>
          <CardTitle>States Needed</CardTitle>
          <CardDescription>
            States still needed for WAS completion
          </CardDescription>
        </CardHeader>
        <CardContent>
          {summary.needed_states.all.length === 0 ? (
            <div className="text-center py-8">
              <Trophy className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <p className="text-lg font-medium">Congratulations!</p>
              <p className="text-muted-foreground">You have worked all 50 states!</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">All Modes ({summary.needed_states.all.length} states needed)</h4>
                <div className="flex flex-wrap gap-2">
                  {summary.needed_states.all.map((state) => (
                    <Badge key={state} variant="outline">
                      {state}
                    </Badge>
                  ))}
                </div>
              </div>
              
              {Object.entries(summary.needed_states.by_mode).map(([mode, states]) => (
                states.length > 0 && (
                  <div key={mode}>
                    <h4 className="font-medium mb-2">{mode} ({states.length} states needed)</h4>
                    <div className="flex flex-wrap gap-2">
                      {states.map((state) => (
                        <Badge key={state} variant="outline">
                          {state}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}