import { test, expect } from '@playwright/test';
import { AMATEUR_MODES } from '@/lib/modes';

// The mode list is the canonical set of operating modes Nextlog can store, and
// the single source of truth the contact-search mode dropdown draws from. These
// tests guard that source of truth the same way bands.spec.ts guards the band
// plan: no duplicates, canonical uppercase, and — crucially — every mode an
// operator can end up with in the log is offered as a filter option.

test.describe('modes module', () => {
  test('AMATEUR_MODES has no duplicates and is canonical uppercase', () => {
    expect(new Set(AMATEUR_MODES).size).toBe(AMATEUR_MODES.length);
    for (const mode of AMATEUR_MODES) {
      expect(mode).toBe(mode.toUpperCase());
      expect(mode.trim()).toBe(mode);
      expect(mode.length).toBeGreaterThan(0);
    }
  });

  test('offers every mode the logging forms can store', () => {
    // The new-contact page and QuickLogCard let an operator pick any of these,
    // so each must be filterable back out in search.
    const loggingFormModes = ['SSB', 'CW', 'FT8', 'FT4', 'RTTY', 'PSK31', 'AM', 'FM'];
    for (const mode of loggingFormModes) {
      expect(AMATEUR_MODES).toContain(mode);
    }
  });

  test('offers the digital submodes ADIF import promotes to the stored mode', () => {
    // resolveAdifMode (@/lib/adif) promotes a WSJT-X / fldigi SUBMODE to the
    // effective mode on import — an FT4 run logged under MFSK becomes "FT4",
    // JS8 becomes "JS8", etc. The old hard-coded search dropdown listed only
    // FT4/FT8/PSK31/MFSK, so a logged JS8, FST4, JT65, Q65, OLIVIA or CONTESTIA
    // QSO could never be filtered by mode. Guard that they are now offered.
    const importPromotedSubmodes = [
      'JS8', 'FST4', 'JT65', 'JT9', 'Q65', 'MSK144', 'PSK63', 'OLIVIA', 'CONTESTIA',
    ];
    for (const mode of importPromotedSubmodes) {
      expect(AMATEUR_MODES).toContain(mode);
    }
  });

  test('keeps every mode the previous search dropdown already offered (no regression)', () => {
    const legacySearchModes = [
      'AM', 'FM', 'FT8', 'MFSK', 'RTTY', 'SSB', 'CW', 'FT4', 'PSK31', 'DMR', 'DSTAR', 'YSF',
    ];
    for (const mode of legacySearchModes) {
      expect(AMATEUR_MODES).toContain(mode);
    }
  });

  test('leads with the everyday phone and CW modes so the dropdown is fast to scan', () => {
    // Operators reach for SSB/CW/FT8 far more than Olivia; keep them at the top.
    expect(AMATEUR_MODES.slice(0, 4)).toEqual(['SSB', 'CW', 'FT8', 'FT4']);
  });
});
