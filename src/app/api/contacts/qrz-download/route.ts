import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { User } from '@/models/User';
import { Contact } from '@/models/Contact';
import { Station } from '@/models/Station';
import { downloadQSOsFromQRZ } from '@/lib/qrz';

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

    console.log(`Starting QRZ download for ${stationsWithKeys.length} stations`);

    for (const station of stationsWithKeys) {
      try {
        console.log(`Processing station: ${station.callsign} (${station.station_name})`);
        
        // Download QSOs from QRZ for this station
        const downloadResult = await downloadQSOsFromQRZ(station.qrz_api_key!, since);
        
        if (!downloadResult.success) {
          console.log(`QRZ download failed for station ${station.callsign}: ${downloadResult.error}`);
          results.push({
            stationId: station.id,
            stationCallsign: station.callsign,
            success: false,
            error: downloadResult.error
          });
          continue;
        }

        console.log(`Downloaded ${downloadResult.qsos.length} QSOs from QRZ for station ${station.callsign}`);
        
        // Get contacts for this station that were sent to QRZ but not confirmed
        const unconfirmedContacts = await Contact.findQrzSentNotConfirmed(decoded.userId);
        const stationContacts = unconfirmedContacts.filter(c => c.station_id === station.id);
        
        console.log(`Found ${stationContacts.length} unconfirmed contacts for station ${station.callsign}`);
        
        let confirmationsFound = 0;
        
        // Match QRZ QSOs with our contacts to find confirmations
        for (const contact of stationContacts) {
          for (const qrzQSO of downloadResult.qsos) {
            if (Contact.matchQSO(contact, qrzQSO)) {
              console.log(`Found confirmation match for ${contact.callsign} on ${contact.datetime}`);
              
              // Check if QRZ shows this as confirmed
              if (qrzQSO.qsl_rcvd === 'Y' || qrzQSO.qsl_sent === 'Y') {
                console.log(`Marking ${contact.callsign} as QRZ confirmed`);
                await Contact.updateQrzQsl(contact.id, undefined, 'Y'); // Mark received
                confirmationsFound++;
              }
              break; // Found match, no need to check other QRZ QSOs for this contact
            }
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
        console.log(`Exception processing station ${station.callsign}: ${errorMessage}`);
        
        results.push({
          stationId: station.id,
          stationCallsign: station.callsign,
          success: false,
          error: errorMessage
        });
      }
    }

    console.log(`QRZ download completed. Processed ${stationsProcessed.size} stations`);

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