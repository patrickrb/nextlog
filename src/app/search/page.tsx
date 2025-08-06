'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Search, Filter, Download, RotateCcw, ArrowLeft, Table as TableIcon, Map } from 'lucide-react';
import EditContactDialog from '@/components/EditContactDialog';
import Pagination from '@/components/Pagination';
import Navbar from '@/components/Navbar';
import LotwSyncIndicator from '@/components/LotwSyncIndicator';
import DynamicContactMap from '@/components/DynamicContactMap';
import { useUser } from '@/contexts/UserContext';

interface Contact {
  id: number;
  callsign: string;
  frequency: number;
  mode: string;
  band: string;
  datetime: string;
  rst_sent?: string;
  rst_received?: string;
  name?: string;
  qth?: string;
  grid_locator?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  confirmed?: boolean;
  // LoTW fields
  lotw_qsl_rcvd?: string;
  lotw_qsl_sent?: string;
  qsl_lotw?: boolean;
  qsl_lotw_date?: string;
  lotw_match_status?: 'confirmed' | 'partial' | 'mismatch' | null;
}

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

interface DXCCEntity {
  adif: number;
  name: string;
  prefix: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const MODES = ['AM', 'FM', 'FT8', 'MFSK', 'RTTY', 'SSB', 'CW', 'FT4', 'PSK31', 'DMR', 'DSTAR', 'YSF'];
const BANDS = ['2m', '6m', '10m', '12m', '15m', '17m', '20m', '30m', '40m', '60m', '80m', '160m', '70cm', '23cm'];

export default function SearchPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [dxccEntities, setDxccEntities] = useState<DXCCEntity[]>([]);
  const [dxccLoading, setDxccLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');
  
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

  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  const { user } = useUser();
  const router = useRouter();

  // Fetch DXCC entities
  const fetchDxccEntities = useCallback(async () => {
    try {
      setDxccLoading(true);
      const response = await fetch('/api/dxcc');
      
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      
      const data = await response.json();
      if (response.ok) {
        setDxccEntities(data.entities || []);
      } else {
        console.error('Failed to fetch DXCC entities:', data.error);
      }
    } catch (error) {
      console.error('Error fetching DXCC entities:', error);
    } finally {
      setDxccLoading(false);
    }
  }, [router]);

  // Load DXCC entities on mount
  useEffect(() => {
    fetchDxccEntities();
  }, [fetchDxccEntities]);

  // Convert DXCC entities to combobox options
  const dxccOptions = useMemo(() => {
    const options = dxccEntities.map((entity) => ({
      value: entity.adif.toString(),
      label: entity.name,
      secondary: entity.prefix
    }));
    
    // Add "All DXCC entities" option at the beginning
    return [
      { value: 'all', label: 'All DXCC entities', secondary: undefined },
      ...options
    ];
  }, [dxccEntities]);

  const performSearch = useCallback(async (searchFilters: SearchFilters, page = 1) => {
    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        ...Object.fromEntries(
          Object.entries(searchFilters).filter(([, value]) => value.trim() !== '')
        )
      });

      const response = await fetch(`/api/contacts/search?${params}`);
      
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      
      const data = await response.json();
      
      if (response.ok) {
        setContacts(data.contacts || []);
        setPagination({
          page: data.pagination.page,
          limit: data.pagination.limit,
          total: data.pagination.total,
          pages: data.pagination.pages
        });
      } else {
        setError(data.error || 'Failed to search contacts');
      }
    } catch (error) {
      console.error('Search error:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, router]);

  // Debounced search function
  const debouncedSearch = useCallback((searchFilters: SearchFilters, page = 1) => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      performSearch(searchFilters, page);
    }, 300);

    setSearchTimeout(timeout);
  }, [searchTimeout, performSearch]);

  // Handle filter changes with debouncing
  const handleFilterChange = (key: keyof SearchFilters, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    
    // Reset to page 1 when filters change
    debouncedSearch(newFilters, 1);
  };

  // Quick filter handlers
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
    debouncedSearch(newFilters, 1);
  };

  // Clear all filters
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
    setContacts([]);
    setPagination({ page: 1, limit: 20, total: 0, pages: 0 });
  };

  // Export search results
  const handleExport = async () => {
    try {
      setExportLoading(true);
      
      const params = new URLSearchParams({
        ...Object.fromEntries(
          Object.entries(filters).filter(([, value]) => value.trim() !== '')
        ),
        export: 'true'
      });

      const response = await fetch(`/api/contacts/search?${params}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        
        const contentDisposition = response.headers.get('Content-Disposition');
        const filename = contentDisposition 
          ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
          : 'search-results.adi';
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to export search results');
      }
    } catch (error) {
      console.error('Export error:', error);
      setError('Export failed. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleContactClick = (contact: Contact) => {
    setSelectedContact(contact);
    setIsEditDialogOpen(true);
  };

  const handleContactSave = (updatedContact: Contact) => {
    setContacts(prevContacts => 
      prevContacts.map(contact => 
        contact.id === updatedContact.id ? updatedContact : contact
      )
    );
  };

  const handleContactDelete = (deletedContactId: number) => {
    setContacts(prevContacts => 
      prevContacts.filter(contact => contact.id !== deletedContactId)
    );
    // Update pagination total count
    setPagination(prev => ({
      ...prev,
      total: prev.total - 1
    }));
  };

  const handleDialogClose = () => {
    setIsEditDialogOpen(false);
    setSelectedContact(null);
  };

  const handlePageChange = (page: number) => {
    performSearch(filters, page);
  };

  const handlePageSizeChange = (limit: number) => {
    setPagination(prev => ({ ...prev, limit }));
    performSearch(filters, 1);
  };

  // Get active filter count for display
  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter(value => value.trim() !== '' && value !== 'all').length;
  }, [filters]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar 
        title="Search Contacts" 
        actions={
          <div className="flex items-center space-x-2">
            <Button variant="ghost" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
          </div>
        }
      />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 space-y-6">
          {/* Search Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Search Contacts</h1>
              <p className="text-muted-foreground">
                Find contacts using advanced filtering and search options
              </p>
            </div>
            {contacts.length > 0 && (
              <Button onClick={handleExport} disabled={exportLoading} variant="outline">
                {exportLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Export Results
              </Button>
            )}
          </div>

          {/* Search Filters */}
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    {showAdvancedFilters ? 'Hide' : 'Show'} Advanced
                  </Button>
                  {activeFilterCount > 0 && (
                    <Button variant="outline" size="sm" onClick={clearAllFilters}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Clear All
                    </Button>
                  )}
                </div>
              </div>
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

              {/* Advanced Filters */}
              {showAdvancedFilters && (
                <>
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
                      <Label htmlFor="dxcc">DXCC Entity</Label>
                      <Combobox
                        options={dxccOptions}
                        value={filters.dxcc}
                        onValueChange={(value) => handleFilterChange('dxcc', value)}
                        placeholder="Search DXCC entities..."
                        searchPlaceholder="Search countries, prefixes..."
                        emptyText="No DXCC entity found."
                        disabled={dxccLoading}
                      />
                      {dxccLoading && (
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Loading DXCC entities...</span>
                        </div>
                      )}
                      <p className="text-sm text-muted-foreground">
                        Filter contacts by DXCC entity (country/territory). Search by country name or prefix.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Search Results */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Search Results</CardTitle>
                  <CardDescription>
                    {pagination.total > 0 
                      ? `Found ${pagination.total} contact${pagination.total === 1 ? '' : 's'}`
                      : 'No contacts found with current filters'
                    }
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  {/* View Mode Toggle */}
                  {contacts.length > 0 && (
                    <div className="flex items-center border rounded-md">
                      <Button
                        variant={viewMode === 'table' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('table')}
                        className="rounded-r-none"
                      >
                        <TableIcon className="h-4 w-4 mr-2" />
                        Table
                      </Button>
                      <Button
                        variant={viewMode === 'map' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('map')}
                        className="rounded-l-none"
                      >
                        <Map className="h-4 w-4 mr-2" />
                        Map
                      </Button>
                    </div>
                  )}
                  {loading && (
                    <div className="flex items-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Searching...</span>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {pagination.total === 0 && !loading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    {activeFilterCount === 0 
                      ? 'Enter search criteria above to find contacts.'
                      : 'No contacts match your search criteria. Try adjusting your filters.'
                    }
                  </p>
                </div>
              ) : viewMode === 'map' ? (
                <>
                  <div className="mb-4">
                    <DynamicContactMap 
                      contacts={contacts} 
                      user={user} 
                      height="500px"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p>
                      🏠 Red markers show your QTH location • 📻 Blue markers show contact locations
                      {contacts.filter(c => (c.latitude && c.longitude) || c.grid_locator).length < contacts.length && (
                        <span className="block mt-1">
                          Note: Only contacts with location data (coordinates or grid locator) are displayed on the map.
                        </span>
                      )}
                    </p>
                  </div>
                  {pagination.pages > 1 && (
                    <div className="mt-4">
                      <Pagination
                        currentPage={pagination.page}
                        totalPages={pagination.pages}
                        pageSize={pagination.limit}
                        totalItems={pagination.total}
                        onPageChange={handlePageChange}
                        onPageSizeChange={handlePageSizeChange}
                        pageSizeOptions={[10, 20, 50, 100]}
                      />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Callsign</TableHead>
                          <TableHead>Date/Time</TableHead>
                          <TableHead>Frequency</TableHead>
                          <TableHead>Mode</TableHead>
                          <TableHead>Band</TableHead>
                          <TableHead>RST</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>QTH</TableHead>
                          <TableHead>LoTW</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading && contacts.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center py-8">
                              <div className="flex items-center justify-center space-x-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Searching contacts...</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          contacts.map((contact) => (
                            <TableRow 
                              key={contact.id} 
                              className="cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => handleContactClick(contact)}
                            >
                              <TableCell className="font-medium">
                                {contact.callsign}
                              </TableCell>
                              <TableCell>
                                {formatDate(contact.datetime)}
                              </TableCell>
                              <TableCell>
                                {contact.frequency} MHz
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{contact.mode}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{contact.band}</Badge>
                              </TableCell>
                              <TableCell>
                                {contact.rst_sent}/{contact.rst_received}
                              </TableCell>
                              <TableCell>
                                {contact.name || '-'}
                              </TableCell>
                              <TableCell>
                                {contact.qth || '-'}
                              </TableCell>
                              <TableCell>
                                <LotwSyncIndicator
                                  lotwQslSent={contact.lotw_qsl_sent}
                                  lotwQslRcvd={contact.lotw_qsl_rcvd}
                                  qslLotw={contact.qsl_lotw}
                                  qslLotwDate={contact.qsl_lotw_date}
                                  lotwMatchStatus={contact.lotw_match_status}
                                  size="sm"
                                />
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {pagination.pages > 1 && (
                    <Pagination
                      currentPage={pagination.page}
                      totalPages={pagination.pages}
                      pageSize={pagination.limit}
                      totalItems={pagination.total}
                      onPageChange={handlePageChange}
                      onPageSizeChange={handlePageSizeChange}
                      pageSizeOptions={[10, 20, 50, 100]}
                    />
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <EditContactDialog
        contact={selectedContact}
        isOpen={isEditDialogOpen}
        onClose={handleDialogClose}
        onSave={handleContactSave}
        onDelete={handleContactDelete}
      />
    </div>
  );
}