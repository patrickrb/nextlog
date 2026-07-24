// Amateur-radio operating modes — the single source of truth for the modes
// Nextlog can store, shared by the contact-search mode filter (and available to
// any other UI that needs to offer a mode list).
//
// Like @/lib/bands this module is intentionally free of server-only imports (no
// `pg`, no db pool) so it can be pulled into client components without dragging
// the database driver into the browser bundle.
//
// Why a canonical list matters: modes are stored flat in `contacts.mode`, and
// two paths write that column —
//   1. the logging forms (new-contact, QuickLogCard), which offer a short menu;
//   2. ADIF import, where resolveAdifMode (@/lib/adif) *promotes* a WSJT-X /
//      fldigi SUBMODE to the effective mode — so a run logged under the generic
//      MFSK/PSK parent lands as "FT4", "JS8", "FST4", "OLIVIA", etc.
// The search dropdown previously hard-coded a 12-entry list that only knew
// FT4/FT8/PSK31/MFSK, so a logged JS8, FST4, JT65, Q65, PSK63, Olivia or
// Contestia QSO could never be filtered by mode. Search matches modes with
// case-insensitive equality (UPPER(mode) = UPPER($n) in @/lib/contact-search),
// so these uppercase values match whatever import/logging stored.

// Ordered so the everyday modes an operator reaches for most sit at the top of
// the dropdown, then the weak-signal digital modes, then keyboard/FSK, image,
// and digital-voice modes. Values are the uppercase form used across the app.
export const AMATEUR_MODES = [
  // Phone + CW — the bread and butter, and the modes the logging forms default to.
  'SSB', 'CW', 'FT8', 'FT4', 'AM', 'FM',
  // WSJT-X / weak-signal digital. FT8/FT4 above; the rest are frequently logged
  // (or imported) as their own mode via SUBMODE promotion.
  'JS8', 'FST4', 'JT65', 'JT9', 'Q65', 'MSK144',
  // Keyboard-to-keyboard / FSK / PSK digital.
  'RTTY', 'PSK31', 'PSK63', 'MFSK', 'OLIVIA', 'CONTESTIA', 'HELL', 'DOMINO', 'THOR',
  // Image.
  'SSTV',
  // Digital voice.
  'DMR', 'DSTAR', 'C4FM', 'YSF', 'M17', 'FREEDV',
  // Packet / ATV.
  'PACKET', 'ATV',
] as const;

export type AmateurMode = (typeof AMATEUR_MODES)[number];

// Modes whose signal report is conventionally a dB SNR (e.g. "-10") rather than
// an RST. Both logging forms carried their own copy of this list; keeping it
// here as the single source of truth stops the two from drifting apart (and from
// falling behind AMATEUR_MODES) as new digital modes become loggable.
//
// The WSJT-X / weak-signal family (FT8, FT4, JS8, FST4, JT65, JT9, Q65, MSK144)
// genuinely reports dB. The keyboard PSK/RTTY/MFSK/Olivia/Contestia group is
// grouped here to preserve the default Nextlog has always applied to those menu
// entries — not because RTTY is a dB mode.
const DB_REPORT_MODES = new Set<string>([
  'FT8', 'FT4', 'JS8', 'FST4', 'JT65', 'JT9', 'Q65', 'MSK144',
  'PSK31', 'PSK63', 'RTTY', 'MFSK', 'OLIVIA', 'CONTESTIA',
]);

// The signal report a logging form should pre-fill when an operator picks `mode`.
// CW takes RST with a tone digit (599); dB-report digital modes take -10; every
// other mode (phone, digital voice, image, packet) takes a 59 RS(T).
export function defaultRstForMode(mode: string): string {
  const m = mode.trim().toUpperCase();
  if (m === 'CW') return '599';
  if (DB_REPORT_MODES.has(m)) return '-10';
  return '59';
}
