'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from "next/link";
import { Loader2 } from 'lucide-react';

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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Checking system status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Nextlog
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Amateur Radio Logging Software
          </p>
          <p className="text-lg text-gray-500 dark:text-gray-400 mb-12 max-w-2xl mx-auto">
            Log your amateur radio contacts from anywhere. Built with Next.js
            and PostgreSQL for modern, reliable amateur radio logging.
          </p>

          <div className="flex gap-4 justify-center">
            <Link
              href="/login"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-medium transition-colors"
            >
              Register
            </Link>
          </div>
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Contact Logging
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Log your amateur radio contacts with detailed information
              including frequency, mode, RST, and QSL status.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Search & Filter
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Quickly find contacts using powerful search and filtering options
              by callsign, date, band, and more.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Export Data
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Export your logbook data in various formats including ADIF for use
              with other amateur radio software.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
