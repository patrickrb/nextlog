'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface InstallationCheckerProps {
  children: React.ReactNode;
}

export default function InstallationChecker({ children }: InstallationCheckerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);

  const checkInstallation = useCallback(async () => {
    // Skip installation check for demo pages
    if (pathname === '/filter-chips-demo' || pathname === '/search-demo' || pathname === '/navbar-demo') {
      setIsChecking(false);
      return;
    }

    try {
      const response = await fetch('/api/install/check');
      
      if (response.ok) {
        const data = await response.json();
        
        if (!data.isInstalled && pathname !== '/install') {
          window.location.replace('/install');
          return;
        }
        
        if (data.isInstalled && pathname === '/install') {
          router.push('/dashboard');
          return;
        }
      } else {
        if (pathname !== '/install') {
          window.location.replace('/install');
          return;
        }
      }
    } catch (error) {
      console.error('Installation check failed:', error);
      if (pathname !== '/install') {
        window.location.replace('/install');
        return;
      }
    }
    
    setIsChecking(false);
  }, [router, pathname]);

  useEffect(() => {
    checkInstallation();
  }, [checkInstallation]);

  // Show loading screen while checking
  if (isChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-muted-foreground">Checking system status...</p>
        </div>
      </div>
    );
  }

  // Render children if checks are complete
  return <>{children}</>;
}