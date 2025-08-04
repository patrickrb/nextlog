'use client';

import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Plus, Search, ChevronDown } from 'lucide-react';

export default function ContactsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center space-x-1">
          <span>Contacts</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56" style={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }}>
        <DropdownMenuItem asChild>
          <Link href="/new-contact" className="cursor-pointer">
            <Plus className="mr-2 h-4 w-4" />
            <span>New Contact</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/search" className="cursor-pointer">
            <Search className="mr-2 h-4 w-4" />
            <span>Search Contacts</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}