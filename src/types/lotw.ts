// LoTW (Logbook of The World) TypeScript interfaces for Nextlog

export interface LotwCredentials {
  id: number;
  station_id: number;
  callsign: string;
  p12_cert: Buffer;
  cert_created_at?: Date;
  cert_expires_at?: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface LotwUploadLog {
  id: number;
  station_id: number;
  user_id: number;
  qso_count: number;
  date_from?: Date;
  date_to?: Date;
  file_hash?: string;
  file_size_bytes?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  started_at: Date;
  completed_at?: Date;
  success_count: number;
  error_count: number;
  error_message?: string;
  lotw_response?: string;
  upload_method: 'manual' | 'automatic' | 'scheduled';
  created_at: Date;
}

export interface LotwDownloadLog {
  id: number;
  station_id: number;
  user_id: number;
  date_from?: Date;
  date_to?: Date;
  qso_count: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  started_at: Date;
  completed_at?: Date;
  confirmations_found: number;
  confirmations_matched: number;
  confirmations_unmatched: number;
  error_message?: string;
  download_method: 'manual' | 'automatic' | 'scheduled';
  created_at: Date;
}

export interface LotwJobQueue {
  id: number;
  job_type: 'upload' | 'download';
  station_id: number;
  user_id: number;
  job_params?: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  is_running: boolean;
  scheduled_at: Date;
  started_at?: Date;
  completed_at?: Date;
  attempts: number;
  max_attempts: number;
  error_message?: string;
  result?: Record<string, unknown>;
  priority: number;
  created_at: Date;
  updated_at: Date;
}

// Third-party services configuration for users
export interface ThirdPartyServices {
  lotw?: {
    username: string;
    password: string; // This should be encrypted at rest
  };
  qrz?: {
    username: string;
    password: string; // This should be encrypted at rest
  };
}

// Extended User interface with third-party services
export interface UserWithThirdPartyServices {
  id: number;
  email: string;
  name: string;
  callsign?: string;
  grid_locator?: string;
  third_party_services: ThirdPartyServices;
  created_at: Date;
  updated_at: Date;
}

// Extended Station interface with LoTW fields
export interface StationWithLoTW {
  id: number;
  user_id: number;
  callsign: string;
  station_name: string;
  operator_name?: string;
  qth_name?: string;
  street_address?: string;
  city?: string;
  county?: string;
  state_province?: string;
  postal_code?: string;
  country?: string;
  dxcc_entity_code?: number;
  grid_locator?: string;
  latitude?: number;
  longitude?: number;
  itu_zone?: number;
  cq_zone?: number;
  power_watts?: number;
  rig_info?: string;
  antenna_info?: string;
  station_equipment?: string;
  is_active: boolean;
  is_default: boolean;
  qrz_username?: string;
  qrz_password?: string;
  lotw_username?: string;
  lotw_password?: string;
  lotw_p12_cert?: Buffer;
  lotw_cert_created_at?: Date;
  club_callsign?: string;
  created_at: Date;
  updated_at: Date;
}

// Extended Contact interface with LoTW fields
export interface ContactWithLoTW {
  id: number;
  user_id: number;
  station_id?: number;
  callsign: string;
  name?: string;
  frequency?: number;
  mode?: string;
  band?: string;
  datetime: Date;
  rst_sent?: string;
  rst_received?: string;
  qth?: string;
  grid_locator?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  country?: string;
  dxcc?: number;
  cont?: string;
  cqz?: number;
  ituz?: number;
  state?: string;
  cnty?: string;
  qsl_rcvd?: string;
  qsl_sent?: string;
  qsl_via?: string;
  eqsl_qsl_rcvd?: string;
  eqsl_qsl_sent?: string;
  lotw_qsl_rcvd?: string;
  lotw_qsl_sent?: string;
  qsl_lotw?: boolean;
  qsl_lotw_date?: Date;
  lotw_match_status?: 'confirmed' | 'partial' | 'mismatch' | null;
  qso_date_off?: Date;
  time_off?: string;
  operator?: string;
  distance?: number;
  created_at: Date;
  updated_at: Date;
}

// LoTW API request/response types
export interface LotwUploadRequest {
  station_id: number;
  date_from?: string;
  date_to?: string;
  upload_method?: 'manual' | 'automatic' | 'scheduled';
}

export interface LotwDownloadRequest {
  station_id: number;
  date_from?: string;
  date_to?: string;
  download_method?: 'manual' | 'automatic' | 'scheduled';
}

export interface LotwUploadResponse {
  success: boolean;
  upload_log_id: number;
  qso_count?: number;
  error_message?: string;
  lotw_response?: string;
}

export interface LotwDownloadResponse {
  success: boolean;
  download_log_id: number;
  confirmations_found?: number;
  confirmations_matched?: number;
  confirmations_unmatched?: number;
  error_message?: string;
}

// LoTW certificate upload
export interface LotwCertificateUpload {
  station_id: number;
  p12_file: File;
  callsign: string;
}

export interface LotwCertificateResponse {
  success: boolean;
  credential_id?: number;
  error_message?: string;
  cert_expires_at?: string;
}

// LoTW ADIF confirmation record from LoTW download
export interface LotwConfirmation {
  call: string;
  qso_date: string;
  time_on: string;
  band: string;
  mode: string;
  freq?: string;
  app_lotw_qsl_rcvd?: string;
  qsl_rcvd_date?: string;
  [key: string]: string | undefined;
}

// LoTW sync statistics
export interface LotwSyncStats {
  station_id: number;
  last_upload?: {
    date: Date;
    qso_count: number;
    status: string;
  };
  last_download?: {
    date: Date;
    confirmations_found: number;
    confirmations_matched: number;
    status: string;
  };
  total_uploads: number;
  total_downloads: number;
  total_confirmations: number;
  pending_jobs: number;
}