'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, BarChart3, TrendingUp } from 'lucide-react';
import DynamicContactMap from '@/components/DynamicContactMap';
import EditContactDialog from '@/components/EditContactDialog';
import DXpeditionWidget from '@/components/DXpeditionWidget';
import Pagination from '@/components/Pagination';
import Navbar from '@/components/Navbar';
import LotwSyncIndicator from '@/components/LotwSyncIndicator';
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

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function DashboardPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });
  const [recentContactsCount, setRecentContactsCount] = useState<number>(0);
  const { user } = useUser();
  const router = useRouter();

  const fetchContacts = useCallback(async (page = pagination.page, limit = pagination.limit) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/contacts?page=${page}&limit=${limit}`);
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
        setError(data.error || 'Failed to fetch contacts');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [pagination.page, pagination.limit, router]);

  const fetchRecentContactsCount = useCallback(async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const response = await fetch(`/api/contacts?since=${thirtyDaysAgo.toISOString()}&countOnly=true`);
      if (response.ok) {
        const data = await response.json();
        setRecentContactsCount(data.count || 0);
      }
    } catch (error) {
      console.error('Error fetching recent contacts count:', error);
    }
  }, []);

  useEffect(() => {
    fetchContacts(1, 20); // Initial load with default pagination
    fetchRecentContactsCount(); // Load recent contacts count
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

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
    fetchContacts(page, pagination.limit);
  };

  const handlePageSizeChange = (limit: number) => {
    fetchContacts(1, limit); // Reset to first page when changing page size
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-lg">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar title="Dashboard" />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total QSOs</p>
                    <p className="text-2xl font-bold">{pagination.total.toLocaleString()}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Recent Activity</p>
                    <p className="text-2xl font-bold">{recentContactsCount.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">contacts in last 30 days</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">View Detailed</p>
                  <p className="text-sm text-muted-foreground">Statistics & Analysis</p>
                </div>
                <Button asChild>
                  <Link href="/stats">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Statistics
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left side - Map and Contacts Table */}
            <div className="lg:col-span-3 space-y-6">
              {/* Contact Map */}
              <Card>
                <CardHeader>
                  <CardTitle>Contact Map</CardTitle>
                  <CardDescription>
                    Geographic view of your contacts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {error && (
                    <div className="bg-destructive/15 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm mb-4">
                      {error}
                    </div>
                  )}

                  <DynamicContactMap contacts={contacts} user={user} height="400px" />
                </CardContent>
              </Card>

              {/* Recent Contacts Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Contacts</CardTitle>
                  <CardDescription>
                    Your amateur radio contact log ({pagination.total} total contacts)
                  </CardDescription>
                </CardHeader>
                <CardContent>
              {pagination.total === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    No contacts logged yet. Start by{' '}
                    <Link
                      href="/new-contact"
                      className="text-primary hover:underline"
                    >
                      adding your first contact
                    </Link>
                    .
                  </p>
                </div>
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
                          <TableHead>LoTW</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8">
                              <div className="flex items-center justify-center space-x-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Loading contacts...</span>
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
            
            {/* Right side - DXpeditions Widget */}
            <div className="lg:col-span-1">
              <div className="sticky top-6">
                <DXpeditionWidget limit={8} />
              </div>
            </div>
          </div>
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