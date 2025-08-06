'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import ThemeToggleButton from '@/components/ThemeToggleButton';
import SearchInput from '@/components/SearchInput';
import { ContactsMenu, ToolsMenu, DataMenu } from '@/components/navigation';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User, Radio } from 'lucide-react';

// Standalone Navbar Demo Component
function DemoNavbar() {
  const mockUser = {
    id: 1,
    email: 'demo@example.com',
    name: 'Demo User',
    callsign: 'W1AW',
    grid_locator: 'FN31',
    role: 'user',
    status: 'active'
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <nav className="border-b bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-6">
            <Link href="/dashboard" className="text-xl font-semibold hover:text-primary">
              Nextlog
            </Link>
            
            {/* Navigation Menus */}
            <div className="hidden md:flex items-center space-x-1">
              <ContactsMenu />
              <ToolsMenu />
              <DataMenu />
            </div>
            
            <span className="mx-2 text-muted-foreground">/</span>
            <h1 className="text-xl font-semibold">Demo Page</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Search Input */}
            <div className="hidden lg:block">
              <SearchInput className="w-64" />
            </div>
            
            {/* Default new contact button */}
            <Button asChild>
              <Link href="/new-contact">
                New Contact
              </Link>
            </Button>
            
            <ThemeToggleButton />
            
            {/* Mock User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center space-x-2 rounded-full p-1 hover:bg-accent hover:text-accent-foreground transition-colors">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-sm font-medium bg-primary/10 text-primary">
                      {getInitials(mockUser.name)}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{mockUser.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {mockUser.callsign || mockUser.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/stations" className="cursor-pointer">
                    <Radio className="mr-2 h-4 w-4" />
                    <span>Stations</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default function NavbarDemoPage() {
  return (
    <div className="min-h-screen bg-background">
      <DemoNavbar />
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-card border rounded-lg p-8 text-center">
            <h1 className="text-3xl font-bold mb-4">Navbar Layout Demo with Search</h1>
            <p className="text-muted-foreground mb-6">
              This page demonstrates the improved navbar layout with dropdown navigation menus and the new callsign search functionality.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8">
              <div className="bg-muted/50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">🔍 Search Input</h3>
                <p className="text-sm text-muted-foreground">
                  Callsign search with autocomplete and navigation to advanced search
                </p>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">📞 Contacts Menu</h3>
                <p className="text-sm text-muted-foreground">
                  Contains New Contact and Search Contacts
                </p>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">🛠️ Tools Menu</h3>
                <p className="text-sm text-muted-foreground">
                  Contains Awards, Propagation, DXpeditions, and QSL Cards
                </p>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">📊 Data Menu</h3>
                <p className="text-sm text-muted-foreground">
                  Contains Statistics and ADIF Import/Export
                </p>
              </div>
            </div>
            
            <div className="mt-8 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
              <h3 className="font-semibold mb-2">🆕 New Search Feature</h3>
              <ul className="text-sm text-left space-y-1">
                <li>• Added search input to navbar with callsign autocomplete</li>
                <li>• Provides suggestions from user&apos;s existing contacts</li>
                <li>• Shows callsign, name, QTH, and contact count</li>
                <li>• Supports keyboard navigation and direct search</li>
                <li>• Navigates to advanced search with selected callsign pre-filled</li>
              </ul>
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <h3 className="font-semibold mb-2">✅ Previous Improvements</h3>
              <ul className="text-sm text-left space-y-1">
                <li>• Organized navigation into logical dropdown menus</li>
                <li>• Removed cluttered individual buttons from navbar</li>
                <li>• Maintained responsive design with hidden mobile menus</li>
                <li>• Simplified UserMenu to focus on user-specific actions</li>
                <li>• Preserved existing breadcrumb and theme functionality</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}