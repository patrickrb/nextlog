// QRZ logbook sync service — the single home for QRZ upload/download logic.
// Reused by the on-save auto-sync, the manual per-contact and bulk routes,
// and the scheduled sync cron. All paths use the station's QRZ Logbook API
// key: the logbook API (logbook.qrz.com) only accepts pre-issued keys — the
// user-level username/password credentials are for the XML lookup API only.

import { Contact, ContactData } from '@/models/Contact';
import { Station, StationData } from '@/models/Station';
import {
  uploadQSOToQRZWithApiKey,
  downloadQSOsFromQRZ,
  matchQRZConfirmation,
  contactToQRZFormat,
} from '@/lib/qrz';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';
import { SyncLog, SyncTrigger } from '@/models/SyncLog';

// Record a sync_logs row; never let bookkeeping break the sync itself.
export async function writeSyncLog(data: Parameters<typeof SyncLog.create>[0]): Promise<void> {
  try {
    await SyncLog.create(data);
  } catch (error) {
    logger.error('Failed to write sync log', error);
  }
}

export interface QrzSyncOutcome {
  status: 'sent' | 'confirmed' | 'skipped' | 'failed';
  message?: string;
  error?: string;
  contact?: ContactData | null;
}

// Upload a single contact to the station's QRZ logbook and record the result
// in the ADIF-style qrz_qsl_sent / qrz_qsl_rcvd fields (the ones the UI
// indicators read). 'M' (modified) rows re-upload with OPTION=REPLACE.
export async function syncContactToQrz(
  contact: ContactData,
  station: StationData
): Promise<QrzSyncOutcome> {
  if (contact.qrz_qsl_sent === 'Y') {
    return { status: 'skipped', message: 'Already sent to QRZ', contact };
  }
  if (contact.qrz_qsl_sent === 'I') {
    return { status: 'skipped', message: 'Excluded from QRZ sync', contact };
  }

  const replace = contact.qrz_qsl_sent === 'M';

  // If QRZ already confirmed this QSO it necessarily exists in the logbook —
  // mark it sent without re-uploading (unless it was modified locally).
  if (!replace && contact.qrz_qsl_rcvd === 'Y') {
    const updated = await Contact.updateQrzQsl(contact.id, 'Y');
    return {
      status: 'skipped',
      message: 'Already confirmed by QRZ (marked as sent)',
      contact: updated,
    };
  }

  if (!station.qrz_api_key) {
    return {
      status: 'failed',
      error:
        'No QRZ API key configured for this station. Please add your QRZ Logbook API key in station settings.',
    };
  }

  const qrzData = contactToQRZFormat(contact);
  const uploadResult = await uploadQSOToQRZWithApiKey(qrzData, station.qrz_api_key, replace);

  if (uploadResult.success) {
    if (uploadResult.already_exists) {
      // Duplicate means it is present in the QRZ logbook: sent and confirmed.
      const updated = await Contact.updateQrzQsl(contact.id, 'Y', 'Y');
      return {
        status: 'confirmed',
        message: 'QSO already exists in QRZ logbook (marked as sent and confirmed)',
        contact: updated,
      };
    }
    const updated = await Contact.updateQrzQsl(contact.id, 'Y');
    return { status: 'sent', message: 'Successfully sent to QRZ', contact: updated };
  }

  const updated = await Contact.updateQrzQsl(contact.id, 'R');
  logger.error(
    `QRZ upload failed for contact ${contact.id} (${contact.callsign})`,
    undefined,
    { error: uploadResult.error, station_id: station.id }
  );
  return { status: 'failed', error: uploadResult.error, contact: updated };
}

export interface QrzUploadSweepResult {
  processed: number;
  sent: number;
  confirmed: number;
  skipped: number;
  failed: number;
  first_error?: string;
}

// Upload every pending contact for one station. 'R' (previously failed) rows
// are included by findQrzNotSent, so each sweep retries earlier failures.
export async function uploadPendingForStation(
  userId: number,
  station: StationData,
  limit = 250,
  trigger: SyncTrigger = 'cron'
): Promise<QrzUploadSweepResult> {
  const startedAt = new Date();
  const pending = await Contact.findQrzNotSent(userId, limit, station.id);
  const result: QrzUploadSweepResult = {
    processed: pending.length,
    sent: 0,
    confirmed: 0,
    skipped: 0,
    failed: 0,
  };

  for (const contact of pending) {
    const outcome = await syncContactToQrz(contact, station);
    if (outcome.status === 'sent') result.sent++;
    else if (outcome.status === 'confirmed') result.confirmed++;
    else if (outcome.status === 'skipped') result.skipped++;
    else {
      result.failed++;
      if (!result.first_error) result.first_error = outcome.error;
    }
  }

  // Log only runs that had work to do; hourly no-op sweeps would drown the feed.
  if (result.processed > 0) {
    await writeSyncLog({
      user_id: userId,
      station_id: station.id,
      service: 'qrz',
      direction: 'upload',
      trigger,
      status: result.failed > 0 ? 'failed' : 'completed',
      started_at: startedAt,
      qso_count: result.processed,
      success_count: result.sent + result.confirmed,
      error_message: result.first_error,
      details: { sent: result.sent, confirmed: result.confirmed, skipped: result.skipped, failed: result.failed },
    });
  }

  return result;
}

export interface QrzDownloadResult {
  success: boolean;
  qsos_downloaded: number;
  confirmations_found: number;
  error?: string;
}

// Fetch confirmed QSOs from the station's QRZ logbook and flag matching local
// contacts as confirmed. Defaults to an incremental fetch from the station's
// qrz_last_qsl_rcvd_date cursor (MODSINCE filters by QRZ-side modification
// date, so the cursor is simply the date of the last successful run).
export async function downloadConfirmationsForStation(
  userId: number,
  station: StationData,
  since?: string,
  trigger: SyncTrigger = 'cron'
): Promise<QrzDownloadResult> {
  const startedAt = new Date();

  if (!station.qrz_api_key) {
    return {
      success: false,
      qsos_downloaded: 0,
      confirmations_found: 0,
      error: 'No QRZ API key configured for this station',
    };
  }

  let effectiveSince = since;
  if (!effectiveSince && station.qrz_last_qsl_rcvd_date) {
    const last = station.qrz_last_qsl_rcvd_date;
    effectiveSince = last instanceof Date ? last.toISOString().split('T')[0] : String(last);
  }

  const downloadResult = await downloadQSOsFromQRZ(station.qrz_api_key, effectiveSince);
  if (!downloadResult.success) {
    await writeSyncLog({
      user_id: userId,
      station_id: station.id,
      service: 'qrz',
      direction: 'download',
      trigger,
      status: 'failed',
      started_at: startedAt,
      error_message: downloadResult.error,
    });
    return {
      success: false,
      qsos_downloaded: 0,
      confirmations_found: 0,
      error: downloadResult.error,
    };
  }

  // Contacts for this station that were sent to QRZ but not yet confirmed,
  // annotated with the station callsign so the matcher can cross-check
  // against QRZ's STATION_CALLSIGN field.
  const unconfirmed = await Contact.findQrzSentNotConfirmed(userId);
  const stationContacts = unconfirmed
    .filter(c => c.station_id === station.id)
    .map(c => ({ ...c, station_callsign: station.callsign }));

  let confirmationsFound = 0;

  for (const contact of stationContacts) {
    for (const qrzQSO of downloadResult.qsos) {
      if (!matchQRZConfirmation(contact, qrzQSO)) continue;

      // QRZ marks confirmed records with app_qrzlog_status='C'. The legacy
      // qsl_rcvd / qsl_sent fields aren't always populated, so prefer the
      // app field when present.
      const isConfirmed =
        qrzQSO.app_qrzlog_status?.toUpperCase() === 'C' ||
        qrzQSO.qsl_rcvd === 'Y' ||
        qrzQSO.qsl_sent === 'Y';
      if (!isConfirmed) {
        break;
      }

      await Contact.updateQrzQsl(contact.id, undefined, 'Y');
      confirmationsFound++;

      // Cross-sync: if LoTW already shipped this QSO, flag for re-upload
      // so the new qrz_qsl_rcvd value propagates back into LoTW (wavelog 'M').
      if (contact.lotw_qsl_sent === 'Y') {
        await query(
          `UPDATE contacts SET lotw_qsl_sent = 'M', updated_at = NOW() WHERE id = $1`,
          [contact.id]
        );
      }
      break;
    }
  }

  // Advance the incremental cursor only after a successful fetch. MODSINCE is
  // date-granular and inclusive, so today's date never skips later same-day
  // modifications on the next run.
  await Station.updateQrzLastQslRcvdDate(station.id);

  // Log only runs that fetched something; hourly empty fetches would drown the feed.
  if (downloadResult.qsos.length > 0 || confirmationsFound > 0) {
    await writeSyncLog({
      user_id: userId,
      station_id: station.id,
      service: 'qrz',
      direction: 'download',
      trigger,
      status: 'completed',
      started_at: startedAt,
      qso_count: downloadResult.qsos.length,
      matched_count: confirmationsFound,
    });
  }

  return {
    success: true,
    qsos_downloaded: downloadResult.qsos.length,
    confirmations_found: confirmationsFound,
  };
}
