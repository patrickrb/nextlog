'use client';

import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Trophy, Radio, ChevronDown, Globe, CreditCard } from 'lucide-react';

export default function ToolsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center space-x-1">
          <span>Tools</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56" style={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }}>
        <DropdownMenuItem asChild>
          <Link href="/awards" className="cursor-pointer">
            <Trophy className="mr-2 h-4 w-4" />
            <span>Awards</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/propagation" className="cursor-pointer">
            <Radio className="mr-2 h-4 w-4" />
            <span>Propagation</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dxpeditions" className="cursor-pointer">
            <Globe className="mr-2 h-4 w-4" />
            <span>DXpeditions</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/qsl-cards" className="cursor-pointer">
            <CreditCard className="mr-2 h-4 w-4" />
            <span>QSL Cards</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}