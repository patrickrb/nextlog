// On-save QRZ auto-sync. Runs after a contact is created or updated when the
// user has qrz_auto_sync enabled. Uses the station's QRZ Logbook API key via
// qrz-sync-service — the logbook API does not accept username/password.
//
// Never throws: every failure is logged (and recorded on the contact as
// qrz_qsl_sent='R' by the service) so callers can fire-and-forget inside
// next/server's after() without swallowing errors silently.

import { User } from '@/models/User';
import { Contact } from '@/models/Contact';
import { Station } from '@/models/Station';
import { syncContactToQrz, writeSyncLog } from '@/lib/qrz-sync-service';
import { logger } from '@/lib/logger';

export async function autoSyncContactToQRZ(contactId: number, userId: number): Promise<void> {
  try {
    const user = await User.findById(userId);
    if (!user || !user.qrz_auto_sync) {
      return; // Auto-sync not enabled
    }

    const contact = await Contact.findById(contactId);
    if (!contact || contact.user_id !== userId) {
      return; // Contact not found or access denied
    }

    if (!contact.station_id) {
      logger.warn(`QRZ auto-sync skipped: contact ${contactId} has no station`);
      return;
    }

    const station = await Station.findByUserIdAndId(userId, contact.station_id);
    if (!station) {
      logger.warn(`QRZ auto-sync skipped: station ${contact.station_id} not found for contact ${contactId}`);
      return;
    }

    if (!station.qrz_api_key) {
      logger.warn(
        `QRZ auto-sync skipped: station ${station.id} (${station.callsign}) has no QRZ Logbook API key configured`
      );
      return;
    }

    const outcome = await syncContactToQrz(contact, station);
    if (outcome.status === 'failed') {
      // syncContactToQrz already logged the upload error and marked the
      // contact 'R'; record a sync-activity row so the failure is visible
      // on the /sync page.
      await writeSyncLog({
        user_id: userId,
        station_id: station.id,
        service: 'qrz',
        direction: 'upload',
        trigger: 'auto',
        status: 'failed',
        qso_count: 1,
        error_message: outcome.error,
        details: { contact_id: contact.id, callsign: contact.callsign },
      });
      return;
    }
  } catch (error) {
    logger.error(`QRZ auto-sync failed for contact ${contactId}`, error);
  }
}
