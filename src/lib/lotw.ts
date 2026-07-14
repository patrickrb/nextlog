// LoTW (Logbook of The World) utility functions for Nextlog

import crypto from 'crypto';
import zlib from 'zlib';
import forge from 'node-forge';
import {
  LotwConfirmation,
  ContactWithLoTW,
  LotwStationProfile,
  LotwQso,
  BuildSignedTq8Input,
} from '@/types/lotw';
import { encrypt, decrypt } from './crypto';

// Use centralized encryption utilities
export function encryptString(text: string): string {
  return encrypt(text);
}

export function decryptString(encryptedText: string): string {
  return decrypt(encryptedText);
}

// LoTW's front end intermittently answers 5xx (typically 503 Service
// Unavailable) when it's throttling or under load — and cloud/serverless
// egress IPs (e.g. Vercel) get throttled far more readily than a self-hosted
// box on a stable IP. Every LoTW leg here is idempotent, so retry a few
// transient failures with exponential backoff before giving up. Only 5xx and
// network errors are retried; a 2xx is returned as-is because LoTW encodes
// auth and other failures inside a 200 body, not the status line.
const LOTW_MAX_ATTEMPTS = 3;
// Exponential backoff derived from the attempt number, so there are no unused
// slots to fall out of sync with LOTW_MAX_ATTEMPTS: retry N waits base·2^(N-1).
// With 3 attempts that's a 2s wait after the 1st failure and 4s after the 2nd.
const LOTW_BACKOFF_BASE_MS = 2000;
const lotwBackoffMs = (attempt: number): number => LOTW_BACKOFF_BASE_MS * 2 ** (attempt - 1);

// Present as an ordinary browser. Some WAF front ends 503 on unusual
// (non-browser) user agents; a browser UA looks the least like a bot.
export const LOTW_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry a LoTW request on transient 5xx / network errors. makeRequest must
// build a fresh Request each call (FormData bodies aren't safely reusable).
// A non-5xx response is returned immediately for the caller to interpret.
export async function fetchLotwWithRetry(
  makeRequest: () => Promise<Response>,
  label: string
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= LOTW_MAX_ATTEMPTS; attempt++) {
    try {
      const response = await makeRequest();
      if (response.status >= 500 && attempt < LOTW_MAX_ATTEMPTS) {
        console.warn(
          `[LoTW] ${label} returned ${response.status}; retrying (attempt ${attempt}/${LOTW_MAX_ATTEMPTS})`
        );
        // Drain the discarded response so undici can reuse the connection
        // instead of leaking sockets across retries.
        try { await response.body?.cancel(); } catch { /* already consumed/closed */ }
        await sleep(lotwBackoffMs(attempt));
        continue;
      }
      return response;
    } catch (error) {
      // Network-level failure (DNS, reset, timeout). Retry until attempts run out.
      lastError = error;
      if (attempt < LOTW_MAX_ATTEMPTS) {
        console.warn(
          `[LoTW] ${label} network error; retrying (attempt ${attempt}/${LOTW_MAX_ATTEMPTS}):`,
          error instanceof Error ? error.message : error
        );
        await sleep(lotwBackoffMs(attempt));
        continue;
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`LoTW ${label} failed after ${LOTW_MAX_ATTEMPTS} attempts`);
}

// Parse ADIF file from LoTW download.
// Captures both the core matching fields AND the enriched fields LoTW returns when
// qso_qsldetail=yes / qso_mydetail=yes are set on the request: state, county, CQZ,
// ITUZ, DXCC, gridsquare, IOTA, and the LoTW-specific app_* extensions used to
// resolve which station-side callsign owns the QSO on multi-station accounts.
export function parseLoTWAdif(adifContent: string): LotwConfirmation[] {
  const confirmations: LotwConfirmation[] = [];

  // Strip ADIF header (everything before <EOH>); records begin after.
  const headerEnd = adifContent.search(/<eoh>/i);
  const body = headerEnd >= 0 ? adifContent.slice(headerEnd + 5) : adifContent;

  const records = body.split(/<eor>/i).filter(record => record.trim());

  for (const record of records) {
    const confirmation: LotwConfirmation = {
      call: '',
      qso_date: '',
      time_on: '',
      band: '',
      mode: ''
    };

    // Capture every field as a lowercased key on the confirmation object.
    // ADIF length-prefix fields can contain any printable bytes; we capture up to
    // the next '<' which is safe for LoTW's output.
    const fieldRegex = /<([A-Za-z0-9_]+):(\d+)(?::[^>]*)?>([^<]*)/g;
    let match;
    while ((match = fieldRegex.exec(record)) !== null) {
      const fieldName = match[1].toLowerCase();
      const fieldValue = match[3];
      confirmation[fieldName] = fieldValue;
    }

    // Only include records with required matching fields.
    if (confirmation.call && confirmation.qso_date && confirmation.time_on) {
      confirmations.push(confirmation);
    }
  }

  return confirmations;
}

// Match LoTW confirmations with local contacts.
//
// Match rules (ported from wavelog Logbook_model.php:4537-4577):
//   - DXer callsign must match exactly (after _→/ normalization)
//   - QSO time must be within ±15 minutes (clock skew is common at QSO time)
//   - band, mode, and station_callsign must match exactly
//   - For satellite QSOs (prop_mode='SAT' on either side with sat_name set),
//     sat_name must also match — LoTW only confirms satellite contacts when
//     both ends agree on the satellite.
//
// Mismatched band/mode is NOT a "partial" match — it is no match. Two QSOs on the
// same callsign at the same minute on different bands are different QSOs.
const LOTW_MATCH_TOLERANCE_MS = 15 * 60 * 1000;

export function matchLoTWConfirmations(
  confirmations: LotwConfirmation[],
  contacts: ContactWithLoTW[]
): Array<{ contact: ContactWithLoTW; confirmation: LotwConfirmation; matchStatus: 'confirmed' | 'partial' | 'mismatch' }> {
  const matches: Array<{ contact: ContactWithLoTW; confirmation: LotwConfirmation; matchStatus: 'confirmed' | 'partial' | 'mismatch' }> = [];

  for (const confirmation of confirmations) {
    const confirmationDateTime = parseLoTWDateTime(confirmation.qso_date, confirmation.time_on);
    const confCall = normalizeCallsign(confirmation.call);
    // LoTW returns the local operator's callsign in app_lotw_owncall (or station_callsign);
    // we compare it against contact.station_callsign to disambiguate multi-station accounts.
    const confOwnCall = normalizeCallsign(confirmation.app_lotw_owncall || confirmation.station_callsign || '');

    const matchingContacts = contacts.filter(contact => {
      if (normalizeCallsign(contact.callsign) !== confCall) return false;

      const timeDiff = Math.abs(new Date(contact.datetime).getTime() - confirmationDateTime.getTime());
      if (timeDiff > LOTW_MATCH_TOLERANCE_MS) return false;

      // Required exact fields — case-insensitive. A missing field on either side
      // disqualifies the match (we cannot prove they refer to the same QSO).
      if (!contact.band || !confirmation.band) return false;
      if (contact.band.toLowerCase() !== confirmation.band.toLowerCase()) return false;

      if (!contact.mode || !confirmation.mode) return false;
      if (contact.mode.toLowerCase() !== confirmation.mode.toLowerCase()) return false;

      // station_callsign filter: only enforce when LoTW provided a callsign on its side.
      if (confOwnCall && contact.station_callsign) {
        if (normalizeCallsign(contact.station_callsign) !== confOwnCall) return false;
      }

      // Satellite-mode rule: if either side declares SAT mode AND has a sat_name,
      // the other side must agree on sat_name (LoTW won't confirm otherwise).
      const isSatEither = contact.prop_mode === 'SAT' || confirmation.prop_mode === 'SAT';
      if (isSatEither && (contact.sat_name || confirmation.sat_name)) {
        if ((contact.sat_name || '').toUpperCase() !== (confirmation.sat_name || '').toUpperCase()) {
          return false;
        }
      }

      return true;
    });

    for (const contact of matchingContacts) {
      // All required fields verified — full confirmation. The 'partial' / 'mismatch'
      // statuses are reserved for future use (e.g., grid-mismatch warnings).
      matches.push({ contact, confirmation, matchStatus: 'confirmed' });
    }
  }

  return matches;
}

// Parse LoTW ADIF date/time (qso_date=YYYYMMDD, time_on=HHMMSS or HHMM) to a UTC Date.
// ADIF time fields are UTC; matching against contacts (also stored UTC) requires Date.UTC,
// not the local-time `new Date(y,m,d,...)` constructor.
function parseLoTWDateTime(qsoDate: string, timeOn: string): Date {
  const year = parseInt(qsoDate.substring(0, 4));
  const month = parseInt(qsoDate.substring(4, 6)) - 1;
  const day = parseInt(qsoDate.substring(6, 8));

  const hour = parseInt(timeOn.substring(0, 2)) || 0;
  const minute = parseInt(timeOn.substring(2, 4)) || 0;
  const second = timeOn.length >= 6 ? parseInt(timeOn.substring(4, 6)) || 0 : 0;

  return new Date(Date.UTC(year, month, day, hour, minute, second));
}

// =====================================================================
// LoTW .tq8 builder — pure Node implementation, Vercel-serverless safe.
//
// LoTW's .tq8 is NOT a CMS/PKCS#7 envelope. It is a gzipped ADIF where:
//   - One tCERT record carries the leaf certificate's PEM body (BEGIN/END
//     markers stripped, internal newlines preserved).
//   - One tSTATION record carries the operator's location (DXCC plus
//     DXCC-conditional state/county/oblast/etc. fields).
//   - Each tCONTACT record carries a per-QSO RSA-SHA1 signature in
//     <SIGN_LOTW_V2.0> with the canonical sign-string echoed in <SIGNDATA>.
//
// The canonical sign-string and field-emit order MUST match the wavelog
// reference verbatim (application/views/lotw_views/adif_views/adif_export.php).
// LoTW silently rejects QSOs whose recomputed signature does not verify.
//
// References:
//   wavelog/application/controllers/Lotw.php:1120-1147 (signlog)
//   wavelog/application/views/lotw_views/adif_views/adif_export.php:1-235
// =====================================================================

const TQSL_IDENT = 'TQSL V2.8.2 Lib: V2.6 Config: V11.34 AllowDupes: false';
// ARRL's private X.509 extensions in a LoTW certificate.
// Reference: https://oidref.com/1.3.6.1.4.1.12348.1
const ARRL_QSO_FIRST_DATE_OID = '1.3.6.1.4.1.12348.1.2';
const ARRL_QSO_END_DATE_OID = '1.3.6.1.4.1.12348.1.3';
const ARRL_DXCC_OID = '1.3.6.1.4.1.12348.1.4';

// Internal: the parsed P12 we feed to signing.
interface ParsedP12 {
  privateKeyPem: string;
  certPem: string;
  certPemBody: string;     // BEGIN/END stripped, internal newlines preserved
  certSerial: string;       // hex, lowercased; for CRL queries
  certDxcc?: number;        // from ARRL OID .4
  certNotAfter?: Date;
  // QSO date range encoded in ARRL OIDs .2 / .3 — LoTW silently rejects any
  // QSO whose date falls outside this window, even if the cert itself is
  // within its X.509 validity. Mirrors wavelog's preflight filter.
  qsoStartDate?: Date;
  qsoEndDate?: Date;
}

// Read a PrintableString value out of an ARRL private extension. The forge
// `value` field for unknown extensions is a binary string holding the raw
// DER-encoded ASN.1 value; we parse it and pull the inner string.
function readArrlPrintableExt(
  certBag: forge.pki.Certificate,
  oid: string
): string | undefined {
  try {
    type ForgeExtension = { id: string; value?: unknown };
    const certExts =
      (certBag as unknown as { extensions?: ForgeExtension[] }).extensions ??
      [];
    const ext = certExts.find(e => e?.id === oid);
    if (!ext || typeof ext.value !== 'string') return undefined;
    const inner = forge.asn1.fromDer(ext.value);
    const innerValue = (inner as { value: unknown }).value;
    return typeof innerValue === 'string' ? innerValue : undefined;
  } catch {
    return undefined;
  }
}

// ARRL stores the QSO-date-range bounds as compact strings — historically
// "YYYYMMDD" but newer certs may use "YYYY-MM-DD". Accept both, return a
// UTC midnight Date. End-of-day handling (i.e. inclusive end date) lives
// at the call site, not here.
function parseArrlDateString(raw: string | undefined): Date | undefined {
  if (!raw) return undefined;
  const m = raw.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
  if (!m) return undefined;
  const [, y, mm, dd] = m;
  const d = new Date(Date.UTC(parseInt(y, 10), parseInt(mm, 10) - 1, parseInt(dd, 10)));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseP12(buf: Buffer, password: string): ParsedP12 {
  // node-forge needs a binary string — NOT a Node Buffer. toString('binary')
  // is the documented input format.
  const p12Asn1 = forge.asn1.fromDer(buf.toString('binary'));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);

  // Try shrouded key bag first (typical for TQSL exports), then plain key bag.
  const shroudedBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const plainBags = p12.getBags({ bagType: forge.pki.oids.keyBag });
  const keyBag =
    shroudedBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0] ??
    plainBags[forge.pki.oids.keyBag]?.[0];
  if (!keyBag?.key) {
    throw new Error('LoTW certificate missing private key (shrouded P12 password may be wrong)');
  }

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certBag = certBags[forge.pki.oids.certBag]?.[0];
  if (!certBag?.cert) {
    throw new Error('LoTW certificate missing public certificate');
  }

  const privateKeyPem = forge.pki.privateKeyToPem(keyBag.key);
  const certPem = forge.pki.certificateToPem(certBag.cert);

  // Strip exactly the BEGIN/END markers, keep internal newlines, and normalize
  // CRLF to LF. node-forge emits PEM with \r\n (pem.js, util.js encode64), but
  // wavelog's reference .tq8 is produced from PHP's openssl_x509_export which
  // uses \n only. LoTW silently rejects the QSOs in a file whose tCERT body
  // doesn't match TQSL's expected line-ending convention (the file is still
  // queued for processing — the "<!-- .UPL. accepted -->" marker just means
  // the multipart POST was received — but the processor drops everything
  // before the "Last upload" timestamp moves).
  const certPemBody = certPem
    .replace(/-----BEGIN CERTIFICATE-----\s*/g, '')
    .replace(/-----END CERTIFICATE-----\s*/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  // ARRL embeds DXCC entity ID in a private extension (PrintableString).
  // forge's getExtension types accept `id: number` only, but X.509 extension
  // OIDs are dotted strings — search the .extensions array directly instead.
  let certDxcc: number | undefined;
  const dxccRaw = readArrlPrintableExt(certBag.cert, ARRL_DXCC_OID);
  if (dxccRaw) {
    const n = parseInt(dxccRaw, 10);
    if (!Number.isNaN(n)) certDxcc = n;
  }

  // QSO-date-range bounds from the same ARRL extension family. LoTW silently
  // discards any QSO whose date is outside [qsoStartDate, qsoEndDate].
  const qsoStartDate = parseArrlDateString(
    readArrlPrintableExt(certBag.cert, ARRL_QSO_FIRST_DATE_OID)
  );
  const qsoEndDate = parseArrlDateString(
    readArrlPrintableExt(certBag.cert, ARRL_QSO_END_DATE_OID)
  );

  // Serial as hex (lowercase, no leading zeros) — matches wavelog's CRL format.
  const certSerial = (certBag.cert.serialNumber || '').toLowerCase();

  // Cert expiry — surfaced so callers can persist cert_expires_at.
  let certNotAfter: Date | undefined;
  type ForgeValidity = { validity?: { notAfter?: Date } };
  const validity = (certBag.cert as ForgeValidity).validity;
  if (validity?.notAfter instanceof Date) {
    certNotAfter = validity.notAfter;
  }

  return {
    privateKeyPem,
    certPem,
    certPemBody,
    certSerial,
    certDxcc,
    certNotAfter,
    qsoStartDate,
    qsoEndDate,
  };
}

// Format a frequency in MHz the way TQSL does — trim trailing zeros,
// no exponent, no thousands separator. Avoids JS scientific notation.
//
// IMPORTANT: input is MHz, not Hz. contacts.frequency is numeric(10,6),
// whose precision physically can't hold Hz for HF (14.205 MHz in Hz is
// 14205000 — 8 integer digits, the column allows 4). The form, ADIF
// import, and QRZ download all write MHz. An earlier version of this
// function divided by 1_000_000 thinking the value was Hz; that turned
// 14.205 MHz into 0.000014 MHz in the .tq8 and LoTW silently dropped
// every QSO whose signature otherwise verified.
function formatFreqMhz(freqMhz: number): string {
  return freqMhz.toFixed(6).replace(/\.?0+$/, '');
}

// Format a Date as YYYY-MM-DD in UTC.
function utcDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Format a Date as HH:MM:SS in UTC.
function utcTimeString(d: Date): string {
  return d.toISOString().slice(11, 19);
}

// DXCC-conditional state field rules (mirrors adif_export.php switch).
function dxccStateField(dxcc: number): { field: string; useCounty?: boolean } | null {
  if (dxcc === 6 || dxcc === 110 || dxcc === 291) return { field: 'US_STATE', useCounty: true };
  if (dxcc === 1) return { field: 'CA_PROVINCE' };
  if (dxcc === 15 || dxcc === 54 || dxcc === 61 || dxcc === 125 || dxcc === 151) return { field: 'RU_OBLAST' };
  if (dxcc === 318) return { field: 'CN_PROVINCE' };
  if (dxcc === 150) return { field: 'AU_STATE' };
  if (dxcc === 339) return { field: 'JA_PREFECTURE', useCounty: true };
  if (dxcc === 5 || dxcc === 224) return { field: 'FI_KUNTA' };
  return null;
}

// Pick the station's location-string used for both ADIF emit and signing,
// keyed by DXCC. Returns the raw value (not yet uppercased).
function stationStateValue(station: LotwStationProfile): string | undefined {
  const dxcc = station.dxcc;
  if (dxcc === 6 || dxcc === 110 || dxcc === 291) return station.us_state;
  if (dxcc === 1) return station.ca_province;
  if (dxcc === 15 || dxcc === 54 || dxcc === 61 || dxcc === 125 || dxcc === 151) return station.ru_oblast;
  if (dxcc === 318) return station.cn_province;
  if (dxcc === 150) return station.au_state;
  if (dxcc === 339) return station.ja_prefecture;
  if (dxcc === 5 || dxcc === 224) return station.fi_kunta;
  return undefined;
}

function stationCountyValue(station: LotwStationProfile): string | undefined {
  if (station.dxcc === 6 || station.dxcc === 110 || station.dxcc === 291) return station.us_county;
  if (station.dxcc === 339) return station.ja_city_gun_ku;
  return undefined;
}

// Build the canonical sign-string for one QSO. Field order is fixed and must
// match adif_export.php:121-224. Final `.toUpperCase()` is applied to the
// composed string.
function buildCanonicalSignString(station: LotwStationProfile, qso: LotwQso): string {
  let s = '';
  const stateVal = stationStateValue(station);
  const countyVal = stationCountyValue(station);

  // AU_STATE (150)
  if (station.dxcc === 150 && station.au_state) s += station.au_state;
  // CA_PROVINCE (1)
  if (station.dxcc === 1 && station.ca_province) s += station.ca_province;
  // CN_PROVINCE (318)
  if (station.dxcc === 318 && station.cn_province) s += station.cn_province;
  // CQZ
  if (station.cqz != null) s += String(station.cqz);
  // FI_KUNTA (5/224)
  if ((station.dxcc === 5 || station.dxcc === 224) && station.fi_kunta) s += station.fi_kunta;
  // GRIDSQUARE
  if (station.gridsquare) s += station.gridsquare;
  // IOTA
  if (station.iota) s += station.iota;
  // ITUZ
  if (station.ituz != null) s += String(station.ituz);
  // JA_CITY_GUN_KU + JA_PREFECTURE (339)
  if (station.dxcc === 339) {
    if (station.ja_city_gun_ku) s += station.ja_city_gun_ku;
    if (station.ja_prefecture) s += station.ja_prefecture;
  }
  // RU_OBLAST (15/54/61/125/151)
  if ([15, 54, 61, 125, 151].includes(station.dxcc) && station.ru_oblast) s += station.ru_oblast;
  // US_COUNTY + US_STATE (6/110/291)
  if ([6, 110, 291].includes(station.dxcc)) {
    if (countyVal) s += countyVal;
    if (stateVal) s += stateVal;
  }
  // BAND
  if (qso.band) s += qso.band;
  // BAND_RX
  if (qso.band_rx) s += qso.band_rx;
  // CALL
  if (qso.call) s += qso.call;
  // FREQ (MHz)
  if (qso.freq != null && qso.freq > 0) s += formatFreqMhz(qso.freq);
  // FREQ_RX (MHz)
  if (qso.freq_rx != null && qso.freq_rx > 0) s += formatFreqMhz(qso.freq_rx);
  // MODE
  if (qso.mode) s += qso.mode;
  // PROP_MODE
  if (qso.prop_mode) s += qso.prop_mode;
  // QSO_DATE (YYYY-MM-DD) + QSO_TIME (HH:MM:SSZ)
  s += utcDateString(qso.datetime);
  s += utcTimeString(qso.datetime) + 'Z';
  // SAT_NAME
  if (qso.sat_name) s += qso.sat_name;

  return s.toUpperCase();
}

// Sign a canonical string with the operator's private key. RSA-SHA1 (deprecated
// elsewhere but currently still required by LoTW). Returns base64 signature.
function signCanonicalString(privateKeyPem: string, signString: string): string {
  return crypto
    .createSign('RSA-SHA1')
    .update(signString, 'utf8')
    .sign(privateKeyPem)
    .toString('base64');
}

// Verify our own signature with the leaf cert before upload — catches misformed
// canonicalization or wrong-key uploads at build time, not after LoTW rejects.
function verifyOwnSignature(certPem: string, signString: string, signatureBase64: string): boolean {
  try {
    return crypto
      .createVerify('RSA-SHA1')
      .update(signString, 'utf8')
      .verify(certPem, signatureBase64, 'base64');
  } catch {
    return false;
  }
}

// ADIF length-prefix uses byte length (not char length). For ASCII content
// these match; for Unicode in callsigns/state names we'd need byte length —
// LoTW input is all ASCII in practice.
function lenPrefix(field: string, value: string, type?: string): string {
  const tag = type ? `<${field}:${value.length}:${type}>` : `<${field}:${value.length}>`;
  return tag + value;
}

// Wavelog's signature length formula:
//   strlen(sig) + intdiv(strlen(sig), 64) + 1
// accounts for one '\n' per 64-char segment plus one trailing '\n'.
function wrappedSignatureLength(sigBase64: string): number {
  return sigBase64.length + Math.floor(sigBase64.length / 64) + 1;
}

function wrapBase64At64(sigBase64: string): string {
  let out = '';
  for (let i = 0; i < sigBase64.length; i += 64) {
    out += sigBase64.substring(i, i + 64) + '\n';
  }
  return out;
}

// Render the tCERT record. CERTIFICATE length is body.length + 1 (the trailing
// newline that precedes <eor>) — matches adif_export.php:11.
function renderCertRecord(certPemBody: string): string {
  let out = '';
  out += '<Rec_Type:5>tCERT\n';
  out += '<CERT_UID:1>1\n';
  out += `<CERTIFICATE:${certPemBody.length + 1}>${certPemBody}\n`;
  out += '\n<eor>\n\n';
  return out;
}

// Render the tSTATION record. CALL + DXCC are required; everything else is
// optional and only emitted when present (matching wavelog's null-checks).
function renderStationRecord(station: LotwStationProfile): string {
  let out = '';
  out += '<Rec_Type:8>tSTATION\n';
  out += '<STATION_UID:1>1\n';
  out += '<CERT_UID:1>1\n';
  out += lenPrefix('CALL', station.callsign) + '\n';
  out += lenPrefix('DXCC', String(station.dxcc)) + '\n';
  if (station.gridsquare) out += lenPrefix('GRIDSQUARE', station.gridsquare) + '\n';
  if (station.ituz != null) out += lenPrefix('ITUZ', String(station.ituz)) + '\n';
  if (station.cqz != null) out += lenPrefix('CQZ', String(station.cqz)) + '\n';
  if (station.iota) out += lenPrefix('IOTA', station.iota) + '\n';

  const stateRule = dxccStateField(station.dxcc);
  if (stateRule) {
    const stateVal = stationStateValue(station);
    if (stateVal) out += lenPrefix(stateRule.field, stateVal) + '\n';
    if (stateRule.useCounty) {
      const countyField = station.dxcc === 339 ? 'JA_CITY_GUN_KU' : 'US_COUNTY';
      const countyVal = stationCountyValue(station);
      if (countyVal) out += lenPrefix(countyField, countyVal) + '\n';
    }
  }
  out += '<eor>\n\n';
  return out;
}

// Render a single tCONTACT record with its signature.
function renderContactRecord(
  station: LotwStationProfile,
  qso: LotwQso,
  privateKeyPem: string,
  certPem: string
): string {
  let out = '';
  out += '<Rec_Type:8>tCONTACT\n';
  out += '<STATION_UID:1>1\n';
  out += lenPrefix('CALL', qso.call) + '\n';
  out += lenPrefix('BAND', qso.band.toUpperCase()) + '\n';
  out += lenPrefix('MODE', qso.mode.toUpperCase()) + '\n';
  if (qso.freq != null && qso.freq > 0) {
    out += lenPrefix('FREQ', formatFreqMhz(qso.freq)) + '\n';
  }
  if (qso.freq_rx != null && qso.freq_rx > 0) {
    out += lenPrefix('FREQ_RX', formatFreqMhz(qso.freq_rx)) + '\n';
  }
  if (qso.prop_mode) out += lenPrefix('PROP_MODE', qso.prop_mode.toUpperCase()) + '\n';
  if (qso.sat_name) out += lenPrefix('SAT_NAME', qso.sat_name.toUpperCase()) + '\n';
  if (qso.band_rx) out += lenPrefix('BAND_RX', qso.band_rx.toUpperCase()) + '\n';

  const dateStr = utcDateString(qso.datetime);
  const timeStr = utcTimeString(qso.datetime) + 'Z';
  out += lenPrefix('QSO_DATE', dateStr) + '\n';
  out += lenPrefix('QSO_TIME', timeStr) + '\n';

  const signString = buildCanonicalSignString(station, qso);
  const sig = signCanonicalString(privateKeyPem, signString);

  // Self-verify before adding to the file.
  if (!verifyOwnSignature(certPem, signString, sig)) {
    throw new Error(`Self-verify failed for QSO ${qso.call} ${dateStr} ${timeStr} — sign-string mismatch`);
  }

  const sigLen = wrappedSignatureLength(sig);
  out += `<SIGN_LOTW_V2.0:${sigLen}:6>`;
  out += wrapBase64At64(sig);
  out += lenPrefix('SIGNDATA', signString) + '\n';
  out += '<eor>\n\n';
  return out;
}

// Public entry point: build a wavelog-compatible .tq8 (gzipped signed ADIF).
export async function buildSignedTq8(input: BuildSignedTq8Input): Promise<Buffer> {
  if (!input.station.callsign) throw new Error('Station callsign is required');
  if (!input.station.dxcc) throw new Error('Station DXCC entity is required');
  if (input.qsos.length === 0) throw new Error('At least one QSO is required');

  const parsed = parseP12(input.p12, input.p12Password);

  // If the cert carries a DXCC and it disagrees with the station profile,
  // prefer the cert's value — the cert's DXCC is what LoTW will validate against.
  const station: LotwStationProfile = parsed.certDxcc
    ? { ...input.station, dxcc: parsed.certDxcc }
    : input.station;

  let adif = `<TQSL_IDENT:${TQSL_IDENT.length}>${TQSL_IDENT}\n\n`;
  adif += renderCertRecord(parsed.certPemBody);
  adif += renderStationRecord(station);
  for (const qso of input.qsos) {
    adif += renderContactRecord(station, qso, parsed.privateKeyPem, parsed.certPem);
  }

  return zlib.gzipSync(Buffer.from(adif, 'utf8'), { level: 9 });
}

// Cert metadata helpers (used by upload route + future CRL checks).
export function readCertMetadata(p12: Buffer, password: string): {
  serial: string;
  notAfter?: Date;
  dxcc?: number;
  qsoStartDate?: Date;
  qsoEndDate?: Date;
} {
  const parsed = parseP12(p12, password);
  return {
    serial: parsed.certSerial,
    notAfter: parsed.certNotAfter,
    dxcc: parsed.certDxcc,
    qsoStartDate: parsed.qsoStartDate,
    qsoEndDate: parsed.qsoEndDate,
  };
}

// Check whether a QSO datetime falls within the cert's allowed QSO date range.
// LoTW silently discards out-of-range QSOs server-side, so we filter them
// before signing and report them back to the caller. End is inclusive through
// 23:59:59.999 UTC of qsoEndDate (mirroring wavelog's `qso_end_date . ' 23:59:59'`).
export function isQsoWithinCertDateRange(
  qsoDatetime: Date,
  qsoStartDate: Date | undefined,
  qsoEndDate: Date | undefined
): boolean {
  const t = qsoDatetime.getTime();
  if (qsoStartDate && t < qsoStartDate.getTime()) return false;
  if (qsoEndDate) {
    // Inclusive end-of-day in UTC.
    const endOfDay = qsoEndDate.getTime() + 24 * 60 * 60 * 1000 - 1;
    if (t > endOfDay) return false;
  }
  return true;
}

// Generate SHA-256 hash of ADIF content for tracking
export function generateAdifHash(adifContent: string): string {
  return crypto.createHash('sha256').update(adifContent).digest('hex');
}

// Validate LoTW credentials by issuing a no-result lotwreport.adi query.
// LoTW responds with the literal "Invalid login" / "Login failed" strings
// in the body when credentials are wrong, regardless of HTTP status. The
// previous response.url check was unreliable: LoTW does not redirect to a
// login page and the URL did not change, so it always returned true.
export async function validateLoTWCredentials(username: string, password: string): Promise<boolean> {
  try {
    // Use a future date so the response is empty even for active accounts —
    // we only care about whether the credential check passes.
    const url = buildLoTWDownloadUrl(username, password, { dateFrom: '2099-01-01' });
    const response = await fetchLotwWithRetry(
      () => fetch(url, { method: 'GET', headers: { 'User-Agent': LOTW_USER_AGENT } }),
      'credential validation'
    );
    if (!response.ok) return false;
    const body = await response.text();
    if (/Invalid login/i.test(body) || /Login failed/i.test(body)) return false;
    // A successful response begins with an ADIF header (<TQSL_IDENT or ADIF text).
    return body.length > 0 && !/Page Request Limit/i.test(body);
  } catch (error) {
    console.error('LoTW credential validation error:', error);
    return false;
  }
}

// Check a LoTW certificate's status against ARRL's CRL service.
// Returns one of:
//   'valid'      — cert is not on the CRL
//   'revoked'    — cert is listed (revoked or superseded)
//   'unknown'    — CRL endpoint unreachable or response unparseable
// Reference: wavelog application/controllers/Lotw.php:1278-1306.
export type LotwCrlStatus = 'valid' | 'revoked' | 'unknown';

export async function checkLotwCertCrl(certSerialHex: string): Promise<LotwCrlStatus> {
  if (!certSerialHex) return 'unknown';
  try {
    const url = `https://lotw.arrl.org/lotw/crl?serial=${encodeURIComponent(certSerialHex)}`;
    const response = await fetchLotwWithRetry(
      () => fetch(url, { headers: { 'User-Agent': LOTW_USER_AGENT } }),
      'CRL check'
    );
    if (!response.ok) return 'unknown';
    const body = (await response.text()).trim();
    // ARRL's CRL endpoint returns "0" for a valid cert, "1" for revoked/superseded.
    if (body === '0') return 'valid';
    if (body === '1') return 'revoked';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

// Build LoTW download URL.
// Param names follow the actual LoTW endpoint (no underscores between qsl/since|before).
// Detail flags are required to receive enriched fields (state, county, CQZ, ITUZ, DXCC, grid, ...);
// without them LoTW strips those fields from the response and downstream enrichment fails.
// Reference: wavelog application/controllers/Lotw.php:740-744
export function buildLoTWDownloadUrl(
  username: string,
  password: string,
  options: {
    dateFrom?: string;
    dateTo?: string;
    ownCallsign?: string;
  } = {}
): string {
  const baseUrl = 'https://lotw.arrl.org/lotwuser/lotwreport.adi';
  const params = new URLSearchParams({
    login: username,
    password: password,
    qso_query: '1',
    // 'yes' (LoTW format) — must be lowercase per the documented LoTW API.
    qso_qsldetail: 'yes',
    qso_mydetail: 'yes',
    // Only return QSOs LoTW has confirmed; consistent with the way nextlog uses the response.
    qso_qsl: 'yes',
  });

  if (options.dateFrom) {
    params.append('qso_qslsince', options.dateFrom);
  }
  if (options.dateTo) {
    params.append('qso_qslbefore', options.dateTo);
  }
  if (options.ownCallsign) {
    // Filter LoTW response to a single station callsign (multi-station accounts).
    params.append('qso_owncall', normalizeCallsign(options.ownCallsign));
  }

  return `${baseUrl}?${params.toString()}`;
}

// Wavelog converts underscores to slashes before LoTW emit/match (e.g., W1AW_P -> W1AW/P).
// Apply to both upload and download paths so portable callsigns match correctly.
export function normalizeCallsign(callsign: string): string {
  if (!callsign) return callsign;
  return callsign.toUpperCase().trim().replace(/_/g, '/');
}