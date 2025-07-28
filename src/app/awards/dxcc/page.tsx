'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Globe, Award, Map, BarChart3, Download, ExternalLink } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import Navbar from '@/components/Navbar';
import DXCCProgressDashboard from '@/components/awards/DXCCProgressDashboard';
import DXCCEntityList from '@/components/awards/DXCCEntityList';
import { DXCCSummary, DXCCEntityProgress } from '@/types/awards';

export default function DXCCPage() {
  const { user } = useUser();
  const [summary, setSummary] = useState<DXCCSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState('overview');

  useEffect(() => {
    if (user) {
      fetchDXCCSummary();
    }
  }, [user]);

  const fetchDXCCSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/awards/dxcc/summary');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        setSummary(data.data);
      } else {
        setError(data.error || 'Failed to load DXCC data');
      }
    } catch (err) {
      console.error('DXCC summary error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getNeededEntities = (): DXCCEntityProgress[] => {
    if (!summary) return [];
    return summary.overall_progress.entities.filter(e => e.status === 'needed');
  };

  const getWorkedEntities = (): DXCCEntityProgress[] => {
    if (!summary) return [];
    return summary.overall_progress.entities.filter(e => e.status === 'worked');
  };

  const getConfirmedEntities = (): DXCCEntityProgress[] => {
    if (!summary) return [];
    return summary.overall_progress.entities.filter(e => e.status === 'confirmed');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar title="DXCC Awards" />
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="animate-pulse space-y-6">
              <div className="h-32 bg-muted rounded-lg"></div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-24 bg-muted rounded-lg"></div>
                ))}
              </div>
              <div className="h-96 bg-muted rounded-lg"></div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar title="DXCC Awards" />
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <Card>
              <CardContent className="p-6 text-center">
                <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Unable to Load DXCC Data</h3>
                <p className="text-muted-foreground mb-4">
                  {error || 'There was a problem loading your DXCC progress.'}
                </p>
                <Button onClick={fetchDXCCSummary}>
                  Try Again
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  const overallProgress = summary.overall_progress;
  const isBasicEligible = overallProgress.confirmed_entities >= 100;

  return (
    <div className="min-h-screen bg-background">
      <Navbar 
        title="DXCC Awards" 
        actions={
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              ARRL DXCC
            </Button>
          </div>
        }
      />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 space-y-6">
          
          {/* Header Stats */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-6 w-6" />
                    DXCC Progress Overview
                  </CardTitle>
                  <CardDescription>
                    Track your progress towards DX Century Club awards
                  </CardDescription>
                </div>
                {isBasicEligible && (
                  <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                    <Award className="h-4 w-4 mr-1" />
                    DXCC Eligible
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {overallProgress.total_entities}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Entities</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {overallProgress.worked_entities}
                  </div>
                  <div className="text-sm text-muted-foreground">Worked</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {overallProgress.confirmed_entities}
                  </div>
                  <div className="text-sm text-muted-foreground">Confirmed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">
                    {overallProgress.needed_entities}
                  </div>
                  <div className="text-sm text-muted-foreground">Needed</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Content Tabs */}
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="confirmed">
                Confirmed ({overallProgress.confirmed_entities})
              </TabsTrigger>
              <TabsTrigger value="worked">
                Worked ({getWorkedEntities().length})
              </TabsTrigger>
              <TabsTrigger value="needed">
                Needed ({overallProgress.needed_entities})
              </TabsTrigger>
              <TabsTrigger value="statistics">Statistics</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <DXCCProgressDashboard 
                userId={user?.id || 0}
                stationId={undefined}
              />
            </TabsContent>

            <TabsContent value="confirmed" className="space-y-6">
              <DXCCEntityList 
                entities={getConfirmedEntities()}
                title="Confirmed DXCC Entities"
                showFilters={true}
              />
            </TabsContent>

            <TabsContent value="worked" className="space-y-6">
              <DXCCEntityList 
                entities={getWorkedEntities()}
                title="Worked (Awaiting QSL) DXCC Entities"
                showFilters={true}
              />
            </TabsContent>

            <TabsContent value="needed" className="space-y-6">
              <DXCCEntityList 
                entities={getNeededEntities()}
                title="Needed DXCC Entities"
                showFilters={true}
              />
            </TabsContent>

            <TabsContent value="statistics" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Statistics Overview */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      DXCC Statistics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between">
                      <span>Entities Worked:</span>
                      <span className="font-medium">{summary.statistics.entities_worked_total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Entities Confirmed:</span>
                      <span className="font-medium">{summary.statistics.entities_confirmed_total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Confirmation Rate:</span>
                      <span className="font-medium">
                        {summary.statistics.entities_worked_total > 0 
                          ? Math.round((summary.statistics.entities_confirmed_total / summary.statistics.entities_worked_total) * 100)
                          : 0}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Most Active Continent:</span>
                      <span className="font-medium">{summary.statistics.most_worked_continent.continent}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Rarest Entity Worked:</span>
                      <span className="font-medium text-sm">{summary.statistics.rarest_entity.entity}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Activity */}
                {summary.recent_confirmations.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Award className="h-5 w-5" />
                        Recent Confirmations
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {summary.recent_confirmations.slice(0, 8).map((confirmation, index) => (
                          <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">#{confirmation.entity_id}</Badge>
                              <span className="text-sm font-medium">Entity {confirmation.entity_id}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">{confirmation.mode}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {confirmation.confirmed_date ? new Date(confirmation.confirmed_date).toLocaleDateString() : ''}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}