'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Fix for default markers in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Create custom icons for different marker types
const qthIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const contactIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

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

// Function to convert grid locator to lat/lng (simplified implementation)
const gridToLatLng = (grid: string): [number, number] | null => {
  if (!grid || grid.length < 4) return null;
  
  const grid_upper = grid.toUpperCase();
  const lon_field = grid_upper.charCodeAt(0) - 65;
  const lat_field = grid_upper.charCodeAt(1) - 65;
  const lon_square = parseInt(grid_upper.charAt(2));
  const lat_square = parseInt(grid_upper.charAt(3));
  
  let lon = -180 + (lon_field * 20) + (lon_square * 2);
  let lat = -90 + (lat_field * 10) + (lat_square * 1);
  
  // Add subsquare precision if available
  if (grid.length >= 6) {
    const lon_subsquare = grid_upper.charCodeAt(4) - 65;
    const lat_subsquare = grid_upper.charCodeAt(5) - 65;
    lon += (lon_subsquare * 2/24) + (1/24);
    lat += (lat_subsquare * 1/24) + (1/48);
  } else {
    // Default to center of square
    lon += 1;
    lat += 0.5;
  }
  
  return [lat, lon];
};

export default function ContactMap({ contacts, user, height = '400px' }: ContactMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-full bg-muted rounded-lg" style={{ height }}>Loading map...</div>;
  }

  // Filter contacts that have location data
  const contactsWithLocation = contacts.filter(contact => {
    const hasCoords = contact.latitude && contact.longitude;
    const hasGrid = contact.grid_locator && contact.grid_locator.length >= 4;
    return hasCoords || hasGrid;
  });


  // Determine map center - use user's grid locator if available, otherwise default to US center
  const getMapCenter = (): [number, number] => {
    if (user?.grid_locator) {
      const userLocation = gridToLatLng(user.grid_locator);
      if (userLocation) return userLocation;
    }
    // Default center (US center)
    return [39.8283, -98.5795];
  };

  const mapCenter = getMapCenter();

  return (
    <div className="w-full rounded-lg overflow-hidden border" style={{ height }}>
      <MapContainer
        center={mapCenter}
        zoom={user?.grid_locator ? 8 : 4}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* User's QTH marker */}
        {user?.grid_locator && (() => {
          const userLocation = gridToLatLng(user.grid_locator);
          if (userLocation) {
            return (
              <Marker position={userLocation} icon={qthIcon}>
                <Popup>
                  <div className="min-w-[200px]">
                    <h3 className="font-semibold text-lg text-red-600">🏠 Your QTH</h3>
                    <div className="mt-2 space-y-1 text-sm">
                      <p><strong>Callsign:</strong> {user.callsign || 'Not set'}</p>
                      <p><strong>Name:</strong> {user.name}</p>
                      <p><strong>Grid:</strong> {user.grid_locator}</p>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          }
          return null;
        })()}
        
        {/* Contact markers */}
        {contactsWithLocation.map(contact => {
          let position: [number, number] | null = null;
          
          // Use exact coordinates if available
          if (contact.latitude && contact.longitude) {
            position = [contact.latitude, contact.longitude];
          } 
          // Otherwise convert grid locator
          else if (contact.grid_locator) {
            position = gridToLatLng(contact.grid_locator);
          }
          
          if (!position) return null;
          
          return (
            <Marker key={contact.id} position={position} icon={contactIcon}>
              <Popup>
                <div className="min-w-[200px]">
                  <h3 className="font-semibold text-lg text-blue-600">📻 {contact.callsign}</h3>
                  {contact.name && <p className="text-sm text-gray-600">{contact.name}</p>}
                  <div className="mt-2 space-y-1 text-sm">
                    <p><strong>Date:</strong> {new Date(contact.datetime).toLocaleDateString()}</p>
                    <p><strong>Frequency:</strong> {contact.frequency} MHz</p>
                    <p><strong>Mode:</strong> {contact.mode}</p>
                    <p><strong>Band:</strong> {contact.band}</p>
                    {contact.rst_sent && contact.rst_received && (
                      <p><strong>RST:</strong> {contact.rst_sent}/{contact.rst_received}</p>
                    )}
                    {contact.qth && <p><strong>QTH:</strong> {contact.qth}</p>}
                    {contact.grid_locator && (
                      <p><strong>Grid:</strong> {contact.grid_locator}</p>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}