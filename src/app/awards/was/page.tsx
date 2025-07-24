'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { useUser } from '@/contexts/UserContext';
import WASProgressDashboard from '@/components/awards/WASProgressDashboard';

interface Station {
  id: number;
  callsign: string;
  station_name: string;
  is_default: boolean;
}

export default function WASPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { user } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      // Don't redirect if still loading from UserContext
      if (!loading) {
        router.push('/login');
      }
      return;
    }
    if (user) {
      loadStations();
    }
  }, [user, router, loading]);

  const loadStations = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/stations');
      if (response.ok) {
        const data = await response.json();
        setStations(data.stations || []);
      } else {
        setError('Failed to load stations');
      }
    } catch (err) {
      console.error('Failed to load stations:', err);
      setError('Failed to load stations');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar title="WAS Progress" actions={
          <Button variant="ghost" asChild>
            <Link href="/awards">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Awards
            </Link>
          </Button>
        } />
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin mr-2" />
              <span className="text-lg">Loading WAS progress...</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar title="WAS Progress" actions={
          <Button variant="ghost" asChild>
            <Link href="/awards">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Awards
            </Link>
          </Button>
        } />
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="text-center py-16">
              <p className="text-red-600 mb-4">{error}</p>
              <Button onClick={loadStations}>
                Try Again
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar 
        title="WAS Progress" 
        actions={
          <Button variant="ghost" asChild>
            <Link href="/awards">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Awards
            </Link>
          </Button>
        }
      />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <WASProgressDashboard stations={stations} />
        </div>
      </main>
    </div>
  );
}