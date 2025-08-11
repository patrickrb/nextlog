'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, RotateCcw, X } from 'lucide-react';

interface SearchFilters {
  callsign: string;
  name: string;
  qth: string;
  mode: string;
  band: string;
  gridLocator: string;
  startDate: string;
  endDate: string;
  quickFilter: string;
  qslStatus: string;
  dxcc: string;
}

interface FilterChip {
  key: keyof SearchFilters;
  label: string;
  value: string;
  displayValue: string;
}

const MODES = ['AM', 'FM', 'FT8', 'MFSK', 'RTTY', 'SSB', 'CW', 'FT4', 'PSK31', 'DMR', 'DSTAR', 'YSF'];
const BANDS = ['2m', '6m', '10m', '12m', '15m', '17m', '20m', '30m', '40m', '60m', '80m', '160m', '70cm', '23cm'];

// Helper function to get active filters as chips
const getActiveFilterChips = (filters: SearchFilters): FilterChip[] => {
  const chips: FilterChip[] = [];
  
  // Text-based filters
  if (filters.callsign.trim()) {
    chips.push({
      key: 'callsign',
      label: 'Callsign',
      value: filters.callsign,
      displayValue: filters.callsign
    });
  }
  
  if (filters.name.trim()) {
    chips.push({
      key: 'name',
      label: 'Name',
      value: filters.name,
      displayValue: filters.name
    });
  }
  
  if (filters.qth.trim()) {
    chips.push({
      key: 'qth',
      label: 'QTH',
      value: filters.qth,
      displayValue: filters.qth
    });
  }
  
  if (filters.gridLocator.trim()) {
    chips.push({
      key: 'gridLocator',
      label: 'Grid',
      value: filters.gridLocator,
      displayValue: filters.gridLocator
    });
  }
  
  // Dropdown filters (exclude 'all' values)
  if (filters.mode !== 'all' && filters.mode.trim()) {
    chips.push({
      key: 'mode',
      label: 'Mode',
      value: filters.mode,
      displayValue: filters.mode
    });
  }
  
  if (filters.band !== 'all' && filters.band.trim()) {
    chips.push({
      key: 'band',
      label: 'Band',
      value: filters.band,
      displayValue: filters.band
    });
  }
  
  if (filters.qslStatus !== 'all' && filters.qslStatus.trim()) {
    const qslStatusLabels: Record<string, string> = {
      'confirmed': 'QSL Confirmed',
      'pending': 'QSL Pending',
      'not_confirmed': 'QSL Not Confirmed'
    };
    chips.push({
      key: 'qslStatus',
      label: 'QSL Status',
      value: filters.qslStatus,
      displayValue: qslStatusLabels[filters.qslStatus] || filters.qslStatus
    });
  }
  
  // DXCC filter (simulated)
  if (filters.dxcc !== 'all' && filters.dxcc.trim()) {
    const dxccLabels: Record<string, string> = {
      '291': 'United States',
      '1': 'Canada',
      '14': 'Germany',
      '15': 'Japan'
    };
    chips.push({
      key: 'dxcc',
      label: 'DXCC',
      value: filters.dxcc,
      displayValue: dxccLabels[filters.dxcc] || filters.dxcc
    });
  }
  
  // Date filters
  if (filters.startDate.trim()) {
    chips.push({
      key: 'startDate',
      label: 'From',
      value: filters.startDate,
      displayValue: new Date(filters.startDate).toLocaleDateString()
    });
  }
  
  if (filters.endDate.trim()) {
    chips.push({
      key: 'endDate',
      label: 'To',
      value: filters.endDate,
      displayValue: new Date(filters.endDate).toLocaleDateString()
    });
  }
  
  // Quick filter
  if (filters.quickFilter.trim()) {
    const quickFilterLabels: Record<string, string> = {
      'today': 'Today',
      'week': 'This Week',
      'month': 'This Month',
      'year': 'This Year'
    };
    chips.push({
      key: 'quickFilter',
      label: 'Period',
      value: filters.quickFilter,
      displayValue: quickFilterLabels[filters.quickFilter] || filters.quickFilter
    });
  }
  
  return chips;
};

// FilterChips component to display active filters
const FilterChips = ({ chips, onRemoveFilter }: { 
  chips: FilterChip[], 
  onRemoveFilter: (key: keyof SearchFilters) => void 
}) => {
  if (chips.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {chips.map((chip) => (
        <Badge 
          key={chip.key} 
          variant="secondary" 
          className="flex items-center gap-1 pr-1 cursor-pointer hover:bg-secondary/80 transition-colors border border-border"
          onClick={() => onRemoveFilter(chip.key)}
        >
          <span className="text-xs">
            <span className="font-medium">{chip.label}:</span> {chip.displayValue}
          </span>
          <X className="h-3 w-3 hover:bg-secondary-foreground/20 rounded-full p-0.5" />
        </Badge>
      ))}
    </div>
  );
};

export default function FilterChipsDemoPage() {
  const [filters, setFilters] = useState<SearchFilters>({
    callsign: '',
    name: '',
    qth: '',
    mode: 'all',
    band: 'all',
    gridLocator: '',
    startDate: '',
    endDate: '',
    quickFilter: '',
    qslStatus: 'all',
    dxcc: 'all'
  });

  const activeFilterCount = Object.values(filters).filter(value => value.trim() !== '' && value !== 'all').length;
  const activeFilterChips = getActiveFilterChips(filters);

  const handleFilterChange = (key: keyof SearchFilters, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  const removeFilter = (key: keyof SearchFilters) => {
    const newFilters = { ...filters };
    
    // Reset the specific filter to its default value
    switch (key) {
      case 'mode':
      case 'band':
      case 'qslStatus':
      case 'dxcc':
        newFilters[key] = 'all';
        break;
      case 'quickFilter':
        // When removing quick filter, also clear the auto-set date fields
        newFilters.quickFilter = '';
        if (filters.quickFilter === 'today') {
          newFilters.startDate = '';
          newFilters.endDate = '';
        } else if (filters.quickFilter) {
          newFilters.startDate = '';
        }
        break;
      default:
        newFilters[key] = '';
    }
    
    setFilters(newFilters);
  };

  const clearAllFilters = () => {
    const emptyFilters: SearchFilters = {
      callsign: '',
      name: '',
      qth: '',
      mode: 'all',
      band: 'all',
      gridLocator: '',
      startDate: '',
      endDate: '',
      quickFilter: '',
      qslStatus: 'all',
      dxcc: 'all'
    };
    setFilters(emptyFilters);
  };

  const handleQuickFilter = (period: string) => {
    const now = new Date();
    let startDate = '';
    
    switch (period) {
      case 'today':
        startDate = now.toISOString().split('T')[0];
        break;
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDate = weekAgo.toISOString().split('T')[0];
        break;
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        startDate = monthAgo.toISOString().split('T')[0];
        break;
      case 'year':
        const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        startDate = yearAgo.toISOString().split('T')[0];
        break;
      default:
        startDate = '';
    }
    
    const newFilters = { 
      ...filters, 
      quickFilter: period,
      startDate,
      endDate: period === 'today' ? startDate : ''
    };
    setFilters(newFilters);
  };

  const addSampleFilters = () => {
    setFilters({
      ...filters,
      callsign: 'W1AW',
      mode: 'FT8',
      band: '20m',
      qslStatus: 'confirmed',
      dxcc: '291'
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mock Navbar */}
      <nav className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-6">
              <span className="text-xl font-semibold">Nextlog</span>
              <span className="mx-2 text-muted-foreground">/</span>
              <h1 className="text-xl font-semibold">Filter Chips Demo</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 space-y-6">
          {/* Demo Description */}
          <div className="bg-card border rounded-lg p-6">
            <h1 className="text-3xl font-bold mb-4">🏷️ Filter Chips Feature Demo</h1>
            <p className="text-muted-foreground mb-4">
              This demonstrates the new filter chips functionality for the contact search page. 
              Users can now see and remove individual active filters at a glance.
            </p>
            
            <div className="flex gap-2 mb-4">
              <Button onClick={addSampleFilters} size="sm">
                Add Sample Filters
              </Button>
              <Button onClick={clearAllFilters} variant="outline" size="sm">
                Clear All Filters
              </Button>
            </div>
          </div>

          {/* Search Filters Card with Filter Chips */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CardTitle className="flex items-center">
                    <Search className="h-5 w-5 mr-2" />
                    Search Filters
                  </CardTitle>
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary">{activeFilterCount} active</Badge>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Show Advanced
                  </Button>
                  {activeFilterCount > 0 && (
                    <Button variant="outline" size="sm" onClick={clearAllFilters}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Clear All
                    </Button>
                  )}
                </div>
              </div>
              {/* Active Filter Chips */}
              <FilterChips chips={activeFilterChips} onRemoveFilter={removeFilter} />
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Quick Filters */}
              <div className="space-y-2">
                <Label>Quick Filters</Label>
                <div className="flex flex-wrap gap-2">
                  {['today', 'week', 'month', 'year'].map(period => (
                    <Button
                      key={period}
                      variant={filters.quickFilter === period ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleQuickFilter(period)}
                    >
                      {period.charAt(0).toUpperCase() + period.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>

              <hr className="border-border" />

              {/* Basic Search Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="callsign">Callsign</Label>
                  <Input
                    id="callsign"
                    placeholder="e.g., W1AW"
                    value={filters.callsign}
                    onChange={(e) => handleFilterChange('callsign', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="Operator name"
                    value={filters.name}
                    onChange={(e) => handleFilterChange('name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qth">QTH</Label>
                  <Input
                    id="qth"
                    placeholder="Location"
                    value={filters.qth}
                    onChange={(e) => handleFilterChange('qth', e.target.value)}
                  />
                </div>
              </div>

              {/* Mode and Band Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mode">Mode</Label>
                  <Select value={filters.mode} onValueChange={(value) => handleFilterChange('mode', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All modes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All modes</SelectItem>
                      {MODES.map(mode => (
                        <SelectItem key={mode} value={mode}>{mode}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="band">Band</Label>
                  <Select value={filters.band} onValueChange={(value) => handleFilterChange('band', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All bands" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All bands</SelectItem>
                      {BANDS.map(band => (
                        <SelectItem key={band} value={band}>{band}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Advanced Filters Section */}
              <hr className="border-border" />
              <div className="space-y-4">
                <Label className="text-base font-medium">Advanced Filters</Label>
                
                {/* Date Range */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={filters.startDate}
                      onChange={(e) => handleFilterChange('startDate', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={filters.endDate}
                      onChange={(e) => handleFilterChange('endDate', e.target.value)}
                    />
                  </div>
                </div>

                {/* Grid Locator and QSL Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gridLocator">Grid Locator</Label>
                    <Input
                      id="gridLocator"
                      placeholder="e.g., FN31pr"
                      value={filters.gridLocator}
                      onChange={(e) => handleFilterChange('gridLocator', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="qslStatus">QSL Status</Label>
                    <Select value={filters.qslStatus} onValueChange={(value) => handleFilterChange('qslStatus', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="All QSL status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All QSL status</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="not_confirmed">Not Confirmed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* DXCC Filter */}
                <div className="space-y-2">
                  <Label htmlFor="dxcc">DXCC Entity (Demo)</Label>
                  <Select value={filters.dxcc} onValueChange={(value) => handleFilterChange('dxcc', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All DXCC entities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All DXCC entities</SelectItem>
                      <SelectItem value="291">United States</SelectItem>
                      <SelectItem value="1">Canada</SelectItem>
                      <SelectItem value="14">Germany</SelectItem>
                      <SelectItem value="15">Japan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Feature Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>✨ What&apos;s New</CardTitle>
                <CardDescription>Filter chips show active filters visually</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li><strong>• Visual filter indication</strong> - See exactly which filters are active</li>
                  <li><strong>• One-click removal</strong> - Click any chip to remove that filter</li>
                  <li><strong>• Smart labeling</strong> - Human-readable labels for each filter type</li>
                  <li><strong>• Quick filter integration</strong> - Period filters show as chips too</li>
                  <li><strong>• Date formatting</strong> - Dates displayed in readable format</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>🎯 Benefits</CardTitle>
                <CardDescription>Improved user experience</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li><strong>• Better visibility</strong> - No need to scroll through form fields</li>
                  <li><strong>• Faster workflow</strong> - Remove specific filters quickly</li>
                  <li><strong>• Reduced errors</strong> - Clear indication of applied filters</li>
                  <li><strong>• Mobile friendly</strong> - Chips work well on smaller screens</li>
                  <li><strong>• Intuitive UX</strong> - Familiar chip pattern with X buttons</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}