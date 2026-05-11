'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Dot } from '@/components/ui/dot';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2, Radio } from 'lucide-react';

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

function flagFor(callsign: string) {
  // Generate a deterministic linear gradient that hints at a flag for visual variety.
  const hash = [...callsign].reduce((a, c) => a + c.charCodeAt(0), 0);
  const palettes = [
    'linear-gradient(180deg, #d62828, #003049)',
    'linear-gradient(180deg, #000 33%, #fff 33% 66%, #007a3d 66%)',
    'linear-gradient(180deg, #bf0a30 33%, #fff 33% 66%, #002868 66%)',
    'linear-gradient(180deg, #ce1126 33%, #fff 33% 66%, #003893 66%)',
    'linear-gradient(180deg, #009a44 50%, #fff 50%)',
    'linear-gradient(180deg, #ed2939 50%, #fff 50%)',
  ];
  return palettes[hash % palettes.length];
}

function timeUntil(start: string) {
  const ms = new Date(start).getTime() - Date.now();
  if (ms <= 0) return null;
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days >= 2) return `in ${days}d`;
  if (days === 1) return 'tomorrow';
  const hours = Math.max(1, Math.floor(ms / (60 * 60 * 1000)));
  return `in ${hours}h`;
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
        const filtered = (data.dxpeditions || []).filter(
          (dx: DXpedition) => dx.status === 'upcoming' || dx.status === 'active'
        );
        setDxpeditions(filtered.slice(0, limit));
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

  const isActive = (dx: DXpedition) => dx.status === 'active';

  const renderRows = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-10 text-fg-2">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading DXpeditions...
        </div>
      );
    }
    if (error) {
      return (
        <div className="text-center py-8 px-5">
          <p className="text-fg-2 text-sm mb-3">{error}</p>
          <Button variant="secondary" size="sm" onClick={fetchDXpeditions}>
            Try again
          </Button>
        </div>
      );
    }
    if (dxpeditions.length === 0) {
      return (
        <div className="text-center py-8 px-5">
          <p className="text-fg-2 text-sm">No active or upcoming DXpeditions.</p>
        </div>
      );
    }
    return dxpeditions.map((dx, index) => {
      const live = isActive(dx);
      const upcoming = !live ? timeUntil(dx.startDate) : null;
      return (
        <div
          key={`${dx.callsign}-${index}`}
          className="grid items-center gap-3 px-5 py-3.5 border-b border-line last:border-b-0"
          style={{ gridTemplateColumns: 'auto 1fr auto' }}
        >
          <div
            aria-hidden="true"
            className="w-7 h-5 rounded-[3px]"
            style={{ background: flagFor(dx.callsign) }}
          />
          <div className="min-w-0">
            <div className="font-mono font-semibold text-fg truncate">{dx.callsign}</div>
            <div className="text-[13px] text-fg-2 truncate">
              {dx.dxcc}
              {dx.bands ? ` · ${dx.bands.split(/[,·]/)[0].trim()}` : ''}
            </div>
          </div>
          {live ? (
            <Chip variant="accent" size="sm">
              <Dot tone="ok" live />
              LIVE
            </Chip>
          ) : (
            <Chip size="sm">{upcoming ?? 'soon'}</Chip>
          )}
        </div>
      );
    });
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-accent" />
              Active DXpeditions
            </CardTitle>
            <CardDescription>Right now on the bands</CardDescription>
          </div>
          <Link
            href="/dxpeditions"
            className="text-fg-2 hover:text-fg transition-colors"
            aria-label="See all DXpeditions"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </CardHeader>
      <div className="flex flex-col">{renderRows()}</div>
    </Card>
  );
}
