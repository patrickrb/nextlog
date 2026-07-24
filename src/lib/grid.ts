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

// Validation helper for form/API inputs where the grid is optional: returns null
// when the field is blank OR a well-formed locator, and a human-readable error
// message otherwise. Centralizing this on isValidGrid keeps the logging form and
// the stations API from re-deriving their own regex — which is how they drifted
// behind the 8-char (extended) locators the rest of the app already accepts,
// silently rejecting a valid VHF/microwave grid on save.
export function gridLocatorError(grid: string): string | null {
  if (!grid.trim()) return null;
  return isValidGrid(grid)
    ? null
    : 'Invalid grid locator format (e.g., FN31, FN31pr, or FN31pr55)';
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

const EARTH_RADIUS_KM = 6371;

// Length of a full great circle around the Earth (2πR). The short path between
// two points and its long-path complement always sum to this, so long-path
// distance is just `EARTH_CIRCUMFERENCE_KM - shortPathKm`.
export const EARTH_CIRCUMFERENCE_KM = 2 * Math.PI * EARTH_RADIUS_KM;

const toRad = (deg: number): number => (deg * Math.PI) / 180;
const toDeg = (rad: number): number => (rad * 180) / Math.PI;

// Great-circle distance in kilometers between two points (haversine, R = 6371km).
export function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = EARTH_RADIUS_KM;
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

// Long-path bearing: the heading around the *other* side of the globe, exactly
// 180° opposed to the short-path bearing. HF DX frequently arrives long-path, so
// operators swing the beam this way when the short path is dead. Normalized into
// [0, 360) so it feeds compassPoint like any other bearing.
export function longPathBearingDeg(shortBearing: number): number {
  return ((shortBearing + 180) % 360 + 360) % 360;
}

// Long-path distance: the rest of the great circle once the short path is
// removed. short + long always sums to the Earth's circumference.
export function longPathKm(shortKm: number): number {
  return EARTH_CIRCUMFERENCE_KM - shortKm;
}

export interface PathInfo {
  distanceKm: number;
  bearingDeg: number;
  compass: string;
  // Long-path complement — the beam heading and arc the other way around the
  // globe, for the HF openings that favor the long path.
  longPathKm: number;
  longPathBearingDeg: number;
  longPathCompass: string;
}

// Distance/bearing between two Maidenhead locators. Returns null unless both
// parse — so a half-typed grid in the logging form simply shows nothing rather
// than a bogus reading.
export function gridPath(from: string, to: string): PathInfo | null {
  const a = gridToLatLon(from);
  const b = gridToLatLon(to);
  if (!a || !b) return null;
  const bearing = bearingDeg(a.lat, a.lon, b.lat, b.lon);
  const dist = distanceKm(a.lat, a.lon, b.lat, b.lon);
  const lpBearing = longPathBearingDeg(bearing);
  return {
    distanceKm: dist,
    bearingDeg: bearing,
    compass: compassPoint(bearing),
    longPathKm: longPathKm(dist),
    longPathBearingDeg: lpBearing,
    longPathCompass: compassPoint(lpBearing),
  };
}

// Pick the operator's transmitting grid for the distance/bearing readout on the
// logging form. A QSO is made from the *station actually on the air*, which for
// a POTA/portable/rover operator is often a different grid than their home
// account — so the on-air station's locator wins, falling back to the account
// home grid. A blank or malformed value at either level is ignored (rather than
// yielding a bogus origin), and the winner is normalized to trimmed uppercase so
// it feeds gridToLatLon like any other locator. Returns null when neither
// resolves, so the readout simply shows nothing.
export function resolveOriginGrid(
  stationGrid: string | null | undefined,
  homeGrid: string | null | undefined,
): string | null {
  for (const grid of [stationGrid, homeGrid]) {
    if (grid && isValidGrid(grid)) return grid.trim().toUpperCase();
  }
  return null;
}

const KM_PER_MILE = 1.609344;

// Kilometers → statute miles (US operators log distance in miles as often as km).
export function kmToMiles(km: number): number {
  return km / KM_PER_MILE;
}
