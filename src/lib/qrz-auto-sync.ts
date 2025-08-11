import { User } from '@/models/User';
import { Contact } from '@/models/Contact';
import { uploadQSOToQRZ, contactToQRZFormat } from './qrz';

export async function autoSyncContactToQRZ(contactId: number, userId: number): Promise<void> {
  try {
    // Get user and check if auto-sync is enabled
    const user = await User.findById(userId);
    if (!user || !user.qrz_auto_sync) {
      return; // Auto-sync not enabled
    }

    // Check if user has QRZ credentials
    if (!user.qrz_username || !user.qrz_password) {
      return; // No QRZ credentials
    }

    // Get the contact
    const contact = await Contact.findById(contactId);
    if (!contact || contact.user_id !== userId) {
      return; // Contact not found or access denied
    }

    // Skip if already synced or failed too many times
    if (contact.qrz_sync_status === 'synced' || contact.qrz_sync_status === 'already_exists') {
      return; // Already synced
    }

    // Decrypt the password
    const decryptedPassword = User.getDecryptedQrzPassword(user);
    if (!decryptedPassword) {
      return; // Failed to decrypt password
    }

    // Convert contact to QRZ format
    const qrzData = contactToQRZFormat(contact);

    // Upload to QRZ
    const uploadResult = await uploadQSOToQRZ(qrzData, user.qrz_username, decryptedPassword);

    if (uploadResult.success) {
      // Update contact sync status
      await Contact.updateQrzSyncStatus(contactId, 'synced', uploadResult.logbook_id);
    } else if (uploadResult.already_exists) {
      // Mark as already exists
      await Contact.updateQrzSyncStatus(contactId, 'already_exists', undefined, uploadResult.error);
    } else {
      // Mark as error
      await Contact.updateQrzSyncStatus(contactId, 'error', undefined, uploadResult.error);
    }

  } catch (error) {
    // Mark as error on any exception
    try {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await Contact.updateQrzSyncStatus(contactId, 'error', undefined, errorMessage);
    } catch {
      // Ignore errors in error handling
    }
  }
}

// Function to perform auto-sync in the background (non-blocking)
export function backgroundAutoSync(contactId: number, userId: number): void {
  // Run auto-sync in background, don't wait for it
  autoSyncContactToQRZ(contactId, userId).catch(() => {
    // Ignore errors in background sync
  });
}