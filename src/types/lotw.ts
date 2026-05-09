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
  // Joined from stations table when needed (upload/match flows)
  station_callsign?: string;
  callsign: string;
  name?: string;
  frequency?: number;
  mode?: string;
  band?: string;
  band_rx?: string;
  freq_rx?: number;
  prop_mode?: string;
  sat_name?: string;
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
  iota?: string;
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
  lotw_qslrdate?: Date;
  lotw_match_status?: 'confirmed' | 'partial' | 'mismatch' | null;
  // QRZ cross-sync fields (set to 'M' when LoTW confirms a QRZ-uploaded QSO)
  qrz_qsl_sent?: string;
  qrz_qsl_rcvd?: string;
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
  // Enriched fields LoTW returns when qso_qsldetail=yes / qso_mydetail=yes
  state?: string;
  cnty?: string;
  cqz?: string;
  ituz?: string;
  dxcc?: string;
  country?: string;
  gridsquare?: string;
  iota?: string;
  prop_mode?: string;
  sat_name?: string;
  qsl_rcvd?: string;
  app_lotw_qsl_rcvd?: string;
  app_lotw_rxqsl?: string;
  app_lotw_owncall?: string;
  qsl_rcvd_date?: string;
  station_callsign?: string;
  [key: string]: string | undefined;
}

// Station-location profile required to build a wavelog-compatible .tq8 file.
// Mirrors the tSTATION record fields in TQSL output.
export interface LotwStationProfile {
  callsign: string;
  dxcc: number;
  gridsquare?: string;
  ituz?: number;
  cqz?: number;
  iota?: string;
  // DXCC-conditional location fields (only the one matching the station's DXCC is emitted/signed):
  us_state?: string;       us_county?: string;       // DXCC 6/110/291
  ca_province?: string;                                // DXCC 1
  ru_oblast?: string;                                  // DXCC 15/54/61/125/151
  cn_province?: string;                                // DXCC 318
  au_state?: string;                                   // DXCC 150
  ja_prefecture?: string;  ja_city_gun_ku?: string;   // DXCC 339
  fi_kunta?: string;                                   // DXCC 5/224
}

// Per-QSO inputs to the .tq8 builder.
export interface LotwQso {
  call: string;
  band: string;
  band_rx?: string;
  mode: string;
  freq?: number;       // MHz
  freq_rx?: number;    // MHz
  prop_mode?: string;
  sat_name?: string;
  datetime: Date;
}

// Inputs to buildSignedTq8.
export interface BuildSignedTq8Input {
  p12: Buffer;
  p12Password: string;
  station: LotwStationProfile;
  qsos: LotwQso[];
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