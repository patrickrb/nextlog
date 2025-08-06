'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

interface CallsignSuggestion {
  value: string;
  label: string;
  secondary?: string;
  contactCount: number;
  lastContact: string;
}

interface SearchInputProps {
  className?: string;
}

export default function SearchInput({ className }: SearchInputProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<CallsignSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const fetchSuggestions = useCallback(async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setSuggestions([]);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/contacts/callsigns?search=${encodeURIComponent(searchTerm)}&limit=8`);
      
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.callsigns || []);
      } else {
        setSuggestions([]);
      }
    } catch (error) {
      console.error('Error fetching callsign suggestions:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSuggestions(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search, fetchSuggestions]);

  const handleSelectCallsign = (callsign: string) => {
    setOpen(false);
    setSearch('');
    setSuggestions([]);
    // Navigate to advanced search with the selected callsign pre-filled
    router.push(`/search?callsign=${encodeURIComponent(callsign)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle Enter key to search for current input
    if (e.key === 'Enter' && search.trim()) {
      e.preventDefault();
      handleSelectCallsign(search.trim().toUpperCase());
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`justify-between bg-background ${className}`}
        >
          <div className="flex items-center">
            <Search className="h-4 w-4 mr-2 opacity-50" />
            <span className="text-muted-foreground">Search callsigns...</span>
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type a callsign..."
            value={search}
            onValueChange={setSearch}
            onKeyDown={handleKeyDown}
          />
          <CommandList>
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Searching...
              </div>
            ) : suggestions.length === 0 && search.trim() ? (
              <CommandEmpty>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">No callsigns found.</p>
                  <p className="text-xs text-muted-foreground">
                    Press Enter to search for &ldquo;{search.toUpperCase()}&rdquo;
                  </p>
                </div>
              </CommandEmpty>
            ) : suggestions.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Start typing to search callsigns...
              </div>
            ) : (
              <CommandGroup>
                {suggestions.map((suggestion) => (
                  <CommandItem
                    key={suggestion.value}
                    value={suggestion.value}
                    onSelect={() => handleSelectCallsign(suggestion.value)}
                    className="cursor-pointer"
                  >
                    <div className="flex flex-col w-full">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{suggestion.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {suggestion.contactCount} contact{suggestion.contactCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {suggestion.secondary && (
                        <span className="text-xs text-muted-foreground">
                          {suggestion.secondary}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
                {search.trim() && !suggestions.find(s => s.value.toUpperCase() === search.trim().toUpperCase()) && (
                  <CommandItem
                    value={search.trim().toUpperCase()}
                    onSelect={() => handleSelectCallsign(search.trim().toUpperCase())}
                    className="cursor-pointer border-t"
                  >
                    <div className="flex items-center w-full">
                      <Search className="h-4 w-4 mr-2 opacity-50" />
                      <span>Search for &ldquo;{search.trim().toUpperCase()}&rdquo;</span>
                    </div>
                  </CommandItem>
                )}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}