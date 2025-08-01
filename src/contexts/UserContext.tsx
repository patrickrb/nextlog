'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  email: string;
  name: string;
  callsign?: string;
  grid_locator?: string;
  role?: string;
  status?: string;
}

interface UserContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchUser = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/user', {
        credentials: 'include',
        cache: 'no-store' // Ensure we always get fresh data
      });
      
      if (response.status === 401) {
        setUser(null);
        return;
      }
      
      // Handle 500 errors that might indicate database tables don't exist
      if (response.status === 500) {
        try {
          const errorText = await response.text();
          if (errorText.includes('relation "users" does not exist') || errorText.includes('42P01')) {
            // Database tables don't exist - this is expected during first install
            console.log('Database tables not found - installation may be needed');
            setUser(null);
            return;
          }
        } catch {
          console.log('Could not read error response text');
          setUser(null);
          return;
        }
      }
      
      if (!response.ok) {
        setUser(null);
        return;
      }
      
      const data = await response.json();
      if (response.ok) {
        setUser(data.user);
      } else {
        setError(data.error || 'Failed to fetch user');
      }
    } catch (err) {
      setError('Network error');
      console.error('Error fetching user:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    setLoading(true);
    await fetchUser();
  }, [fetchUser]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      router.push('/');
    } catch (err) {
      console.error('Logout error:', err);
    }
  }, [router]);

  useEffect(() => {
    fetchUser();
    
    // Listen for storage events to detect login/logout from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth-refresh') {
        fetchUser();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom auth events
    const handleAuthChange = () => {
      fetchUser();
    };
    
    window.addEventListener('auth-refresh', handleAuthChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-refresh', handleAuthChange);
    };
  }, [fetchUser]);

  const value: UserContextType = {
    user,
    loading,
    error,
    refreshUser,
    logout,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}