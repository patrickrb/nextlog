'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarDays, Radio, ExternalLink, Loader2 } from 'lucide-react';

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

interface DXpeditionWidgetProps {
  limit?: number;
}

export default function DXpeditionWidget({ limit = 5 }: DXpeditionWidgetProps) {
  const [dxpeditions, setDxpeditions] = useState<DXpedition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDXpeditions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dxpeditions?limit=0&status=all`);
      
      if (response.ok) {
        const data = await response.json();
        // Filter to show only upcoming and active DXpeditions
        const filteredDXpeditions = (data.dxpeditions || []).filter(
          (dx: DXpedition) => dx.status === 'upcoming' || dx.status === 'active'
        );
        // Apply limit after filtering
        setDxpeditions(filteredDXpeditions.slice(0, limit));
      } else {
        setError('Failed to load DXpeditions');
      }
    } catch {
      setError('Network error loading DXpeditions');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchDXpeditions();
  }, [fetchDXpeditions]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
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
      return <Badge className="bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-500">Active</Badge>;
    } else if (new Date(dx.startDate) > new Date()) {
      return <Badge variant="outline">Upcoming</Badge>;
    } else {
      return <Badge variant="secondary">Completed</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Radio className="mr-2 h-5 w-5" />
            Current DXpeditions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading DXpeditions...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Radio className="mr-2 h-5 w-5" />
            Current DXpeditions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={fetchDXpeditions}
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <CardTitle className="flex items-center">
              <Radio className="mr-2 h-5 w-5" />
              Current DXpeditions
            </CardTitle>
            <CardDescription>
              Active and upcoming DX operations
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm" className="flex-shrink-0">
            <Link href="/dxpeditions">
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {dxpeditions.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-muted-foreground">No DXpeditions found</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[600px] overflow-y-auto">
            {dxpeditions.map((dx, index) => (
              <div key={index} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono font-semibold text-base">{dx.callsign}</span>
                  {getStatusBadge(dx)}
                </div>
                <p className="text-sm text-foreground font-medium mb-3">{dx.dxcc}</p>
                <div className="text-xs text-muted-foreground space-y-2">
                  <div className="flex items-center">
                    <CalendarDays className="mr-2 h-3 w-3 flex-shrink-0" />
                    <span>{formatDate(dx.startDate)} - {formatDate(dx.endDate)}</span>
                  </div>
                  {dx.bands && (
                    <div className="flex items-start">
                      <span className="font-medium mr-2 min-w-[45px]">Bands:</span>
                      <span>{dx.bands}</span>
                    </div>
                  )}
                  {dx.modes && (
                    <div className="flex items-start">
                      <span className="font-medium mr-2 min-w-[45px]">Modes:</span>
                      <span>{dx.modes}</span>
                    </div>
                  )}
                </div>
                {dx.info && (
                  <p className="text-xs text-muted-foreground italic mt-3 pt-3 border-t">
                    {dx.info}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 pt-3 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Data updated every 6 hours • Source:{' '}
            <a
              href="https://ng3k.com/misc/adxo.html"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              NG3K
            </a>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}