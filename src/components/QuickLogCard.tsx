'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Loader2, Check, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Dot } from '@/components/ui/dot';
import { Input } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface Station {
  id: number;
  callsign: string;
  station_name: string;
  is_default: boolean;
}

interface LookupResult {
  found: boolean;
  name?: string;
  qth?: string;
  grid_locator?: string;
  latitude?: number;
  longitude?: number;
  country?: string;
  error?: string;
}

const MODES = ['SSB', 'CW', 'FT8', 'FT4', 'RTTY', 'PSK31', 'AM', 'FM'] as const;
const BANDS = ['160M', '80M', '60M', '40M', '30M', '20M', '17M', '15M', '12M', '10M', '6M', '2M', '1.25M', '70CM'] as const;

function freqToBand(freq: number): string {
  if (freq >= 1.8 && freq <= 2.0) return '160M';
  if (freq >= 3.5 && freq <= 4.0) return '80M';
  if (freq >= 5.33 && freq <= 5.408) return '60M';
  if (freq >= 7.0 && freq <= 7.3) return '40M';
  if (freq >= 10.1 && freq <= 10.15) return '30M';
  if (freq >= 14.0 && freq <= 14.35) return '20M';
  if (freq >= 18.068 && freq <= 18.168) return '17M';
  if (freq >= 21.0 && freq <= 21.45) return '15M';
  if (freq >= 24.89 && freq <= 24.99) return '12M';
  if (freq >= 28.0 && freq <= 29.7) return '10M';
  if (freq >= 50.0 && freq <= 54.0) return '6M';
  if (freq >= 144.0 && freq <= 148.0) return '2M';
  if (freq >= 219.0 && freq <= 225.0) return '1.25M';
  if (freq >= 420.0 && freq <= 450.0) return '70CM';
  return '';
}

function defaultRstForMode(mode: string): string {
  if (mode === 'CW') return '599';
  if (['FT8', 'FT4', 'PSK31', 'RTTY', 'MFSK', 'OLIVIA', 'CONTESTIA'].includes(mode)) return '-10';
  return '59';
}

function formatUtcClock(d: Date): string {
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm} UTC`;
}

interface QuickLogCardProps {
  onSaved?: () => void;
}

export default function QuickLogCard({ onSaved }: QuickLogCardProps) {
  const [callsign, setCallsign] = useState('');
  const [frequency, setFrequency] = useState('');
  const [mode, setMode] = useState<string>('SSB');
  const [band, setBand] = useState<string>('');
  const [rstSent, setRstSent] = useState('59');
  const [rstReceived, setRstReceived] = useState('59');

  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<string>('');

  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);

  const [utcNow, setUtcNow] = useState(() => new Date());
  const callsignRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setInterval(() => setUtcNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/stations');
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled) return;
        const list: Station[] = data.stations || [];
        setStations(list);
        const def = list.find((s) => s.is_default) ?? list[0];
        if (def) setSelectedStationId(def.id.toString());
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced callsign lookup
  useEffect(() => {
    const trimmed = callsign.trim();
    if (!trimmed) {
      setLookupResult(null);
      return;
    }
    const id = setTimeout(async () => {
      setLookupLoading(true);
      try {
        const response = await fetch('/api/lookup/callsign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callsign: trimmed }),
        });
        const data = await response.json();
        if (response.ok) {
          setLookupResult(data);
        } else {
          setLookupResult({ found: false, error: data.error || 'Lookup failed' });
        }
      } catch {
        setLookupResult({ found: false, error: 'Network error during lookup' });
      } finally {
        setLookupLoading(false);
      }
    }, 350);
    return () => clearTimeout(id);
  }, [callsign]);

  const handleFreqChange = (value: string) => {
    setFrequency(value);
    const f = parseFloat(value);
    if (Number.isFinite(f)) {
      const derived = freqToBand(f);
      if (derived) setBand(derived);
    }
  };

  const handleModeChange = useCallback((value: string) => {
    setMode(value);
    const rst = defaultRstForMode(value);
    setRstSent(rst);
    setRstReceived(rst);
  }, []);

  const resetForm = () => {
    setCallsign('');
    setLookupResult(null);
    // keep frequency/mode/band/rst — most ops stay on the same band
    callsignRef.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedCall = callsign.trim().toUpperCase();
    if (!trimmedCall) {
      setError('Callsign is required');
      return;
    }
    const freq = parseFloat(frequency);
    if (!Number.isFinite(freq)) {
      setError('Frequency is required');
      return;
    }
    const resolvedBand = band || freqToBand(freq);
    if (!resolvedBand) {
      setError('Frequency is outside amateur radio bands');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callsign: trimmedCall,
          frequency: freq,
          mode,
          band: resolvedBand,
          datetime: new Date().toISOString(),
          rst_sent: rstSent,
          rst_received: rstReceived,
          name: lookupResult?.found ? lookupResult.name : undefined,
          qth: lookupResult?.found ? lookupResult.qth : undefined,
          grid_locator: lookupResult?.found ? lookupResult.grid_locator : undefined,
          latitude: lookupResult?.found ? lookupResult.latitude : undefined,
          longitude: lookupResult?.found ? lookupResult.longitude : undefined,
          station_id: selectedStationId ? Number.parseInt(selectedStationId, 10) : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to save QSO');
        return;
      }
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
      resetForm();
      onSaved?.();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const station = stations.find((s) => s.id.toString() === selectedStationId);
  const hasMultipleStations = stations.length > 1;

  return (
    <Card className="p-4 sm:p-7 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-semibold">Quick log</h2>
        <Chip variant="accent" size="sm">
          <Dot tone="ok" live />
          Live · {formatUtcClock(utcNow)}
        </Chip>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="quick-callsign">Callsign</Label>
          <div className="relative">
            <Input
              id="quick-callsign"
              ref={callsignRef}
              size="lg"
              mono
              value={callsign}
              onChange={(e) => setCallsign(e.target.value.toUpperCase())}
              placeholder="W1AW"
              autoComplete="off"
              spellCheck={false}
              required
            />
            {lookupLoading ? (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-fg-2" />
            ) : null}
          </div>
        </div>

        {lookupResult?.found ? (
          <div className="px-3.5 py-3 rounded-[10px] border border-accent-glow bg-accent-soft flex flex-col gap-1 text-sm">
            <span className="font-semibold text-fg">
              {lookupResult.name ?? callsign}
              {lookupResult.qth ? <span className="text-fg-1"> · {lookupResult.qth}</span> : null}
            </span>
            <span className="font-mono text-[13px] text-fg-1">
              {[lookupResult.grid_locator, lookupResult.country].filter(Boolean).join(' · ') || '—'}
            </span>
          </div>
        ) : lookupResult && !lookupResult.found && callsign.trim() ? (
          <div className="flex items-center gap-2 text-sm text-warn">
            <AlertCircle className="h-4 w-4" />
            {lookupResult.error || 'Callsign not found'}
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quick-freq" className="text-xs">Freq (MHz)</Label>
            <Input
              id="quick-freq"
              type="number"
              step="0.001"
              mono
              value={frequency}
              onChange={(e) => handleFreqChange(e.target.value)}
              placeholder="14.205"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quick-mode" className="text-xs">Mode</Label>
            <Select value={mode} onValueChange={handleModeChange}>
              <SelectTrigger id="quick-mode" className="font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODES.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quick-band" className="text-xs">Band</Label>
            <Select value={band} onValueChange={setBand}>
              <SelectTrigger id="quick-band" className="font-mono">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {BANDS.map((b) => (
                  <SelectItem key={b} value={b}>{b.toLowerCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quick-rst-sent" className="text-xs">RST sent</Label>
            <Input
              id="quick-rst-sent"
              mono
              value={rstSent}
              onChange={(e) => setRstSent(e.target.value)}
              className="text-center"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quick-rst-rcvd" className="text-xs">RST rcvd</Label>
            <Input
              id="quick-rst-rcvd"
              mono
              value={rstReceived}
              onChange={(e) => setRstReceived(e.target.value)}
              className="text-center"
            />
          </div>
        </div>

        {hasMultipleStations ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quick-station" className="text-xs">Station</Label>
            <Select value={selectedStationId} onValueChange={setSelectedStationId}>
              <SelectTrigger id="quick-station">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stations.map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>
                    {s.station_name}
                    <span className="text-fg-2 font-mono ml-2">{s.callsign}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : station ? (
          <div className="text-[12px] text-fg-2 flex items-center gap-1.5">
            Logging as
            <span className="font-mono text-fg-1">{station.callsign}</span>
            · {station.station_name}
          </div>
        ) : stations.length === 0 ? (
          <div className="text-[12px] text-warn flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" />
            <Link href="/stations/new" className="underline">Add a station</Link>
            before logging.
          </div>
        ) : null}

        {error ? (
          <div className="bg-bad/10 border border-bad/25 text-bad px-3 py-2 rounded-[10px] text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : null}

        <Button
          type="submit"
          size="lg"
          disabled={isSaving || stations.length === 0}
          className={cn('w-full justify-center', savedFlash && 'bg-ok hover:bg-ok')}
        >
          {isSaving ? (
            <>
              <Loader2 className="animate-spin" />
              Saving…
            </>
          ) : savedFlash ? (
            <>
              <Check />
              Saved
            </>
          ) : (
            <>
              <Check />
              Save QSO
              <Kbd className="ml-1.5 bg-[rgba(5,16,24,0.2)] border-[rgba(5,16,24,0.2)] text-[#051018]">⏎</Kbd>
            </>
          )}
        </Button>
      </form>
    </Card>
  );
}
