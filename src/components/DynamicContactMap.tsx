'use client';

import dynamic from 'next/dynamic';

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
  latitude?: number;
  longitude?: number;
}

interface User {
  id: number;
  email: string;
  name: string;
  callsign?: string;
  grid_locator?: string;
}

interface ContactMapProps {
  contacts: Contact[];
  user?: User | null;
  height?: string;
}

const ContactMap = dynamic(() => import('./ContactMap'), {
  ssr: false,
  loading: () => (
    <div 
      className="w-full bg-muted rounded-lg flex items-center justify-center border" 
      style={{ height: '400px' }}
    >
      <div className="flex items-center space-x-2">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span>Loading map...</span>
      </div>
    </div>
  )
});

export default function DynamicContactMap(props: ContactMapProps) {
  return <ContactMap {...props} />;
}