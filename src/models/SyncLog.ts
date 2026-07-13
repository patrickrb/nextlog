import { query } from '@/lib/db';

export type SyncService = 'qrz' | 'lotw' | 'eqsl';
export type SyncDirection = 'upload' | 'download';
export type SyncTrigger = 'manual' | 'auto' | 'cron';
export type SyncStatus = 'completed' | 'failed';

export interface SyncLogData {
  id: number;
  user_id: number;
  station_id?: number | null;
  service: SyncService;
  direction: SyncDirection;
  trigger: SyncTrigger;
  status: SyncStatus;
  started_at: Date;
  completed_at?: Date | null;
  qso_count?: number | null;
  success_count?: number | null;
  matched_count?: number | null;
  error_message?: string | null;
  details?: Record<string, unknown> | null;
}

export interface CreateSyncLogData {
  user_id: number;
  station_id?: number;
  service: SyncService;
  direction: SyncDirection;
  trigger: SyncTrigger;
  status: SyncStatus;
  started_at?: Date;
  qso_count?: number;
  success_count?: number;
  matched_count?: number;
  error_message?: string;
  details?: Record<string, unknown>;
}

export class SyncLog {
  static async create(data: CreateSyncLogData): Promise<SyncLogData> {
    const result = await query(
      `INSERT INTO sync_logs (
         user_id, station_id, service, direction, trigger, status,
         started_at, completed_at, qso_count, success_count, matched_count,
         error_message, details
       ) VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, NOW()), NOW(), $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        data.user_id,
        data.station_id ?? null,
        data.service,
        data.direction,
        data.trigger,
        data.status,
        data.started_at ?? null,
        data.qso_count ?? 0,
        data.success_count ?? 0,
        data.matched_count ?? 0,
        data.error_message ?? null,
        data.details ? JSON.stringify(data.details) : null,
      ]
    );
    return result.rows[0];
  }

  static async findByUserId(userId: number, limit = 50, offset = 0): Promise<SyncLogData[]> {
    const result = await query(
      `SELECT * FROM sync_logs
       WHERE user_id = $1
       ORDER BY started_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows;
  }
}
