'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Activity, Radio, Sun, AlertTriangle } from 'lucide-react';
import { SolarActivity, BandCondition, PropagationForecast } from '@/types/propagation';
import Navbar from '@/components/Navbar';

interface PropagationData {
  success: boolean;
  solar_activity: (Omit<SolarActivity, 'timestamp'> & { timestamp: string }) | null;
  band_conditions: BandCondition[];
  forecast: (Omit<PropagationForecast, 'timestamp'> & { timestamp: string }) | null;
  updated_at: string;
  data_source?: string;
  error?: string;
}

export default function PropagationPage() {
  const [data, setData] = useState<PropagationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchPropagationData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/propagation');
      const result = await response.json();
      setData(result);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching propagation data:', error);
      setData({
        success: false,
        error: 'Failed to fetch propagation data',
        solar_activity: null,
        band_conditions: [],
        forecast: null,
        updated_at: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const updateFromNOAA = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/propagation/solar');
      const result = await response.json();
      if (result.success) {
        // Refresh the main data after NOAA update
        await fetchPropagationData();
      } else {
        console.error('NOAA update failed:', result.error);
      }
    } catch (error) {
      console.error('Error updating from NOAA:', error);
    }
  };

  useEffect(() => {
    fetchPropagationData();
  }, []);

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'excellent': return 'bg-green-500 text-white';
      case 'good': return 'bg-blue-500 text-white';
      case 'fair': return 'bg-yellow-500 text-black';
      case 'poor': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar title="Propagation Conditions" />
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading propagation data...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar title="Propagation Conditions" />
      
      <div className="container mx-auto p-6">
        <div className="flex flex-col space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Propagation Conditions</h1>
              <p className="text-muted-foreground">
                Real-time HF propagation analysis and band conditions
              </p>
            </div>
          <div className="flex space-x-2">
            <Button
              onClick={updateFromNOAA}
              disabled={loading}
              variant="outline"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Sun className="h-4 w-4 mr-2" />
              )}
              Update from NOAA
            </Button>
            <Button
              onClick={fetchPropagationData}
              disabled={loading}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Error Display */}
        {data && !data.success && (
          <Card className="border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center text-red-600">
                <AlertTriangle className="h-5 w-5 mr-2" />
                <span>{data.error || 'Failed to load propagation data'}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Solar Activity */}
        {data?.solar_activity && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                Solar Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {data.solar_activity.solar_flux_index.toFixed(1)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Solar Flux Index (SFI)
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {data.solar_activity.a_index.toFixed(1)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    A-Index (Daily)
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {data.solar_activity.k_index.toFixed(1)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    K-Index (3-hour)
                  </div>
                </div>
              </div>
              <div className="mt-4 text-sm text-muted-foreground text-center">
                Last updated: {formatTimestamp(data.solar_activity.timestamp)}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Band Conditions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Radio className="h-5 w-5 mr-2" />
              HF Band Conditions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.band_conditions && data.band_conditions.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {data.band_conditions.map((band) => (
                  <div key={band.band} className="text-center">
                    <div className="font-semibold text-lg mb-1">{band.band}</div>
                    <Badge 
                      className={`w-full justify-center ${getConditionColor(band.condition)}`}
                    >
                      {band.condition.toUpperCase()}
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-1">
                      {band.confidence}% confidence
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No band condition data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* General Conditions */}
        {data?.forecast && (
          <Card>
            <CardHeader>
              <CardTitle>General Propagation Forecast</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Badge 
                    className={`text-lg px-4 py-2 ${getConditionColor(data.forecast.general_conditions)}`}
                  >
                    {data.forecast.general_conditions.toUpperCase()} CONDITIONS
                  </Badge>
                  {data.forecast.notes && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {data.forecast.notes}
                    </p>
                  )}
                  {data.forecast.source === 'Simulated' && (
                    <p className="text-xs text-yellow-600 mt-2 flex items-center">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Using simulated data - NOAA space weather services unavailable
                    </p>
                  )}
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <div>Source: {data.forecast.source}</div>
                  <div>Updated: {formatTimestamp(data.forecast.timestamp)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Last Update Info */}
        {lastUpdate && (
          <div className="text-center text-sm text-muted-foreground">
            Page last refreshed: {lastUpdate.toLocaleString()}
          </div>
        )}
      </div>
    </div>
    </div>
  );
}