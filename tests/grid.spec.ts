import { test, expect } from '@playwright/test';
import {
  isValidGrid,
  gridToLatLon,
  distanceKm,
  bearingDeg,
  compassPoint,
  gridPath,
  kmToMiles,
} from '@/lib/grid';

// Pure-function tests for the Maidenhead grid / great-circle math that powers
// the distance-and-bearing readout on the logging form. Values are checked
// against known references (grid square centers, cardinal bearings, one-degree
// equatorial arc) with tolerances that allow for the great-circle model.

test.describe('isValidGrid', () => {
  test('accepts 4-, 6-, and 8-character locators, case-insensitively', () => {
    expect(isValidGrid('FN31')).toBe(true);
    expect(isValidGrid('FN31pr')).toBe(true);
    expect(isValidGrid('FN31pr55')).toBe(true); // 8-char extended locator
    expect(isValidGrid('io91')).toBe(true);
    expect(isValidGrid(' JN58 ')).toBe(true);
    expect(isValidGrid('jn58td99')).toBe(true);
  });

  test('rejects malformed locators', () => {
    expect(isValidGrid('')).toBe(false);
    expect(isValidGrid('F1')).toBe(false); // too short
    expect(isValidGrid('SN31')).toBe(false); // field letter past R
    expect(isValidGrid('FN31YZ')).toBe(false); // subsquare past X
    expect(isValidGrid('FNXY')).toBe(false); // square must be digits
    expect(isValidGrid('FN31p')).toBe(false); // odd length
    expect(isValidGrid('FN31pr5')).toBe(false); // odd length (extended pair)
    expect(isValidGrid('FN31prAB')).toBe(false); // extended square must be digits
    expect(isValidGrid('FN3155')).toBe(false); // can't skip the subsquare level
  });
});

test.describe('gridToLatLon', () => {
  test('returns the center of a 4-character square', () => {
    // JJ00 straddles the prime meridian / equator origin of the grid; its
    // center sits half a square (1° lon, 0.5° lat) up from the corner.
    expect(gridToLatLon('JJ00')).toEqual({ lat: 0.5, lon: 1 });
  });

  test('places well-known squares near their real cities', () => {
    const fn31 = gridToLatLon('FN31');
    expect(fn31).not.toBeNull();
    expect(fn31!.lat).toBeCloseTo(41.5, 5); // Connecticut
    expect(fn31!.lon).toBeCloseTo(-73, 5);

    const io91 = gridToLatLon('IO91');
    expect(io91!.lat).toBeCloseTo(51.5, 5); // London
    expect(io91!.lon).toBeCloseTo(-1, 5);
  });

  test('6-character locator refines within its parent square', () => {
    const sub = gridToLatLon('FN31pr');
    expect(sub).not.toBeNull();
    // Still inside FN31 (lat 41–42, lon -74…-72).
    expect(sub!.lat).toBeGreaterThan(41);
    expect(sub!.lat).toBeLessThan(42);
    expect(sub!.lon).toBeGreaterThan(-74);
    expect(sub!.lon).toBeLessThan(-72);
  });

  test('8-character locator refines within its parent subsquare', () => {
    // The FN31pr subsquare spans lon [-72.75, -72.6667), lat [41.7083, 41.75).
    // An extended locator must resolve to a point inside that box, close to the
    // 6-char center — the extra precision VHF/microwave operators log.
    const ext = gridToLatLon('FN31pr55');
    const sub = gridToLatLon('FN31pr');
    expect(ext).not.toBeNull();
    expect(sub).not.toBeNull();
    expect(ext!.lon).toBeGreaterThanOrEqual(-72.75);
    expect(ext!.lon).toBeLessThan(-72.6667);
    expect(ext!.lat).toBeGreaterThanOrEqual(41.7083);
    expect(ext!.lat).toBeLessThan(41.75);
    // Center-ish extended square lands near the subsquare center.
    expect(ext!.lon).toBeCloseTo(sub!.lon, 1);
    expect(ext!.lat).toBeCloseTo(sub!.lat, 1);
  });

  test('returns null for invalid input', () => {
    expect(gridToLatLon('nope')).toBeNull();
    expect(gridToLatLon('')).toBeNull();
  });
});

test.describe('distanceKm', () => {
  test('is zero for coincident points', () => {
    expect(distanceKm(0, 0, 0, 0)).toBe(0);
  });

  test('matches a one-degree arc at the equator (~111 km)', () => {
    expect(distanceKm(0, 0, 0, 1)).toBeCloseTo(111.19, 1);
  });

  test('is symmetric', () => {
    const a = distanceKm(51.5, -1, 41.5, -73);
    const b = distanceKm(41.5, -73, 51.5, -1);
    expect(a).toBeCloseTo(b, 6);
  });
});

test.describe('bearingDeg', () => {
  test('resolves the four cardinal directions from the equator', () => {
    expect(bearingDeg(0, 0, 10, 0)).toBeCloseTo(0, 5); // north
    expect(bearingDeg(0, 0, 0, 10)).toBeCloseTo(90, 5); // east
    expect(bearingDeg(0, 0, -10, 0)).toBeCloseTo(180, 5); // south
    expect(bearingDeg(0, 0, 0, -10)).toBeCloseTo(270, 5); // west
  });

  test('always returns a value in [0, 360)', () => {
    const b = bearingDeg(41.5, -73, 51.5, -1);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(360);
  });
});

test.describe('compassPoint', () => {
  test('maps bearings to 16-point compass labels', () => {
    expect(compassPoint(0)).toBe('N');
    expect(compassPoint(45)).toBe('NE');
    expect(compassPoint(90)).toBe('E');
    expect(compassPoint(180)).toBe('S');
    expect(compassPoint(270)).toBe('W');
    expect(compassPoint(360)).toBe('N'); // wraps
    expect(compassPoint(348.75)).toBe('N'); // rounds up to N
  });
});

test.describe('gridPath', () => {
  test('reports the transatlantic hop from Connecticut to London', () => {
    // FN31 → IO91 is a classic east-coast-US to England path, ~5500 km NE.
    const path = gridPath('FN31', 'IO91');
    expect(path).not.toBeNull();
    expect(path!.distanceKm).toBeGreaterThan(5000);
    expect(path!.distanceKm).toBeLessThan(6000);
    expect(path!.compass).toBe('NE');
  });

  test('returns null when either locator is invalid', () => {
    expect(gridPath('FN31', 'nope')).toBeNull();
    expect(gridPath('', 'IO91')).toBeNull();
  });

  test('accepts an 8-character locator on either end', () => {
    // Same transatlantic hop, but with an extended locator for the far end —
    // the distance/bearing readout should resolve rather than showing nothing.
    const path = gridPath('FN31pr55', 'IO91wm55');
    expect(path).not.toBeNull();
    expect(path!.distanceKm).toBeGreaterThan(5000);
    expect(path!.distanceKm).toBeLessThan(6000);
    expect(path!.compass).toBe('NE');
  });
});

test.describe('kmToMiles', () => {
  test('converts kilometers to statute miles', () => {
    expect(kmToMiles(1.609344)).toBeCloseTo(1, 6);
    expect(kmToMiles(100)).toBeCloseTo(62.137, 2);
  });
});
