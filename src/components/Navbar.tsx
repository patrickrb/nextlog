'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus, Search, ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { BrandLockup } from '@/components/ui/brand-mark';
import { Chip } from '@/components/ui/chip';
import { Dot } from '@/components/ui/dot';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUser } from '@/contexts/UserContext';
import UserMenu from '@/components/UserMenu';
import ThemeToggleButton from '@/components/ThemeToggleButton';
import SearchInput from '@/components/SearchInput';
import { cn } from '@/lib/utils';

interface NavbarProps {
  actions?: React.ReactNode;
  /** @deprecated use `<PageHeader>` inside the page instead */
  title?: string;
  /** @deprecated use `<PageHeader>` inside the page instead */
  breadcrumbs?: Array<{ label: string; href?: string }>;
}

const PRIMARY_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/new-contact', label: 'Log QSO' },
  { href: '/search', label: 'Search' },
  { href: '/awards', label: 'Awards' },
  { href: '/stats', label: 'Stats' },
  { href: '/stations', label: 'Stations' },
];

const MORE_LINKS = [
  { href: '/propagation', label: 'Propagation' },
  { href: '/dxpeditions', label: 'DXpeditions' },
  { href: '/qsl-cards', label: 'QSL Cards' },
  { href: '/adif', label: 'ADIF Import/Export' },
  { href: '/lotw', label: 'LoTW' },
];

export default function Navbar({ actions }: NavbarProps) {
  // Legacy `title`/`breadcrumbs` props are accepted for backwards-compat
  // but no longer rendered — pages now use <PageHeader> for that.
  const { user } = useUser();
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname?.startsWith(href);

  return (
    <header
      className="sticky top-0 z-50 flex items-center gap-7 px-6 lg:px-8 py-4 border-b border-line"
      style={{
        background: 'rgb(from var(--bg) r g b / 0.72)',
        backdropFilter: 'saturate(140%) blur(14px)',
        WebkitBackdropFilter: 'saturate(140%) blur(14px)',
      }}
    >
      <BrandLockup href="/dashboard" />

      <nav className="hidden md:flex items-center gap-1 ml-2">
        {PRIMARY_LINKS.map((link) => {
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'px-3.5 py-2 rounded-[8px] text-[15px] transition-colors',
                active
                  ? 'bg-accent/10 text-accent'
                  : 'text-fg-1 hover:bg-white/5 hover:text-fg'
              )}
            >
              {link.label}
            </Link>
          );
        })}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="px-3 py-2 rounded-[8px] text-[15px] text-fg-1 hover:bg-white/5 hover:text-fg transition-colors inline-flex items-center gap-1 cursor-pointer">
              More
              <ChevronDown className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            {MORE_LINKS.map((link) => (
              <DropdownMenuItem key={link.href} asChild>
                <Link href={link.href}>{link.label}</Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      <div className="ml-auto flex items-center gap-3">
        {user?.callsign ? (
          <Chip variant="default" className="hidden sm:inline-flex">
            <Dot tone="ok" live />
            {user.callsign}
          </Chip>
        ) : null}

        <div className="hidden lg:block">
          <SearchInput className="w-56" />
        </div>

        {actions ?? (
          <Button asChild size="default" className="hidden sm:inline-flex">
            <Link href="/new-contact">
              <Plus />
              Log QSO
            </Link>
          </Button>
        )}

        <Link href="/search" className="lg:hidden" aria-label="Search">
          <Button variant="secondary" size="icon" type="button">
            <Search />
          </Button>
        </Link>

        <ThemeToggleButton />
        {user && <UserMenu user={user} />}
      </div>
    </header>
  );
}
