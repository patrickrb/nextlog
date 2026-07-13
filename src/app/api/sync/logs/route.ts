// Merged sync-activity feed: QRZ (and future eQSL) runs from sync_logs,
// LoTW runs normalized out of its dedicated lotw_upload_logs /
// lotw_download_logs tables. One reverse-chronological stream for the /sync page.

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = typeof user.userId === 'string' ? parseInt(user.userId, 10) : user.userId;
    const { searchParams } = new URL(request.url);
    // Fall back to defaults on non-numeric/negative input instead of passing
    // NaN into LIMIT/OFFSET and 500ing.
    const parsedLimit = parseInt(searchParams.get('limit') || '', 10);
    const limit = Number.isNaN(parsedLimit) || parsedLimit < 1 ? 50 : Math.min(parsedLimit, 200);
    const parsedOffset = parseInt(searchParams.get('offset') || '', 10);
    const offset = Number.isNaN(parsedOffset) || parsedOffset < 0 ? 0 : parsedOffset;

    const result = await query(
      `SELECT * FROM (
         SELECT
           'sync-' || sl.id            AS log_key,
           sl.service,
           sl.direction,
           sl."trigger",
           sl.status,
           sl.started_at,
           sl.completed_at,
           sl.qso_count,
           sl.success_count,
           sl.matched_count,
           sl.error_message,
           sl.station_id,
           st.callsign                 AS station_callsign,
           sl.details
         FROM sync_logs sl
         LEFT JOIN stations st ON sl.station_id = st.id
         WHERE sl.user_id = $1

         UNION ALL

         SELECT
           'lotw-upload-' || ul.id     AS log_key,
           'lotw'                      AS service,
           'upload'                    AS direction,
           CASE WHEN ul.upload_method = 'manual' THEN 'manual' ELSE 'cron' END AS "trigger",
           ul.status,
           ul.started_at,
           ul.completed_at,
           ul.qso_count,
           ul.success_count,
           NULL::integer               AS matched_count,
           ul.error_message,
           ul.station_id,
           su.callsign                 AS station_callsign,
           NULL::jsonb                 AS details
         FROM lotw_upload_logs ul
         LEFT JOIN stations su ON ul.station_id = su.id
         WHERE ul.user_id = $1

         UNION ALL

         SELECT
           'lotw-download-' || dl.id   AS log_key,
           'lotw'                      AS service,
           'download'                  AS direction,
           CASE WHEN dl.download_method = 'manual' THEN 'manual' ELSE 'cron' END AS "trigger",
           dl.status,
           dl.started_at,
           dl.completed_at,
           dl.qso_count,
           NULL::integer               AS success_count,
           dl.confirmations_matched    AS matched_count,
           dl.error_message,
           dl.station_id,
           sd.callsign                 AS station_callsign,
           NULL::jsonb                 AS details
         FROM lotw_download_logs dl
         LEFT JOIN stations sd ON dl.station_id = sd.id
         WHERE dl.user_id = $1
       ) merged
       ORDER BY started_at DESC NULLS LAST
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return NextResponse.json({
      logs: result.rows,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Sync logs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
