'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

interface MaidenheadGridOverlayProps {
  visible: boolean;
}

// Function to generate maidenhead field letter (A-R)
const getFieldLetter = (index: number): string => {
  return String.fromCharCode(65 + index); // A=65, B=66, etc.
};

// Function to generate maidenhead grid lines and labels
const generateMaidenheadGrid = (map: L.Map): L.LayerGroup => {
  const gridGroup = new L.LayerGroup();
  const bounds = map.getBounds();
  const zoom = map.getZoom();
  
  // Only show major grid squares at lower zoom levels
  const showSubSquares = zoom >= 6;
  const showSubSubSquares = zoom >= 9;
  
  // Major grid fields (20° x 10°)
  for (let lonField = 0; lonField < 18; lonField++) {
    for (let latField = 0; latField < 18; latField++) {
      const west = -180 + (lonField * 20);
      const east = west + 20;
      const south = -90 + (latField * 10);
      const north = south + 10;
      
      // Skip if not in current view
      if (east < bounds.getWest() || west > bounds.getEast() || 
          north < bounds.getSouth() || south > bounds.getNorth()) {
        continue;
      }
      
      // Draw field boundaries
      const fieldBounds: L.LatLngBoundsExpression = [[south, west], [north, east]] as L.LatLngBoundsExpression;
      const fieldRect = L.rectangle(fieldBounds, {
        color: '#FF0000',
        weight: 2,
        fillOpacity: 0,
        interactive: false
      });
      gridGroup.addLayer(fieldRect);
      
      // Add field label (e.g., "FN")
      const fieldLabel = getFieldLetter(lonField) + getFieldLetter(latField);
      const fieldCenter: L.LatLngExpression = [(south + north) / 2, (west + east) / 2] as L.LatLngExpression;
      const fieldMarker = L.marker(fieldCenter, {
        icon: L.divIcon({
          className: 'maidenhead-label field-label',
          html: `<div class="font-bold text-red-600 text-lg bg-white/80 px-1 rounded">${fieldLabel}</div>`,
          iconSize: [40, 20],
          iconAnchor: [20, 10]
        }),
        interactive: false
      });
      gridGroup.addLayer(fieldMarker);
      
      // Draw squares within field (2° x 1°)
      if (showSubSquares) {
        for (let lonSquare = 0; lonSquare < 10; lonSquare++) {
          for (let latSquare = 0; latSquare < 10; latSquare++) {
            const squareWest = west + (lonSquare * 2);
            const squareEast = squareWest + 2;
            const squareSouth = south + (latSquare * 1);
            const squareNorth = squareSouth + 1;
            
            // Skip if not in current view
            if (squareEast < bounds.getWest() || squareWest > bounds.getEast() || 
                squareNorth < bounds.getSouth() || squareSouth > bounds.getNorth()) {
              continue;
            }
            
            // Draw square boundaries
            const squareBounds: L.LatLngBoundsExpression = [[squareSouth, squareWest], [squareNorth, squareEast]] as L.LatLngBoundsExpression;
            const squareRect = L.rectangle(squareBounds, {
              color: '#0066CC',
              weight: 1,
              fillOpacity: 0,
              interactive: false
            });
            gridGroup.addLayer(squareRect);
            
            // Add square label (e.g., "31")
            if (zoom >= 7) {
              const squareLabel = lonSquare.toString() + latSquare.toString();
              const squareCenter: L.LatLngExpression = [(squareSouth + squareNorth) / 2, (squareWest + squareEast) / 2] as L.LatLngExpression;
              const squareMarker = L.marker(squareCenter, {
                icon: L.divIcon({
                  className: 'maidenhead-label square-label',
                  html: `<div class="text-blue-600 text-sm bg-white/70 px-1 rounded">${squareLabel}</div>`,
                  iconSize: [24, 16],
                  iconAnchor: [12, 8]
                }),
                interactive: false
              });
              gridGroup.addLayer(squareMarker);
            }
            
            // Draw subsquares within square (5' x 2.5')
            if (showSubSubSquares) {
              for (let lonSubSquare = 0; lonSubSquare < 24; lonSubSquare++) {
                for (let latSubSquare = 0; latSubSquare < 24; latSubSquare++) {
                  const subSquareWest = squareWest + (lonSubSquare * 2/24);
                  const subSquareEast = subSquareWest + (2/24);
                  const subSquareSouth = squareSouth + (latSubSquare * 1/24);
                  const subSquareNorth = subSquareSouth + (1/24);
                  
                  // Skip if not in current view
                  if (subSquareEast < bounds.getWest() || subSquareWest > bounds.getEast() || 
                      subSquareNorth < bounds.getSouth() || subSquareSouth > bounds.getNorth()) {
                    continue;
                  }
                  
                  // Draw subsquare boundaries (lighter)
                  const subSquareBounds: L.LatLngBoundsExpression = [[subSquareSouth, subSquareWest], [subSquareNorth, subSquareEast]] as L.LatLngBoundsExpression;
                  const subSquareRect = L.rectangle(subSquareBounds, {
                    color: '#00CC66',
                    weight: 0.5,
                    fillOpacity: 0,
                    interactive: false
                  });
                  gridGroup.addLayer(subSquareRect);
                  
                  // Add subsquare label only at very high zoom
                  if (zoom >= 11) {
                    const subSquareLabel = getFieldLetter(lonSubSquare).toLowerCase() + 
                                         getFieldLetter(latSubSquare).toLowerCase();
                    const subSquareCenter: L.LatLngExpression = [(subSquareSouth + subSquareNorth) / 2, (subSquareWest + subSquareEast) / 2] as L.LatLngExpression;
                    const subSquareMarker = L.marker(subSquareCenter, {
                      icon: L.divIcon({
                        className: 'maidenhead-label subsquare-label',
                        html: `<div class="text-green-600 text-xs bg-white/60 px-1 rounded">${subSquareLabel}</div>`,
                        iconSize: [16, 12],
                        iconAnchor: [8, 6]
                      }),
                      interactive: false
                    });
                    gridGroup.addLayer(subSquareMarker);
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  
  return gridGroup;
};

export default function MaidenheadGridOverlay({ visible }: MaidenheadGridOverlayProps) {
  const map = useMap();
  
  useEffect(() => {
    let gridLayer: L.LayerGroup | null = null;
    
    const updateGrid = () => {
      // Remove existing grid
      if (gridLayer) {
        map.removeLayer(gridLayer);
        gridLayer = null;
      }
      
      // Add new grid if visible
      if (visible) {
        gridLayer = generateMaidenheadGrid(map);
        map.addLayer(gridLayer);
      }
    };
    
    // Initial grid update
    updateGrid();
    
    // Update grid when map moves or zooms
    const handleMapUpdate = () => {
      if (visible) {
        updateGrid();
      }
    };
    
    map.on('moveend', handleMapUpdate);
    map.on('zoomend', handleMapUpdate);
    
    // Cleanup
    return () => {
      if (gridLayer) {
        map.removeLayer(gridLayer);
      }
      map.off('moveend', handleMapUpdate);
      map.off('zoomend', handleMapUpdate);
    };
  }, [map, visible]);
  
  return null; // This component doesn't render anything visible itself
}