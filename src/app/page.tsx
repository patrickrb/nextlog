'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from "next/link";
import { Loader2, Radio, Search, Download, Globe, Calendar, Users, BarChart3, Antenna, Map } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  const checkInstallationStatus = useCallback(async () => {
    try {
      const userResponse = await fetch('/api/user');
      
      if (userResponse.status === 500) {
        const errorText = await userResponse.text();
        
        if (errorText.includes('relation "users" does not exist') || errorText.includes('42P01')) {
          router.push('/install');
          setTimeout(() => {
            window.location.href = '/install';
          }, 1000);
          return;
        } else {
          router.push('/install');
          setTimeout(() => {
            window.location.href = '/install';
          }, 1000);
          return;
        }
      }
    } catch (error) {
      console.error('Installation check failed:', error);
      router.push('/install');
      return;
    }
    
    setIsChecking(false);
  }, [router]);

  useEffect(() => {
    checkInstallationStatus();
  }, [checkInstallationStatus]);

  if (isChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-muted-foreground">Checking system status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gradient-to-br from-background via-background to-muted/20 min-h-screen">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16 lg:py-24">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-primary/10 rounded-full">
              <Radio className="h-16 w-16 text-primary" />
            </div>
          </div>
          <h1 className="text-5xl lg:text-7xl font-bold text-foreground mb-6 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Nextlog
          </h1>
          <p className="text-2xl lg:text-3xl text-muted-foreground mb-6 font-light">
            Modern Amateur Radio Logging
          </p>
          <p className="text-lg text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed">
            Experience the future of amateur radio logging with a powerful, web-based platform. 
            Built for hams, by hams, with modern technology that works seamlessly across all your devices.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/login"
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 rounded-lg font-medium transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 border border-primary"
            >
              <Users className="w-5 h-5 inline mr-2" />
              Login
            </Link>
            <Link
              href="/register"
              className="bg-secondary hover:bg-secondary/80 text-secondary-foreground px-8 py-4 rounded-lg font-medium transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 border border-border"
            >
              <Radio className="w-5 h-5 inline mr-2" />
              Get Started
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-20 lg:mt-28">
          <h2 className="text-3xl lg:text-4xl font-bold text-center text-foreground mb-4">
            Everything You Need
          </h2>
          <p className="text-lg text-muted-foreground text-center mb-16 max-w-2xl mx-auto">
            Comprehensive amateur radio logging with all the features modern operators expect
          </p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-card rounded-xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-border hover:border-primary/20 group">
              <div className="p-3 bg-primary/10 rounded-lg w-fit mb-6 group-hover:bg-primary/20 transition-colors">
                <Radio className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-card-foreground mb-4">
                Contact Logging
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Log contacts with detailed information including frequency, mode, power, RST reports, 
                QSL status, and comprehensive station data.
              </p>
            </div>

            <div className="bg-card rounded-xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-border hover:border-primary/20 group">
              <div className="p-3 bg-primary/10 rounded-lg w-fit mb-6 group-hover:bg-primary/20 transition-colors">
                <Search className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-card-foreground mb-4">
                Advanced Search
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Find contacts instantly with powerful filtering by callsign, date ranges, 
                bands, modes, countries, and custom criteria.
              </p>
            </div>

            <div className="bg-card rounded-xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-border hover:border-primary/20 group">
              <div className="p-3 bg-primary/10 rounded-lg w-fit mb-6 group-hover:bg-primary/20 transition-colors">
                <Download className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-card-foreground mb-4">
                ADIF Import/Export
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Seamlessly import and export logbook data in ADIF format. 
                Compatible with all major logging software and contest programs.
              </p>
            </div>

            <div className="bg-card rounded-xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-border hover:border-primary/20 group">
              <div className="p-3 bg-primary/10 rounded-lg w-fit mb-6 group-hover:bg-primary/20 transition-colors">
                <Globe className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-card-foreground mb-4">
                QRZ.com Integration
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Automatic callsign lookup with QRZ.com integration. Get operator info, 
                location data, and photos with just a click.
              </p>
            </div>

            <div className="bg-card rounded-xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-border hover:border-primary/20 group">
              <div className="p-3 bg-primary/10 rounded-lg w-fit mb-6 group-hover:bg-primary/20 transition-colors">
                <BarChart3 className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-card-foreground mb-4">
                Awards Tracking
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Track progress toward DXCC, WAS, and other amateur radio awards. 
                Visual progress indicators and achievement tracking.
              </p>
            </div>

            <div className="bg-card rounded-xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-border hover:border-primary/20 group">
              <div className="p-3 bg-primary/10 rounded-lg w-fit mb-6 group-hover:bg-primary/20 transition-colors">
                <Map className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-card-foreground mb-4">
                Station Management
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Manage multiple stations, antennas, and equipment configurations. 
                Perfect for club stations and portable operations.
              </p>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="mt-20 lg:mt-28 text-center">
          <div className="bg-card border border-border rounded-2xl p-8 lg:p-12 shadow-xl">
            <h2 className="text-3xl lg:text-4xl font-bold text-card-foreground mb-6">
              Ready to Get Started?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join thousands of amateur radio operators using Nextlog for their logging needs. 
              Set up your account in minutes and start logging contacts today.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 rounded-lg font-medium transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 text-lg border border-primary"
            >
              <Antenna className="w-6 h-6 mr-2" />
              Start Logging Now
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
