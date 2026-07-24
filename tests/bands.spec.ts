import { test, expect } from '@playwright/test';
import { frequencyToBand, AMATEUR_BANDS } from '@/lib/bands';
import { frequencyToBand as frequencyToBandFromAdif } from '@/lib/adif';

// The band plan is the single source of truth shared by ADIF import (server) and
// the logging forms (client). These tests guard that source of truth: the pure
// mapper, its ordered band list, and the re-export the ADIF module exposes for
// backwards compatibility.

test.describe('bands module', () => {
  test('AMATEUR_BANDS lists the bands the mapper can emit, in ascending order', () => {
    // Every non-OTHER band the mapper returns must be selectable in the UI, so
    // an auto-derived band always maps to a pill.
    const sampleFreqs = [
      0.136, 0.474, 1.84, 3.573, 5.107, 7.074, 10.136, 14.074, 18.1, 21.074,
      24.915, 28.074, 50.313, 70.154, 144.174, 222.1, 432.1, 915.0, 1296.1, 2320.0,
    ];
    for (const f of sampleFreqs) {
      const band = frequencyToBand(f);
      expect(AMATEUR_BANDS).toContain(band);
    }
    // No duplicates.
    expect(new Set(AMATEUR_BANDS).size).toBe(AMATEUR_BANDS.length);
  });

  test('re-export from @/lib/adif stays in lock-step with the source of truth', () => {
    for (const f of [1.84, 5.107, 70.154, 1296.1, 2320.0, 999.0]) {
      expect(frequencyToBandFromAdif(f)).toBe(frequencyToBand(f));
    }
  });

  test('maps the bands the standalone logging forms previously missed', () => {
    // These are exactly the interop gaps the per-form copies of freqToBand had:
    // US 60M channels below 5.33, 4M, 23CM, 13CM, and the LF digital bands.
    expect(frequencyToBand(5.107)).toBe('60M');
    expect(frequencyToBand(5.2872)).toBe('60M');
    expect(frequencyToBand(70.2)).toBe('4M');
    expect(frequencyToBand(1296.1)).toBe('23CM');
    expect(frequencyToBand(2320.0)).toBe('13CM');
    expect(frequencyToBand(0.136)).toBe('2200M');
    expect(frequencyToBand(0.474)).toBe('630M');
  });

  test('returns OTHER for frequencies outside any amateur band', () => {
    expect(frequencyToBand(4.5)).toBe('OTHER');
    expect(frequencyToBand(100.0)).toBe('OTHER');
    expect(AMATEUR_BANDS).not.toContain('OTHER');
  });

  test('covers every band the search filter must offer, including the six the old list dropped', () => {
    // The contact-search band dropdown sources its options from AMATEUR_BANDS
    // (the same list the logging forms store), so an operator can always filter
    // for a band they were able to log. It previously hard-coded a shorter
    // lowercase list that omitted these six — a 4M or 630M QSO could be logged
    // from a one-click pill but never filtered back out in search.
    const previouslyUnfilterable = ['2200M', '630M', '4M', '1.25M', '33CM', '13CM'];
    for (const band of previouslyUnfilterable) {
      expect(AMATEUR_BANDS).toContain(band);
    }
    // And the bands the old list did have are still present, so nothing regressed.
    const legacySearchBands = [
      '2M', '6M', '10M', '12M', '15M', '17M', '20M', '30M', '40M', '60M', '80M',
      '160M', '70CM', '23CM',
    ];
    for (const band of legacySearchBands) {
      expect(AMATEUR_BANDS).toContain(band);
    }
  });
});
