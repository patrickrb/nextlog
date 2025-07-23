'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Radio, CalendarDays, ArrowLeft, ExternalLink, RefreshCw } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { useUser } from '@/contexts/UserContext';

interface DXpedition {
  callsign: string;
  dxcc: string;
  startDate: string;
  endDate: string;
  bands?: string;
  modes?: string;
  qslVia?: string;
  info?: string;
  status: 'upcoming' | 'active' | 'completed';
}

interface DXpeditionsData {
  dxpeditions: DXpedition[];
  lastUpdated: string;
}

export default function DXpeditionsPage() {
  const [data, setData] = useState<DXpeditionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const { user } = useUser();
  const router = useRouter();

  const fetchDXpeditions = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch('/api/dxpeditions?limit=0&status=all');
      
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      
      if (response.ok) {
        const fetchedData = await response.json();
        setData(fetchedData);
      } else {
        setError('Failed to load DXpeditions');
      }
    } catch {
      setError('Network error loading DXpeditions');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!user && !loading) {
      router.push('/login');
      return;
    }
    fetchDXpeditions();
  }, [user, router, loading, fetchDXpeditions]);

  const filterDXpeditions = (status: string) => {
    if (!data) return [];
    
    if (status === 'all') return data.dxpeditions;
    
    return data.dxpeditions.filter(dx => {
      if (status === 'active') {
        return dx.status === 'active' || isActive(dx.startDate, dx.endDate);
      }
      return dx.status === status;
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isActive = (startDate: string, endDate: string) => {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    return now >= start && now <= end;
  };

  const getStatusBadge = (dx: DXpedition) => {
    if (dx.status === 'active' || isActive(dx.startDate, dx.endDate)) {
      return <Badge className="bg-green-500 hover:bg-green-600">Active</Badge>;
    } else if (new Date(dx.startDate) > new Date()) {
      return <Badge variant="outline">Upcoming</Badge>;
    } else {
      return <Badge variant="secondary">Completed</Badge>;
    }
  };

  const getDaysUntil = (startDate: string) => {
    const now = new Date();
    const start = new Date(startDate);
    const diffTime = start.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0) {
      return `${diffDays} day${diffDays === 1 ? '' : 's'}`;
    } else if (diffDays === 0) {
      return 'Today';
    } else {
      return 'Started';
    }
  };

  const activeDXpeditions = filterDXpeditions('active');
  const upcomingDXpeditions = filterDXpeditions('upcoming');
  const allDXpeditions = filterDXpeditions('all');

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar title="DXpeditions" actions={
          <Button variant="ghost" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
        } />
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin mr-2" />
              <span className="text-lg">Loading DXpeditions...</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar 
        title="DXpeditions" 
        actions={
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchDXpeditions}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
          </div>
        }
      />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center">
                <Radio className="mr-3 h-8 w-8" />
                DXpeditions
              </h1>
              <p className="text-muted-foreground mt-2">
                Current and upcoming amateur radio DX operations
              </p>
              {data?.lastUpdated && (
                <p className="text-sm text-muted-foreground mt-1">
                  Last updated: {formatDateTime(data.lastUpdated)}
                </p>
              )}
            </div>
            <Button variant="outline" asChild>
              <Link href="https://ng3k.com/misc/adxo.html" target="_blank" rel="noopener noreferrer">
                View on NG3K
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription className="flex items-center justify-between">
                <span>{error}</span>
                <Button variant="outline" size="sm" onClick={fetchDXpeditions}>
                  Try Again
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active Now</p>
                    <p className="text-2xl font-bold text-green-600">{activeDXpeditions.length}</p>
                  </div>
                  <Radio className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Upcoming</p>
                    <p className="text-2xl font-bold text-blue-600">{upcomingDXpeditions.length}</p>
                  </div>
                  <CalendarDays className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Listed</p>
                    <p className="text-2xl font-bold">{allDXpeditions.length}</p>
                  </div>
                  <Radio className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* DXpeditions Table */}
          <Card>
            <CardHeader>
              <CardTitle>DXpedition List</CardTitle>
              <CardDescription>
                Detailed information about current and upcoming DX operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="all">All ({allDXpeditions.length})</TabsTrigger>
                  <TabsTrigger value="active">Active ({activeDXpeditions.length})</TabsTrigger>
                  <TabsTrigger value="upcoming">Upcoming ({upcomingDXpeditions.length})</TabsTrigger>
                </TabsList>
                
                <TabsContent value="all" className="mt-6">
                  <DXpeditionTable dxpeditions={allDXpeditions} />
                </TabsContent>
                
                <TabsContent value="active" className="mt-6">
                  <DXpeditionTable dxpeditions={activeDXpeditions} />
                </TabsContent>
                
                <TabsContent value="upcoming" className="mt-6">
                  <DXpeditionTable dxpeditions={upcomingDXpeditions} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );

  function DXpeditionTable({ dxpeditions }: { dxpeditions: DXpedition[] }) {
    if (dxpeditions.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No DXpeditions found for this category.</p>
        </div>
      );
    }

    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Callsign</TableHead>
              <TableHead>DXCC Entity</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Bands</TableHead>
              <TableHead>Modes</TableHead>
              <TableHead>QSL via</TableHead>
              <TableHead>Info</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dxpeditions.map((dx, index) => (
              <TableRow key={index}>
                <TableCell className="font-mono font-semibold">{dx.callsign}</TableCell>
                <TableCell className="font-medium">{dx.dxcc}</TableCell>
                <TableCell className="text-sm">
                  <div>
                    {formatDate(dx.startDate)} - {formatDate(dx.endDate)}
                  </div>
                  {new Date(dx.startDate) > new Date() && (
                    <div className="text-xs text-muted-foreground mt-1">
                      in {getDaysUntil(dx.startDate)}
                    </div>
                  )}
                </TableCell>
                <TableCell>{getStatusBadge(dx)}</TableCell>
                <TableCell className="text-sm">{dx.bands || '-'}</TableCell>
                <TableCell className="text-sm">{dx.modes || '-'}</TableCell>
                <TableCell className="font-mono text-sm">{dx.qslVia || '-'}</TableCell>
                <TableCell className="text-sm">{dx.info || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }
}