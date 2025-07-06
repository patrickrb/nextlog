'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import UserMenu from '@/components/UserMenu';

interface NavbarProps {
  title?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: React.ReactNode;
}

export default function Navbar({ title, breadcrumbs, actions }: NavbarProps) {
  const { user } = useUser();

  return (
    <nav className="border-b bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/dashboard" className="text-xl font-semibold hover:text-primary">
              NodeLog
            </Link>
            
            {breadcrumbs && breadcrumbs.length > 0 && (
              <>
                {breadcrumbs.map((crumb, index) => (
                  <React.Fragment key={index}>
                    <span className="mx-2 text-muted-foreground">/</span>
                    {crumb.href ? (
                      <Link href={crumb.href} className="hover:text-primary">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span>{crumb.label}</span>
                    )}
                  </React.Fragment>
                ))}
              </>
            )}
            
            {title && !breadcrumbs && (
              <>
                <span className="mx-2 text-muted-foreground">/</span>
                <h1 className="text-xl font-semibold">{title}</h1>
              </>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Custom actions for specific pages */}
            {actions}
            
            {/* Default navigation buttons */}
            {!actions && (
              <>
                <Button asChild>
                  <Link href="/new-contact">
                    <Plus className="h-4 w-4 mr-2" />
                    New Contact
                  </Link>
                </Button>
              </>
            )}
            
            {user && <UserMenu user={user} />}
          </div>
        </div>
      </div>
    </nav>
  );
}