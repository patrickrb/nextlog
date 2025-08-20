'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix for default markers in React Leaflet
delete (L.Icon.Default.prototype as L.Icon.Default & { _getIconUrl?: () => string })._getIconUrl;
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
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface ContactLocation {
  callsign: string;
  name?: string;
  qth?: string;
  grid_locator?: string;
  latitude?: number;
  longitude?: number;
  country?: string;
}

interface User {
  id: number;
  email: string;
  name: string;
  callsign?: string;
  grid_locator?: string;
}

interface ContactLocationMapProps {
  contact: ContactLocation;
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

// Component to handle map bounds fitting after markers are loaded
function MapBoundsController({ contact, user }: { contact: ContactLocation, user?: User | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (!map) return;
    
    // Collect all marker positions
    const allPositions: [number, number][] = [];
    
    // Add user's QTH if available
    if (user?.grid_locator) {
      const userLocation = gridToLatLng(user.grid_locator);
      if (userLocation) {
        allPositions.push(userLocation);
      }
    }
    
    // Add contact position
    let contactPosition: [number, number] | null = null;
    if (contact.latitude && contact.longitude) {
      contactPosition = [contact.latitude, contact.longitude];
    } else if (contact.grid_locator) {
      contactPosition = gridToLatLng(contact.grid_locator);
    }
    
    if (contactPosition) {
      allPositions.push(contactPosition);
    }
    
    // Fit bounds to show all markers
    if (allPositions.length > 0) {
      if (allPositions.length === 1) {
        // If only one position, center on it with reasonable zoom
        map.setView(allPositions[0], 8);
      } else {
        // If multiple positions, fit bounds with padding
        const bounds = L.latLngBounds(allPositions);
        map.fitBounds(bounds, { 
          padding: [20, 20],
          maxZoom: 10 // Prevent zooming in too much
        });
      }
    } else {
      // Fallback to default view if no contact location
      const mapCenter: [number, number] = user?.grid_locator 
        ? (gridToLatLng(user.grid_locator) || [39.8283, -98.5795])
        : [39.8283, -98.5795];
      map.setView(mapCenter, user?.grid_locator ? 8 : 4);
    }
  }, [map, contact, user]);
  
  return null;
}

export default function ContactLocationMap({ contact, user, height = '300px' }: ContactLocationMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-full bg-muted rounded-lg flex items-center justify-center" style={{ height }}>
      <span className="text-muted-foreground">Loading map...</span>
    </div>;
  }

  // Check if contact has location data
  const hasContactLocation = (contact.latitude && contact.longitude) || 
                            (contact.grid_locator && contact.grid_locator.length >= 4);

  if (!hasContactLocation) {
    return (
      <div className="w-full bg-muted/50 rounded-lg border border-dashed border-muted-foreground/50 flex items-center justify-center text-center p-6" style={{ height }}>
        <div>
          <p className="text-muted-foreground font-medium">📍 No Location Data</p>
          <p className="text-sm text-muted-foreground mt-1">
            Location information not available for this callsign
          </p>
        </div>
      </div>
    );
  }

  // Determine initial map center
  const getInitialMapCenter = (): [number, number] => {
    // Try contact location first
    if (contact.latitude && contact.longitude) {
      return [contact.latitude, contact.longitude];
    } else if (contact.grid_locator) {
      const contactLocation = gridToLatLng(contact.grid_locator);
      if (contactLocation) return contactLocation;
    }
    
    // Fallback to user location
    if (user?.grid_locator) {
      const userLocation = gridToLatLng(user.grid_locator);
      if (userLocation) return userLocation;
    }
    
    // Default center (US center)
    return [39.8283, -98.5795];
  };

  const initialMapCenter = getInitialMapCenter();

  return (
    <div className="w-full rounded-lg overflow-hidden border" style={{ height }}>
      <MapContainer
        center={initialMapCenter}
        zoom={8}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Component to handle automatic bounds fitting */}
        <MapBoundsController contact={contact} user={user} />
        
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
        
        {/* Contact marker */}
        {(() => {
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
            <Marker position={position} icon={contactIcon}>
              <Popup>
                <div className="min-w-[200px]">
                  <h3 className="font-semibold text-lg text-green-600">📻 {contact.callsign}</h3>
                  {contact.name && <p className="text-sm text-muted-foreground">{contact.name}</p>}
                  <div className="mt-2 space-y-1 text-sm">
                    {contact.qth && <p><strong>QTH:</strong> {contact.qth}</p>}
                    {contact.grid_locator && (
                      <p><strong>Grid:</strong> {contact.grid_locator}</p>
                    )}
                    {contact.country && (
                      <p><strong>Country:</strong> {contact.country}</p>
                    )}
                    {contact.latitude && contact.longitude && (
                      <p><strong>Coords:</strong> {contact.latitude.toFixed(4)}, {contact.longitude.toFixed(4)}</p>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })()}
      </MapContainer>
    </div>
  );
}