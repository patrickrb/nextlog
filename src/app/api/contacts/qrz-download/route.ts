import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { User } from '@/models/User';
import { Contact } from '@/models/Contact';
import { Station } from '@/models/Station';
import { downloadQSOsFromQRZ, matchQRZConfirmation } from '@/lib/qrz';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
    const body = await request.json();
    const { stationIds, since } = body; // Optional: limit to specific stations and date range

    // Verify user exists
    const user = await User.findById(decoded.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const results = [];
    const stationsProcessed = new Set<number>();

    // Get all stations with QRZ API keys for this user
    const userStations = await Station.findByUserId(decoded.userId);
    const stationsWithKeys = userStations.filter(station => 
      station.qrz_api_key && (!stationIds || stationIds.includes(station.id))
    );

    if (stationsWithKeys.length === 0) {
      return NextResponse.json({ 
        error: 'No stations found with QRZ API keys configured' 
      }, { status: 400 });
    }

    for (const station of stationsWithKeys) {
      try {
        // Download QSOs from QRZ for this station
        const downloadResult = await downloadQSOsFromQRZ(station.qrz_api_key!, since);

        if (!downloadResult.success) {
          results.push({
            stationId: station.id,
            stationCallsign: station.callsign,
            success: false,
            error: downloadResult.error
          });
          continue;
        }

        // Get contacts for this station that were sent to QRZ but not confirmed
        const unconfirmedContacts = await Contact.findQrzSentNotConfirmed(decoded.userId);
        const stationContacts = unconfirmedContacts.filter(c => c.station_id === station.id);

        let confirmationsFound = 0;

        // Annotate each contact with the station callsign so the matcher can
        // cross-check against QRZ's STATION_CALLSIGN field. ContactData has
        // station_id but not station_callsign — fill it in from the iterated station.
        const stationCall = station.callsign;
        const annotated = stationContacts.map(c => ({ ...c, station_callsign: stationCall }));

        // Match QRZ QSOs with our contacts. Tighter rules: callsign + band +
        // mode + station_callsign + ±15min, so two QSOs on different bands at
        // the same minute don't false-match.
        for (const contact of annotated) {
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
        
        results.push({
          stationId: station.id,
          stationCallsign: station.callsign,
          success: true,
          qsosDownloaded: downloadResult.qsos.length,
          confirmationsFound,
          message: `Downloaded ${downloadResult.qsos.length} QSOs, found ${confirmationsFound} confirmations`
        });
        
        stationsProcessed.add(station.id);
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          stationId: station.id,
          stationCallsign: station.callsign,
          success: false,
          error: errorMessage
        });
      }
    }

    // Calculate summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalQsosDownloaded = results.reduce((sum, r) => sum + (r.qsosDownloaded || 0), 0);
    const totalConfirmations = results.reduce((sum, r) => sum + (r.confirmationsFound || 0), 0);

    return NextResponse.json({
      results,
      summary: {
        stationsProcessed: stationsProcessed.size,
        successful,
        failed,
        totalQsosDownloaded,
        totalConfirmations
      }
    });

  } catch (error) {
    console.error('QRZ download error:', error);
    return NextResponse.json({ 
      error: 'Failed to download from QRZ' 
    }, { status: 500 });
  }
}