// Awards system TypeScript interfaces for Nextlog
// Starting with WAS (Worked All States) tracking

export interface USState {
  id: number;
  code: string;
  name: string;
  dxcc_entity: number;
  cq_zone?: string;
  itu_zone?: string;
}

export type WASAwardType = 
  | 'basic'     // Any band/mode
  | 'phone'     // Phone modes only
  | 'cw'        // CW only
  | 'digital'   // Digital modes only
  | 'rtty'      // RTTY only
  | '160m'      // 160M band only
  | '80m'       // 80M band only
  | '40m'       // 40M band only
  | '20m'       // 20M band only
  | '15m'       // 15M band only
  | '10m'       // 10M band only
  | '6m'        // 6M band only
  | '2m'        // 2M band only
  | 'satellite' // Satellite contacts only
  | 'mixed';    // Mixed mode (any mode)

export type WASStatus = 'needed' | 'worked' | 'confirmed';

export interface WASStateProgress {
  state_code: string;
  state_name: string;
  status: WASStatus;
  contact_count: number;
  last_worked_date?: Date;
  last_confirmed_date?: Date;
  qsl_received: boolean;
  contact_id?: number;
  callsign?: string;
  band?: string;
  mode?: string;
}

export interface WASProgress {
  award_type: WASAwardType;
  band?: string;
  total_states: number;
  worked_states: number;
  confirmed_states: number;
  needed_states: number;
  progress_percentage: number;
  confirmed_percentage: number;
  states: WASStateProgress[];
  last_updated: string;
}

export interface WASAward {
  id: number;
  user_id: number;
  station_id?: number;
  award_type: WASAwardType;
  band?: string;
  completed_date?: Date;
  confirmed_states: number;
  total_states: number;
  is_completed: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface WASConfirmation {
  id: number;
  user_id: number;
  station_id?: number;
  state_code: string;
  contact_id: number;
  award_type: WASAwardType;
  band?: string;
  mode: string;
  qsl_received: boolean;
  confirmed_date?: Date;
  created_at: Date;
}

export interface WASSummary {
  overall_progress: WASProgress;
  band_progress: Record<string, WASProgress>;
  mode_progress: Record<string, WASProgress>;
  recent_confirmations: WASConfirmation[];
  needed_states: {
    all: string[];
    by_band: Record<string, string[]>;
    by_mode: Record<string, string[]>;
  };
  statistics: {
    total_was_awards: number;
    completed_awards: number;
    states_worked_total: number;
    states_confirmed_total: number;
    most_worked_state: {
      state: string;
      count: number;
    };
    rarest_state: {
      state: string;
      count: number;
    };
  };
}

export interface WASMapData {
  state_code: string;
  state_name: string;
  status: WASStatus;
  contact_count: number;
  last_worked?: Date;
  callsign?: string;
  band?: string;
  mode?: string;
}

// API Request/Response types
export interface WASProgressRequest {
  station_id?: number;
  award_type?: WASAwardType;
  band?: string;
  mode?: string;
}

export interface WASProgressResponse {
  success: boolean;
  data?: WASProgress;
  error?: string;
}

export interface WASSummaryResponse {
  success: boolean;
  data?: WASSummary;
  error?: string;
}

export interface WASExportRequest {
  station_id?: number;
  award_type: WASAwardType;
  band?: string;
  format: 'csv' | 'pdf' | 'adif';
}

export interface WASExportResponse {
  success: boolean;
  download_url?: string;
  filename?: string;
  error?: string;
}

// Database query helpers
export interface WASQueryFilters {
  user_id: number;
  station_id?: number;
  award_type?: WASAwardType;
  band?: string;
  mode?: string;
  qsl_received?: boolean;
  date_from?: string;
  date_to?: string;
}

export interface WASStateStats {
  state_code: string;
  state_name: string;
  worked_count: number;
  confirmed_count: number;
  bands_worked: string[];
  modes_worked: string[];
  first_worked: Date;
  last_worked: Date;
  qsl_percentage: number;
}

// UI Component props
export interface WASProgressProps {
  progress: WASProgress;
  showDetails?: boolean;
  compact?: boolean;
}

export interface WASMapProps {
  data: WASMapData[];
  selectedState?: string;
  onStateClick?: (stateCode: string) => void;
  onStateHover?: (stateCode: string | null) => void;
  colorScheme?: 'default' | 'highContrast';
  size?: 'small' | 'medium' | 'large';
}

export interface WASStateListProps {
  states: WASStateProgress[];
  sortBy?: 'name' | 'status' | 'lastWorked' | 'count';
  sortOrder?: 'asc' | 'desc';
  filterBy?: WASStatus;
  showBandMode?: boolean;
}

// Award validation and calculation types
export interface WASValidationResult {
  is_valid: boolean;
  required_states: string[];
  missing_states: string[];
  invalid_contacts: number[];
  warnings: string[];
}

export interface WASCalculationOptions {
  include_unconfirmed?: boolean;
  require_qsl?: boolean;
  valid_bands?: string[];
  valid_modes?: string[];
  date_range?: {
    start: Date;
    end: Date;
  };
}

// Award definitions and constants
export const WAS_AWARD_DEFINITIONS: Record<WASAwardType, {
  name: string;
  description: string;
  requirements: string;
  valid_bands?: string[];
  valid_modes?: string[];
}> = {
  basic: {
    name: 'WAS Basic',
    description: 'Work all 50 US states on any band/mode',
    requirements: 'QSL confirmation from all 50 US states'
  },
  phone: {
    name: 'WAS Phone',
    description: 'Work all 50 US states using phone modes',
    requirements: 'QSL confirmation from all 50 US states using phone modes only',
    valid_modes: ['SSB', 'FM', 'AM']
  },
  cw: {
    name: 'WAS CW',
    description: 'Work all 50 US states using CW',
    requirements: 'QSL confirmation from all 50 US states using CW only',
    valid_modes: ['CW']
  },
  digital: {
    name: 'WAS Digital',
    description: 'Work all 50 US states using digital modes',
    requirements: 'QSL confirmation from all 50 US states using digital modes',
    valid_modes: ['PSK31', 'FT8', 'FT4', 'JT65', 'JT9', 'MFSK', 'OLIVIA', 'CONTESTIA']
  },
  rtty: {
    name: 'WAS RTTY',
    description: 'Work all 50 US states using RTTY',
    requirements: 'QSL confirmation from all 50 US states using RTTY only',
    valid_modes: ['RTTY']
  },
  '160m': {
    name: '160M WAS',
    description: 'Work all 50 US states on 160 meters',
    requirements: 'QSL confirmation from all 50 US states on 160M band',
    valid_bands: ['160M']
  },
  '80m': {
    name: '80M WAS',
    description: 'Work all 50 US states on 80 meters',
    requirements: 'QSL confirmation from all 50 US states on 80M band',
    valid_bands: ['80M']
  },
  '40m': {
    name: '40M WAS',
    description: 'Work all 50 US states on 40 meters',
    requirements: 'QSL confirmation from all 50 US states on 40M band',
    valid_bands: ['40M']
  },
  '20m': {
    name: '20M WAS',
    description: 'Work all 50 US states on 20 meters',
    requirements: 'QSL confirmation from all 50 US states on 20M band',
    valid_bands: ['20M']
  },
  '15m': {
    name: '15M WAS',
    description: 'Work all 50 US states on 15 meters',
    requirements: 'QSL confirmation from all 50 US states on 15M band',
    valid_bands: ['15M']
  },
  '10m': {
    name: '10M WAS',
    description: 'Work all 50 US states on 10 meters',
    requirements: 'QSL confirmation from all 50 US states on 10M band',
    valid_bands: ['10M']
  },
  '6m': {
    name: '6M WAS',
    description: 'Work all 50 US states on 6 meters',
    requirements: 'QSL confirmation from all 50 US states on 6M band',
    valid_bands: ['6M']
  },
  '2m': {
    name: '2M WAS',
    description: 'Work all 50 US states on 2 meters',
    requirements: 'QSL confirmation from all 50 US states on 2M band',
    valid_bands: ['2M']
  },
  satellite: {
    name: 'Satellite WAS',
    description: 'Work all 50 US states via satellite',
    requirements: 'QSL confirmation from all 50 US states via satellite contacts'
  },
  mixed: {
    name: 'Mixed WAS',
    description: 'Work all 50 US states using mixed modes',
    requirements: 'QSL confirmation from all 50 US states using any combination of modes'
  }
};

export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

export const WAS_BANDS = ['160M', '80M', '40M', '20M', '15M', '10M', '6M', '2M'];
export const WAS_MODES = {
  phone: ['SSB', 'FM', 'AM'],
  cw: ['CW'],
  digital: ['PSK31', 'FT8', 'FT4', 'JT65', 'JT9', 'MFSK', 'OLIVIA', 'CONTESTIA'],
  rtty: ['RTTY']
};

// DXCC Award Types and Interfaces
export interface DXCCEntity {
  id: number;
  adif: number;
  name: string;
  prefix: string;
  cq_zone?: number;
  itu_zone?: number;
  continent: string;
  longitude?: number;
  latitude?: number;
  deleted: boolean;
  created_at: Date;
}

export type DXCCAwardType = 
  | 'basic'     // Any band/mode (current)
  | 'phone'     // Phone modes only
  | 'cw'        // CW only
  | 'digital'   // Digital modes only
  | 'rtty'      // RTTY only
  | '160m'      // 160M band only
  | '80m'       // 80M band only
  | '40m'       // 40M band only
  | '20m'       // 20M band only
  | '15m'       // 15M band only
  | '10m'       // 10M band only
  | '6m'        // 6M band only
  | '2m'        // 2M band only
  | 'mixed';    // Mixed mode (any mode)

export type DXCCStatus = 'needed' | 'worked' | 'confirmed';

export interface DXCCEntityProgress {
  entity_id: number;
  adif: number;
  entity_name: string;
  prefix: string;
  continent: string;
  cq_zone?: number;
  itu_zone?: number;
  status: DXCCStatus;
  contact_count: number;
  last_worked_date?: string;
  last_confirmed_date?: string;
  qsl_received: boolean;
  contact_id?: number;
  callsign?: string;
  band?: string;
  mode?: string;
  longitude?: number;
  latitude?: number;
}

export interface DXCCProgress {
  award_type: DXCCAwardType;
  band?: string;
  total_entities: number;
  worked_entities: number;
  confirmed_entities: number;
  needed_entities: number;
  progress_percentage: number;
  confirmed_percentage: number;
  entities: DXCCEntityProgress[];
  last_updated: string;
  by_continent?: Record<string, {
    worked: number;
    confirmed: number;
    total: number;
  }>;
}

export interface DXCCAward {
  id: number;
  user_id: number;
  station_id?: number;
  award_type: DXCCAwardType;
  band?: string;
  completed_date?: Date;
  confirmed_entities: number;
  total_entities: number;
  is_completed: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DXCCConfirmation {
  id: number;
  user_id: number;
  station_id?: number;
  entity_id: number;
  contact_id: number;
  award_type: DXCCAwardType;
  band?: string;
  mode: string;
  qsl_received: boolean;
  confirmed_date?: string;
  created_at: string;
}

export interface DXCCSummary {
  overall_progress: DXCCProgress;
  band_progress: Record<string, DXCCProgress>;
  mode_progress: Record<string, DXCCProgress>;
  recent_confirmations: DXCCConfirmation[];
  needed_entities: {
    all: number[];
    by_band: Record<string, number[]>;
    by_mode: Record<string, number[]>;
    by_continent: Record<string, number[]>;
  };
  statistics: {
    total_dxcc_awards: number;
    completed_awards: number;
    entities_worked_total: number;
    entities_confirmed_total: number;
    most_worked_continent: {
      continent: string;
      count: number;
    };
    rarest_entity: {
      entity: string;
      count: number;
    };
  };
}

export interface DXCCMapData {
  entity_id: number;
  adif: number;
  entity_name: string;
  status: DXCCStatus;
  contact_count: number;
  last_worked?: Date;
  callsign?: string;
  band?: string;
  mode?: string;
  longitude?: number;
  latitude?: number;
  continent: string;
}

// DXCC API Request/Response types
export interface DXCCProgressRequest {
  station_id?: number;
  award_type?: DXCCAwardType;
  band?: string;
  mode?: string;
}

export interface DXCCProgressResponse {
  success: boolean;
  data?: DXCCProgress;
  error?: string;
}

export interface DXCCSummaryResponse {
  success: boolean;
  data?: DXCCSummary;
  error?: string;
}

export interface DXCCExportRequest {
  station_id?: number;
  award_type: DXCCAwardType;
  band?: string;
  format: 'csv' | 'pdf' | 'adif';
}

export interface DXCCExportResponse {
  success: boolean;
  download_url?: string;
  filename?: string;
  error?: string;
}

// DXCC Constants
export const DXCC_BANDS = ['160M', '80M', '40M', '20M', '15M', '10M', '6M', '2M'];
export const DXCC_MODES = {
  phone: ['SSB', 'FM', 'AM'],
  cw: ['CW'],
  digital: ['PSK31', 'FT8', 'FT4', 'JT65', 'JT9', 'MFSK', 'OLIVIA', 'CONTESTIA'],
  rtty: ['RTTY']
};

export const DXCC_CONTINENTS = ['NA', 'SA', 'EU', 'AS', 'AF', 'OC', 'AN'];

export const DXCC_AWARD_DEFINITIONS: Record<DXCCAwardType, {
  name: string;
  description: string;
  requirements: string;
  entities_required: number;
  valid_bands?: string[];
  valid_modes?: string[];
}> = {
  basic: {
    name: 'DXCC',
    description: 'Work and confirm 100 DXCC entities',
    requirements: 'QSL confirmation from 100 different DXCC entities',
    entities_required: 100
  },
  phone: {
    name: 'DXCC Phone',
    description: 'Work and confirm 100 DXCC entities using phone modes',
    requirements: 'QSL confirmation from 100 DXCC entities using phone modes only',
    entities_required: 100,
    valid_modes: ['SSB', 'FM', 'AM']
  },
  cw: {
    name: 'DXCC CW',
    description: 'Work and confirm 100 DXCC entities using CW',
    requirements: 'QSL confirmation from 100 DXCC entities using CW only',
    entities_required: 100,
    valid_modes: ['CW']
  },
  digital: {
    name: 'DXCC Digital',
    description: 'Work and confirm 100 DXCC entities using digital modes',
    requirements: 'QSL confirmation from 100 DXCC entities using digital modes',
    entities_required: 100,
    valid_modes: ['PSK31', 'FT8', 'FT4', 'JT65', 'JT9', 'MFSK', 'OLIVIA', 'CONTESTIA']
  },
  rtty: {
    name: 'DXCC RTTY',
    description: 'Work and confirm 100 DXCC entities using RTTY',
    requirements: 'QSL confirmation from 100 DXCC entities using RTTY only',
    entities_required: 100,
    valid_modes: ['RTTY']
  },
  '160m': {
    name: '160M DXCC',
    description: 'Work and confirm 100 DXCC entities on 160 meters',
    requirements: 'QSL confirmation from 100 DXCC entities on 160M band',
    entities_required: 100,
    valid_bands: ['160M']
  },
  '80m': {
    name: '80M DXCC',
    description: 'Work and confirm 100 DXCC entities on 80 meters',
    requirements: 'QSL confirmation from 100 DXCC entities on 80M band',
    entities_required: 100,
    valid_bands: ['80M']
  },
  '40m': {
    name: '40M DXCC',
    description: 'Work and confirm 100 DXCC entities on 40 meters',
    requirements: 'QSL confirmation from 100 DXCC entities on 40M band',
    entities_required: 100,
    valid_bands: ['40M']
  },
  '20m': {
    name: '20M DXCC',
    description: 'Work and confirm 100 DXCC entities on 20 meters',
    requirements: 'QSL confirmation from 100 DXCC entities on 20M band',
    entities_required: 100,
    valid_bands: ['20M']
  },
  '15m': {
    name: '15M DXCC',
    description: 'Work and confirm 100 DXCC entities on 15 meters',
    requirements: 'QSL confirmation from 100 DXCC entities on 15M band',
    entities_required: 100,
    valid_bands: ['15M']
  },
  '10m': {
    name: '10M DXCC',
    description: 'Work and confirm 100 DXCC entities on 10 meters',
    requirements: 'QSL confirmation from 100 DXCC entities on 10M band',
    entities_required: 100,
    valid_bands: ['10M']
  },
  '6m': {
    name: '6M DXCC',
    description: 'Work and confirm 50 DXCC entities on 6 meters',
    requirements: 'QSL confirmation from 50 DXCC entities on 6M band',
    entities_required: 50,
    valid_bands: ['6M']
  },
  '2m': {
    name: '2M DXCC',
    description: 'Work and confirm 50 DXCC entities on 2 meters',
    requirements: 'QSL confirmation from 50 DXCC entities on 2M band',
    entities_required: 50,
    valid_bands: ['2M']
  },
  mixed: {
    name: 'Mixed DXCC',
    description: 'Work and confirm 100 DXCC entities using mixed modes',
    requirements: 'QSL confirmation from 100 DXCC entities using any combination of modes',
    entities_required: 100
  }
};