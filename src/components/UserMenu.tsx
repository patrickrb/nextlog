'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User, Radio, Shield } from 'lucide-react';

interface User {
  id: number;
  email: string;
  name: string;
  callsign?: string;
  grid_locator?: string;
  role?: string;
  status?: string;
}

interface UserMenuProps {
  user: User;
}

export default function UserMenu({ user }: UserMenuProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/');
    } catch {
      // Silent error handling for logout
    }
  };

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const isAdmin = user.role === 'admin';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center rounded-full p-0.5 hover:opacity-90 transition-opacity cursor-pointer"
          aria-label="User menu"
        >
          <Avatar className="h-9 w-9 border border-line-hi">
            <AvatarImage src="" alt={user.name} />
            <AvatarFallback className="text-sm font-mono font-semibold bg-accent-soft text-accent-hi">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none text-fg">{user.name}</p>
            <p className="text-xs leading-none text-fg-2">
              {user.callsign || user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isAdmin && (
          <>
            <DropdownMenuItem asChild>
              <Link href="/admin">
                <Shield className="mr-2 h-4 w-4" />
                <span>Admin Panel</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild>
          <Link href="/stations">
            <Radio className="mr-2 h-4 w-4" />
            <span>Stations</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
