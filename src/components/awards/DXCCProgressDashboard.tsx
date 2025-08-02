'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe, Map, BarChart3, Trophy, Target, Zap } from 'lucide-react';
import { DXCCProgress, DXCC_BANDS, DXCCSummary, DXCC_AWARD_DEFINITIONS } from '@/types/awards';

interface DXCCProgressDashboardProps {
  stationId?: number;
}

export default function DXCCProgressDashboard({ stationId }: DXCCProgressDashboardProps) {
  const [summary, setSummary] = useState<DXCCSummary | null>(null);
  const [selectedBand, setSelectedBand] = useState<string>('all');
  const [selectedMode, setSelectedMode] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDXCCSummary = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (stationId) params.append('station_id', stationId.toString());

      const response = await fetch(`/api/awards/dxcc/summary?${params}`);
      if (!response.ok) throw new Error('Failed to fetch DXCC summary');

      const data = await response.json();
      if (data.success) {
        setSummary(data.data);
      } else {
        setError(data.error || 'Failed to load DXCC data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [stationId]);

  useEffect(() => {
    fetchDXCCSummary();
  }, [fetchDXCCSummary]);

  const getCurrentProgress = (): DXCCProgress => {
    if (!summary) return {} as DXCCProgress;

    if (selectedBand !== 'all' && summary.band_progress[selectedBand]) {
      return summary.band_progress[selectedBand];
    }

    if (selectedMode !== 'all' && summary.mode_progress[selectedMode]) {
      return summary.mode_progress[selectedMode];
    }

    return summary.overall_progress;
  };

  const getAwardDefinition = (progress: DXCCProgress) => {
    return DXCC_AWARD_DEFINITIONS[progress.award_type] || DXCC_AWARD_DEFINITIONS.basic;
  };

  const isAwardEligible = (progress: DXCCProgress): boolean => {
    const definition = getAwardDefinition(progress);
    return progress.confirmed_entities >= definition.entities_required;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-16 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-destructive">Error loading DXCC data: {error}</p>
        </CardContent>
      </Card>
    );
  }

  const currentProgress = getCurrentProgress();
  const awardDefinition = getAwardDefinition(currentProgress);
  const isEligible = isAwardEligible(currentProgress);

  return (
    <div className="space-y-6">
      {/* Filter Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            DXCC Progress Dashboard
          </CardTitle>
          <CardDescription>
            Track your progress towards DXCC awards across different bands and modes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Band</label>
              <Select value={selectedBand} onValueChange={setSelectedBand}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Bands</SelectItem>
                  {DXCC_BANDS.map(band => (
                    <SelectItem key={band} value={band}>{band}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Mode</label>
              <Select value={selectedMode} onValueChange={setSelectedMode}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modes</SelectItem>
                  <SelectItem value="Phone">Phone</SelectItem>
                  <SelectItem value="CW">CW</SelectItem>
                  <SelectItem value="Digital">Digital</SelectItem>
                  <SelectItem value="RTTY">RTTY</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Entities</p>
                <p className="text-2xl font-bold">{currentProgress.total_entities}</p>
              </div>
              <Globe className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Worked</p>
                <p className="text-2xl font-bold text-yellow-600">{currentProgress.worked_entities}</p>
                <p className="text-xs text-muted-foreground">{currentProgress.progress_percentage}%</p>
              </div>
              <Target className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Confirmed</p>
                <p className="text-2xl font-bold text-green-600">{currentProgress.confirmed_entities}</p>
                <p className="text-xs text-muted-foreground">{currentProgress.confirmed_percentage}%</p>
              </div>
              <Trophy className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Needed</p>
                <p className="text-2xl font-bold text-muted-foreground">{currentProgress.needed_entities}</p>
              </div>
              <Zap className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Award Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            {awardDefinition.name} Status
          </CardTitle>
          <CardDescription>
            {awardDefinition.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Progress to Award ({awardDefinition.entities_required} entities required)
            </span>
            <Badge variant={isEligible ? "default" : "secondary"}>
              {isEligible ? "ELIGIBLE" : "IN PROGRESS"}
            </Badge>
          </div>
          
          <Progress 
            value={(currentProgress.confirmed_entities / awardDefinition.entities_required) * 100} 
            className="h-3"
          />
          
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{currentProgress.confirmed_entities} confirmed</span>
            <span>{awardDefinition.entities_required} required</span>
          </div>

          {isEligible && (
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-green-600" />
                <p className="text-green-800 dark:text-green-200 font-medium">
                  Congratulations! You are eligible for the {awardDefinition.name} award!
                </p>
              </div>
              <p className="text-green-700 dark:text-green-300 text-sm mt-1">
                {awardDefinition.requirements}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Continent Breakdown */}
      {currentProgress.by_continent && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Map className="h-5 w-5" />
              Progress by Continent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(currentProgress.by_continent)
                .filter(([continent]) => continent && continent.trim() && continent !== 'null' && continent !== 'undefined')
                .sort(([a], [b]) => {
                  // Sort Unknown to the end
                  if (a === 'Unknown') return 1;
                  if (b === 'Unknown') return -1;
                  return a.localeCompare(b);
                })
                .map(([continent, stats]) => (
                <div key={continent} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{continent}</span>
                    <span className="text-sm text-muted-foreground">
                      {stats.worked}/{stats.total}
                    </span>
                  </div>
                  <Progress 
                    value={(stats.worked / stats.total) * 100} 
                    className="h-2"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{stats.confirmed} confirmed</span>
                    <span>{Math.round((stats.worked / stats.total) * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Confirmations */}
      {summary.recent_confirmations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Recent Confirmations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.recent_confirmations.slice(0, 5).map((confirmation, index) => (
                <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{confirmation.entity_id}</Badge>
                    <span className="font-medium">Entity #{confirmation.entity_id}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="secondary">{confirmation.mode}</Badge>
                    <span>{confirmation.confirmed_date ? new Date(confirmation.confirmed_date).toLocaleDateString() : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Band/Mode Progress Tabs */}
      <Tabs defaultValue="bands" className="space-y-4">
        <TabsList>
          <TabsTrigger value="bands">Bands</TabsTrigger>
          <TabsTrigger value="modes">Modes</TabsTrigger>
        </TabsList>
        
        <TabsContent value="bands" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {DXCC_BANDS.map(band => {
              const bandProgress = summary.band_progress[band];
              return (
                <Card key={band}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">{band} DXCC</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Worked:</span>
                        <span className="font-medium">{bandProgress?.worked_entities || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Confirmed:</span>
                        <span className="font-medium">{bandProgress?.confirmed_entities || 0}</span>
                      </div>
                      <Progress 
                        value={bandProgress?.confirmed_percentage || 0} 
                        className="h-2"
                      />
                      <div className="text-xs text-center text-muted-foreground">
                        {bandProgress?.confirmed_percentage || 0}% confirmed
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
        
        <TabsContent value="modes" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {['Phone', 'CW', 'Digital', 'RTTY'].map(mode => {
              const modeProgress = summary.mode_progress[mode];
              return (
                <Card key={mode}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">{mode} DXCC</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Worked:</span>
                        <span className="font-medium">{modeProgress?.worked_entities || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Confirmed:</span>
                        <span className="font-medium">{modeProgress?.confirmed_entities || 0}</span>
                      </div>
                      <Progress 
                        value={modeProgress?.confirmed_percentage || 0} 
                        className="h-2"
                      />
                      <div className="text-xs text-center text-muted-foreground">
                        {modeProgress?.confirmed_percentage || 0}% confirmed
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}