import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { User } from '@/models/User';
import { Contact } from '@/models/Contact';
import { Station, StationData } from '@/models/Station';
import { syncContactToQrz } from '@/lib/qrz-sync-service';

interface BulkSyncResult {
  contactId: number;
  success: boolean;
  skipped?: boolean;
  already_existed?: boolean;
  message?: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
    const body = await request.json();
    const { contactIds } = body;

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json({ error: 'Contact IDs are required' }, { status: 400 });
    }

    // Verify user exists
    const user = await User.findById(decoded.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const results: BulkSyncResult[] = [];
    const stationCache = new Map<number, StationData | null>();

    // Process each contact
    for (const contactId of contactIds) {
      try {
        // Get the contact
        const contact = await Contact.findById(contactId);
        if (!contact || contact.user_id !== decoded.userId) {
          results.push({
            contactId,
            success: false,
            error: 'Contact not found or access denied'
          });
          continue;
        }

        if (!contact.station_id) {
          results.push({
            contactId,
            success: false,
            error: 'Contact has no associated station'
          });
          continue;
        }

        if (!stationCache.has(contact.station_id)) {
          stationCache.set(
            contact.station_id,
            await Station.findByUserIdAndId(decoded.userId, contact.station_id)
          );
        }
        const station = stationCache.get(contact.station_id) ?? null;
        if (!station) {
          results.push({
            contactId,
            success: false,
            error: 'Station not found for this contact'
          });
          continue;
        }

        const outcome = await syncContactToQrz(contact, station);

        if (outcome.status === 'failed') {
          results.push({
            contactId,
            success: false,
            error: outcome.error
          });
        } else {
          results.push({
            contactId,
            success: true,
            ...(outcome.status === 'skipped' ? { skipped: true } : {}),
            ...(outcome.status === 'confirmed' ? { already_existed: true } : {}),
            message: outcome.message
          });
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          contactId,
          success: false,
          error: errorMessage
        });
      }
    }

    // Calculate summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const skipped = results.filter(r => r.skipped).length;
    const alreadyExisted = results.filter(r => r.already_existed).length;

    return NextResponse.json({
      results,
      summary: {
        total: contactIds.length,
        successful,
        failed,
        skipped,
        already_existed: alreadyExisted
      }
    });

  } catch (error) {
    console.error('QRZ sync error:', error);
    return NextResponse.json({
      error: 'Failed to sync with QRZ'
    }, { status: 500 });
  }
}
