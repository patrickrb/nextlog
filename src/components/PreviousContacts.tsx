import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Clock, Radio, Volume2 } from 'lucide-react';

interface PreviousContact {
  id: number;
  datetime: string;
  band: string;
  mode: string;
  frequency: number;
  rst_sent?: string;
  rst_received?: string;
  name?: string;
  qth?: string;
  notes?: string;
}

interface PreviousContactsProps {
  contacts: PreviousContact[];
  loading: boolean;
  error?: string;
}

export default function PreviousContacts({ contacts, loading, error }: PreviousContactsProps) {
  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-4 bg-muted rounded w-40"></div>
        <div className="border rounded-md p-4">
          <div className="space-y-2">
            <div className="h-3 bg-muted rounded w-full"></div>
            <div className="h-3 bg-muted rounded w-3/4"></div>
            <div className="h-3 bg-muted rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
        Error loading previous contacts: {error}
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="text-sm text-muted-foreground bg-muted/30 border border-border rounded-md p-4 text-center">
        <Radio className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="font-medium">No previous contacts found</p>
        <p className="text-xs mt-1">This will be your first QSO with this station</p>
      </div>
    );
  }

  const formatDateTime = (datetime: string) => {
    const date = new Date(datetime);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  const formatFrequency = (freq: number) => {
    if (freq >= 1000) {
      return `${(freq / 1000).toFixed(3)} GHz`;
    } else if (freq >= 1) {
      return `${freq.toFixed(3)} MHz`;
    } else {
      return `${(freq * 1000).toFixed(0)} kHz`;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground flex items-center">
          <Clock className="h-4 w-4 mr-1" />
          Previous Contacts ({contacts.length})
        </h4>
        {contacts.length === 10 && (
          <Badge variant="secondary" className="text-xs">
            Showing latest 10
          </Badge>
        )}
      </div>
      
      {/* Mobile-friendly card layout */}
      <div className="md:hidden space-y-2">
        {contacts.map((contact) => {
          const { date, time } = formatDateTime(contact.datetime);
          return (
            <div key={contact.id} className="border border-border rounded-md p-3 bg-card">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-xs">
                    {contact.band}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {contact.mode}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground text-right">
                  <div>{date}</div>
                  <div>{time}</div>
                </div>
              </div>
              
              <div className="text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Freq:</span>
                  <span className="font-mono">{formatFrequency(contact.frequency)}</span>
                </div>
                
                {(contact.rst_sent || contact.rst_received) && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center">
                      <Volume2 className="h-3 w-3 mr-1" />
                      RST:
                    </span>
                    <span className="font-mono text-xs">
                      {contact.rst_sent && `Sent: ${contact.rst_sent}`}
                      {contact.rst_sent && contact.rst_received && ' | '}
                      {contact.rst_received && `Rcvd: ${contact.rst_received}`}
                    </span>
                  </div>
                )}
                
                {contact.name && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Name:</span>
                    <span>{contact.name}</span>
                  </div>
                )}
                
                {contact.qth && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">QTH:</span>
                    <span className="truncate ml-2">{contact.qth}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table layout */}
      <div className="hidden md:block border border-border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Date</TableHead>
              <TableHead className="w-20">Time</TableHead>
              <TableHead className="w-16">Band</TableHead>
              <TableHead className="w-16">Mode</TableHead>
              <TableHead className="w-24">Frequency</TableHead>
              <TableHead className="w-20">RST S/R</TableHead>
              <TableHead>Name / QTH</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => {
              const { date, time } = formatDateTime(contact.datetime);
              return (
                <TableRow key={contact.id}>
                  <TableCell className="text-xs">{date}</TableCell>
                  <TableCell className="text-xs font-mono">{time}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {contact.band}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {contact.mode}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono">
                    {formatFrequency(contact.frequency)}
                  </TableCell>
                  <TableCell className="text-xs font-mono">
                    {contact.rst_sent && contact.rst_received 
                      ? `${contact.rst_sent}/${contact.rst_received}`
                      : contact.rst_sent || contact.rst_received || '-'
                    }
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="space-y-0.5">
                      {contact.name && (
                        <div className="font-medium">{contact.name}</div>
                      )}
                      {contact.qth && (
                        <div className="text-muted-foreground truncate">
                          {contact.qth}
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}