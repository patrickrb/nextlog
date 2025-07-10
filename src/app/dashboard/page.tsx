'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import DynamicContactMap from '@/components/DynamicContactMap';
import EditContactDialog from '@/components/EditContactDialog';
import Navbar from '@/components/Navbar';
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
}

export default function DashboardPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { user } = useUser();
  const router = useRouter();

  const fetchContacts = useCallback(async () => {
    try {
      const response = await fetch('/api/contacts');
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      
      const data = await response.json();
      if (response.ok) {
        setContacts(data.contacts || []);
      } else {
        setError(data.error || 'Failed to fetch contacts');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

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

  const handleDialogClose = () => {
    setIsEditDialogOpen(false);
    setSelectedContact(null);
  };

  if (loading) {
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
              <CardTitle>Recent Contacts</CardTitle>
              <CardDescription>
                Your amateur radio contact log
              </CardDescription>
            </CardHeader>
            <CardContent>
              {contacts.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    No contacts logged yet. Start by{' '}
                    <Link
                      href="/dashboard/new-contact"
                      className="text-primary hover:underline"
                    >
                      adding your first contact
                    </Link>
                    .
                  </p>
                </div>
              ) : (
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((contact) => (
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
      />
    </div>
  );
}