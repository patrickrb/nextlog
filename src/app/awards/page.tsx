'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Trophy, MapPin, Radio, Zap, ArrowRight, Loader2, Star } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { useUser } from '@/contexts/UserContext';

interface AwardPreview {
  name: string;
  description: string;
  icon: React.ReactNode;
  progress?: {
    current: number;
    total: number;
    percentage: number;
  };
  href: string;
  status: 'available' | 'in_progress' | 'completed' | 'coming_soon';
}

export default function AwardsPage() {
  const [pageLoading, setPageLoading] = useState(true);
  const [wasProgress, setWasProgress] = useState<{
    overall_progress: {
      confirmed_states: number;
      total_states: number;
      confirmed_percentage: number;
      worked_states: number;
    };
    statistics: {
      completed_awards: number;
    };
  } | null>(null);

  const { user, loading: userLoading } = useUser();
  const router = useRouter();

  const loadAwardsPreviews = useCallback(async () => {
    try {
      setPageLoading(true);

      // Load WAS progress for preview
      const wasResponse = await fetch('/api/awards/was/summary');
      if (wasResponse.ok) {
        const wasData = await wasResponse.json();
        if (wasData.success) {
          setWasProgress(wasData.data);
        }
      }
    } catch (error) {
      console.error('Failed to load awards previews:', error);
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    // Wait for user context to finish loading
    if (userLoading) return;
    
    // Redirect to login if no user
    if (!user) {
      router.push('/login');
      return;
    }
    
    // Load awards data
    loadAwardsPreviews();
  }, [user, userLoading, router, loadAwardsPreviews]);

  const getWASStatus = (): 'available' | 'in_progress' | 'completed' => {
    if (!wasProgress) return 'available';
    if (wasProgress.overall_progress.confirmed_states >= 50) return 'completed';
    if (wasProgress.overall_progress.worked_states > 0) return 'in_progress';
    return 'available';
  };

  const awards: AwardPreview[] = [
    {
      name: 'WAS - Worked All States',
      description: 'Work and confirm all 50 US states for the prestigious Worked All States award',
      icon: <MapPin className="h-8 w-8" />,
      progress: wasProgress ? {
        current: wasProgress.overall_progress.confirmed_states,
        total: wasProgress.overall_progress.total_states,
        percentage: wasProgress.overall_progress.confirmed_percentage
      } : undefined,
      href: '/awards/was',
      status: getWASStatus()
    },
    {
      name: 'DXCC - DX Century Club',
      description: 'Work and confirm 100 different DXCC entities worldwide',
      icon: <Trophy className="h-8 w-8" />,
      href: '/awards/dxcc',
      status: 'coming_soon'
    },
    {
      name: 'WPX - Worked All Prefixes',
      description: 'Work different amateur radio prefixes from around the world',
      icon: <Radio className="h-8 w-8" />,
      href: '/awards/wpx',
      status: 'coming_soon'
    },
    {
      name: 'Worked All Continents',
      description: 'Work and confirm all 6 continents for the WAC award',
      icon: <Zap className="h-8 w-8" />,
      href: '/awards/wac',
      status: 'coming_soon'
    },
    {
      name: 'Worked All Zones',
      description: 'Work all 40 CQ zones for the WAZ award',
      icon: <Star className="h-8 w-8" />,
      href: '/awards/waz',
      status: 'coming_soon'
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
      case 'coming_soon':
        return <Badge variant="outline">Coming Soon</Badge>;
      default:
        return <Badge variant="secondary">Available</Badge>;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'border-green-200 bg-green-50';
      case 'in_progress':
        return 'border-blue-200 bg-blue-50';
      case 'coming_soon':
        return 'border-gray-200 bg-gray-50';
      default:
        return 'border-gray-200 hover:border-gray-300';
    }
  };

  if (pageLoading || userLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar title="Awards" actions={
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
              <span className="text-lg">Loading awards...</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar 
        title="Awards" 
        actions={
          <Button variant="ghost" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
        }
      />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 space-y-8">
          
          {/* Header */}
          <div className="text-center">
            <Trophy className="h-16 w-16 text-blue-600 mx-auto mb-4" />
            <h1 className="text-4xl font-bold text-foreground mb-2">Amateur Radio Awards</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Track your progress toward prestigious amateur radio awards. Work contacts, 
              confirm QSLs, and earn recognition for your achievements.
            </p>
          </div>

          {/* Quick Stats */}
          {wasProgress && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {wasProgress.overall_progress.worked_states}
                    </p>
                    <p className="text-sm text-muted-foreground">States Worked</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {wasProgress.overall_progress.confirmed_states}
                    </p>
                    <p className="text-sm text-muted-foreground">States Confirmed</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-600">
                      {wasProgress.statistics.completed_awards}
                    </p>
                    <p className="text-sm text-muted-foreground">Awards Earned</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-600">
                      {awards.filter(a => a.status === 'in_progress').length}
                    </p>
                    <p className="text-sm text-muted-foreground">In Progress</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Awards Grid */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-foreground">Available Awards</h2>
              <p className="text-sm text-muted-foreground">
                {awards.filter(a => a.status === 'available' || a.status === 'in_progress').length} awards available
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {awards.map((award) => (
                <Card 
                  key={award.name} 
                  className={`cursor-pointer transition-all hover:shadow-lg ${getStatusColor(award.status)}`}
                >
                  {award.status === 'coming_soon' ? (
                    <div className="opacity-60">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="text-muted-foreground">
                              {award.icon}
                            </div>
                            <div>
                              <CardTitle className="text-lg">{award.name}</CardTitle>
                            </div>
                          </div>
                          {getStatusBadge(award.status)}
                        </div>
                        <CardDescription className="mt-2">
                          {award.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center py-4">
                          <p className="text-sm text-muted-foreground">Coming Soon</p>
                        </div>
                      </CardContent>
                    </div>
                  ) : (
                    <Link href={award.href}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={award.status === 'completed' ? 'text-green-600' : 
                                           award.status === 'in_progress' ? 'text-blue-600' : 'text-gray-600'}>
                              {award.icon}
                            </div>
                            <div>
                              <CardTitle className="text-lg">{award.name}</CardTitle>
                            </div>
                          </div>
                          {getStatusBadge(award.status)}
                        </div>
                        <CardDescription className="mt-2">
                          {award.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {award.progress ? (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Progress:</span>
                              <span className="font-medium">
                                {award.progress.current}/{award.progress.total}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  award.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
                                }`}
                                style={{ width: `${award.progress.percentage}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{award.progress.percentage}% complete</span>
                              <ArrowRight className="h-4 w-4" />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">Click to start tracking</p>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </CardContent>
                    </Link>
                  )}
                </Card>
              ))}
            </div>
          </div>

          {/* Info Section */}
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-lg text-blue-900">About Amateur Radio Awards</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-blue-800">
                <div>
                  <h4 className="font-medium mb-2">How Awards Work</h4>
                  <ul className="space-y-1 text-blue-700">
                    <li>• Make contacts with required stations/entities</li>
                    <li>• Obtain QSL confirmations as required</li>
                    <li>• Submit application with verification</li>
                    <li>• Receive official award certificate</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Nextlog Features</h4>
                  <ul className="space-y-1 text-blue-700">
                    <li>• Automatic progress tracking</li>
                    <li>• QSL confirmation integration</li>
                    <li>• Export award applications</li>
                    <li>• Visual progress indicators</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}