// Maidenhead grid ↔ coordinate math plus great-circle distance/bearing — the
// shared source of truth for turning a grid square (or a lat/lon pair) into the
// "how far, which way" readout operators expect while logging.
//
// Like @/lib/bands this module is intentionally free of server-only imports
// (no `pg`, no db pool) so the logging forms can pull it into the browser
// bundle without dragging the database driver along.

export interface LatLon {
  lat: number;
  lon: number;
}

// 4-char (field+square), 6-char (+subsquare), or 8-char (+extended square)
// Maidenhead locator. The extended-square pair can only follow a subsquare —
// you can't skip a level (e.g. `FN3155` is invalid).
const GRID_RE = /^[A-R]{2}[0-9]{2}([A-X]{2}([0-9]{2})?)?$/;

// True for a well-formed 4-, 6-, or 8-character Maidenhead locator
// (case-insensitive). VHF/UHF/microwave and satellite operators log 8-char
// (extended) locators for the extra precision, so they must validate too.
export function isValidGrid(grid: string): boolean {
  return GRID_RE.test(grid.trim().toUpperCase());
}

// Convert a Maidenhead locator to the latitude/longitude of the *center* of the
// square (4-char), subsquare (6-char), or extended square (8-char). Returns
// null for anything that isn't a valid locator. Centering matches
// @/components/ContactLocationMap so the map pin and the distance readout agree.
export function gridToLatLon(grid: string): LatLon | null {
  const g = grid.trim().toUpperCase();
  if (!GRID_RE.test(g)) return null;

  const lonField = g.charCodeAt(0) - 65; // A–R → 0–17, 20° wide
  const latField = g.charCodeAt(1) - 65; // A–R → 0–17, 10° tall
  const lonSquare = Number(g[2]); // 0–9, 2° wide
  const latSquare = Number(g[3]); // 0–9, 1° tall

  let lon = -180 + lonField * 20 + lonSquare * 2;
  let lat = -90 + latField * 10 + latSquare * 1;

  if (g.length >= 6) {
    const lonSub = g.charCodeAt(4) - 65; // A–X → 0–23, 5' wide (2°/24)
    const latSub = g.charCodeAt(5) - 65; // A–X → 0–23, 2.5' tall (1°/24)
    lon += lonSub * (2 / 24);
    lat += latSub * (1 / 24);
  }

  if (g.length === 8) {
    // Extended square: 2 digits (0–9) dividing the subsquare into a 10×10 grid,
    // so each cell is 30" lon × 15" lat. Offset to the digit, then half a cell
    // more to land on the center.
    const lonExt = Number(g[6]); // 0–9, 2°/240 wide
    const latExt = Number(g[7]); // 0–9, 1°/240 tall
    lon += lonExt * (2 / 240) + 1 / 240; // + half an extended square to center
    lat += latExt * (1 / 240) + 1 / 480;
  } else if (g.length === 6) {
    lon += 1 / 24; // + half a subsquare to center
    lat += 1 / 48;
  } else {
    lon += 1; // + half a square (2°) to center
    lat += 0.5; // + half a square (1°) to center
  }

  return { lat, lon };
}

const toRad = (deg: number): number => (deg * Math.PI) / 180;
const toDeg = (rad: number): number => (rad * 180) / Math.PI;

// Great-circle distance in kilometers between two points (haversine, R = 6371km).
export function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Initial great-circle bearing from point 1 to point 2, in degrees 0–360
// (0 = due north, 90 = east). This is the heading to point an antenna.
export function bearingDeg(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const COMPASS_POINTS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
] as const;

// 16-point compass label for a bearing in degrees, e.g. 45 → 'NE'.
export function compassPoint(bearing: number): string {
  const idx = Math.round((((bearing % 360) + 360) % 360) / 22.5) % 16;
  return COMPASS_POINTS[idx];
}

export interface PathInfo {
  distanceKm: number;
  bearingDeg: number;
  compass: string;
}

// Distance/bearing between two Maidenhead locators. Returns null unless both
// parse — so a half-typed grid in the logging form simply shows nothing rather
// than a bogus reading.
export function gridPath(from: string, to: string): PathInfo | null {
  const a = gridToLatLon(from);
  const b = gridToLatLon(to);
  if (!a || !b) return null;
  const bearing = bearingDeg(a.lat, a.lon, b.lat, b.lon);
  return {
    distanceKm: distanceKm(a.lat, a.lon, b.lat, b.lon),
    bearingDeg: bearing,
    compass: compassPoint(bearing),
  };
}

const KM_PER_MILE = 1.609344;

// Kilometers → statute miles (US operators log distance in miles as often as km).
export function kmToMiles(km: number): number {
  return km / KM_PER_MILE;
}
