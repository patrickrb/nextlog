// Amateur-radio band plan — the single source of truth for frequency→band
// derivation, shared by the server-side ADIF importer (@/lib/adif) and the
// client-side logging forms (new-contact page, QuickLogCard).
//
// This module is intentionally free of server-only imports (no `pg`, no db
// pool) so it can be pulled into client components without dragging the
// database driver into the browser bundle.

// Ordered low→high by frequency. Every value `frequencyToBand` can return
// (other than the 'OTHER' fallback) appears here, so an auto-derived band is
// always a selectable option in the logging UI. Names are the uppercase form
// used across the app (charts, filters, ADIF export).
export const AMATEUR_BANDS = [
  '2200M', '630M', '160M', '80M', '60M', '40M', '30M', '20M', '17M', '15M',
  '12M', '10M', '6M', '4M', '2M', '1.25M', '70CM', '33CM', '23CM', '13CM',
] as const;

export type AmateurBand = (typeof AMATEUR_BANDS)[number];

// Map an operating frequency (MHz) to its amateur band. Ranges follow the ADIF
// Band Enumeration rather than any single region's allocation, so an import from
// a foreign logger — or a frequency typed into the logging form — lands on the
// right band regardless of where the QSO was made. Anything outside a known band
// falls back to 'OTHER'.
export function frequencyToBand(frequency: number): string {
  if (frequency >= 0.1357 && frequency <= 0.1378) return '2200M';
  if (frequency >= 0.472 && frequency <= 0.479) return '630M';
  if (frequency >= 1.8 && frequency <= 2.0) return '160M';
  if (frequency >= 3.5 && frequency <= 4.0) return '80M';
  if (frequency >= 5.06 && frequency <= 5.45) return '60M';
  if (frequency >= 7.0 && frequency <= 7.3) return '40M';
  if (frequency >= 10.1 && frequency <= 10.15) return '30M';
  if (frequency >= 14.0 && frequency <= 14.35) return '20M';
  if (frequency >= 18.068 && frequency <= 18.168) return '17M';
  if (frequency >= 21.0 && frequency <= 21.45) return '15M';
  if (frequency >= 24.89 && frequency <= 24.99) return '12M';
  if (frequency >= 28.0 && frequency <= 29.7) return '10M';
  if (frequency >= 50.0 && frequency <= 54.0) return '6M';
  if (frequency >= 70.0 && frequency <= 71.0) return '4M';
  if (frequency >= 144.0 && frequency <= 148.0) return '2M';
  if (frequency >= 222.0 && frequency <= 225.0) return '1.25M';
  if (frequency >= 420.0 && frequency <= 450.0) return '70CM';
  if (frequency >= 902.0 && frequency <= 928.0) return '33CM';
  if (frequency >= 1240.0 && frequency <= 1300.0) return '23CM';
  if (frequency >= 2300.0 && frequency <= 2450.0) return '13CM';

  return 'OTHER';
}
