import React from 'react';
import { Radio } from 'lucide-react';

import { Chip } from '@/components/ui/chip';

interface PreviousContact {
  id: number;
  datetime: string;
  band: string;
  mode: string;
  frequency: number | string;
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
  callsign?: string;
}

function formatStamp(datetime: string) {
  const date = new Date(datetime);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} · ${hh}:${min} UTC`;
}

export default function PreviousContacts({ contacts, loading, error, callsign }: PreviousContactsProps) {
  if (loading) {
    return (
      <div className="px-5 py-4 space-y-2 animate-pulse">
        <div className="h-3 bg-bg-2 rounded w-40" />
        <div className="h-3 bg-bg-2 rounded w-2/3" />
        <div className="h-3 bg-bg-2 rounded w-1/2" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-5 text-sm text-bad bg-bad/10 border border-bad/20 rounded-[10px] p-3">
        Error loading previous contacts: {error}
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-fg-2">
        <Radio className="h-7 w-7 mx-auto mb-2 opacity-50" />
        <p className="text-sm">
          {callsign?.trim()
            ? `No prior QSOs with ${callsign}.`
            : 'Enter a callsign to see prior contacts.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {contacts.map((contact) => (
        <div
          key={contact.id}
          className="grid items-center gap-2 px-5 py-3.5 border-b border-line last:border-b-0"
          style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}
        >
          <div className="min-w-0">
            <div className="font-mono text-[13px] text-fg-2">
              {formatStamp(contact.datetime)}
            </div>
            <div className="flex gap-1.5 mt-1.5">
              <Chip size="sm">{contact.band}</Chip>
              <Chip size="sm">{contact.mode}</Chip>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-sm text-fg-1">
              {contact.rst_sent ?? '-'} / {contact.rst_received ?? '-'}
            </div>
            {contact.name ? (
              <div className="text-[12px] text-fg-2 truncate max-w-[160px]">
                {contact.name}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
