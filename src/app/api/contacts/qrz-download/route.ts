import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { User } from '@/models/User';
import { Station } from '@/models/Station';
import { downloadConfirmationsForStation } from '@/lib/qrz-sync-service';

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
        const downloadResult = await downloadConfirmationsForStation(
          decoded.userId,
          station,
          since
        );

        if (!downloadResult.success) {
          results.push({
            stationId: station.id,
            stationCallsign: station.callsign,
            success: false,
            error: downloadResult.error
          });
          continue;
        }

        results.push({
          stationId: station.id,
          stationCallsign: station.callsign,
          success: true,
          qsosDownloaded: downloadResult.qsos_downloaded,
          confirmationsFound: downloadResult.confirmations_found,
          message: `Downloaded ${downloadResult.qsos_downloaded} QSOs, found ${downloadResult.confirmations_found} confirmations`
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
