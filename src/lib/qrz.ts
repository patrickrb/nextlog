
export interface QRZLookupResult {
  callsign: string;
  name?: string;
  qth?: string;
  grid_locator?: string;
  latitude?: number;
  longitude?: number;
  country?: string;
  email?: string;
  url?: string;
  qslmgr?: string;
  found: boolean;
  error?: string;
}

export interface QRZLogbookResult {
  success: boolean;
  logbook_id?: number;
  error?: string;
  already_exists?: boolean;
}

export interface QRZQSORecord {
  call: string;
  qso_date: string;
  time_on: string;
  band: string;
  mode: string;
  qsl_rcvd?: string;
  qsl_sent?: string;
  logbook_id?: number;
}

export interface QRZDownloadResult {
  success: boolean;
  qsos: QRZQSORecord[];
  error?: string;
}

export interface QRZQSOData {
  call: string;
  qso_date: string; // YYYY-MM-DD format
  time_on: string; // HHMM format
  time_off?: string; // HHMM format
  band: string;
  mode: string;
  freq?: string; // in MHz
  rst_sent?: string;
  rst_rcvd?: string;
  gridsquare?: string;
  comment?: string;
  name?: string;
  qth?: string;
  state?: string;
  country?: string;
}

// Function to convert grid locator to lat/lng
const gridToLatLng = (grid: string): [number, number] | null => {
  if (!grid || grid.length < 4) return null;
  
  const grid_upper = grid.toUpperCase();
  const lon_field = grid_upper.charCodeAt(0) - 65;
  const lat_field = grid_upper.charCodeAt(1) - 65;
  const lon_square = parseInt(grid_upper.charAt(2));
  const lat_square = parseInt(grid_upper.charAt(3));
  
  let lon = -180 + (lon_field * 20) + (lon_square * 2);
  let lat = -90 + (lat_field * 10) + (lat_square * 1);
  
  // Add subsquare precision if available
  if (grid.length >= 6) {
    const lon_subsquare = grid_upper.charCodeAt(4) - 65;
    const lat_subsquare = grid_upper.charCodeAt(5) - 65;
    lon += (lon_subsquare * 2/24) + (1/24);
    lat += (lat_subsquare * 1/24) + (1/48);
  } else {
    // Default to center of square
    lon += 1;
    lat += 0.5;
  }
  
  return [lat, lon];
};

export async function lookupCallsign(callsign: string, username: string, password: string): Promise<QRZLookupResult> {
  if (!callsign || !username || !password) {
    return {
      callsign,
      found: false,
      error: 'Missing callsign, username, or password'
    };
  }

  try {
    // First, get a session key from QRZ
    const sessionUrl = `https://xmldata.qrz.com/xml/current/?username=${encodeURIComponent(username)};password=${encodeURIComponent(password)};agent=Nextlog_1.0`;
    
    const sessionResponse = await fetch(sessionUrl);
    const sessionXml = await sessionResponse.text();
    
    // Parse session key from XML
    const sessionKeyMatch = sessionXml.match(/<Key>([^<]+)<\/Key>/);
    if (!sessionKeyMatch) {
      const errorMatch = sessionXml.match(/<Error>([^<]+)<\/Error>/);
      const errorMessage = errorMatch ? errorMatch[1] : 'Failed to authenticate with QRZ';
      return {
        callsign,
        found: false,
        error: errorMessage
      };
    }

    const sessionKey = sessionKeyMatch[1];

    // Now lookup the callsign
    const lookupUrl = `https://xmldata.qrz.com/xml/current/?s=${sessionKey};callsign=${encodeURIComponent(callsign.toUpperCase())}`;
    
    const lookupResponse = await fetch(lookupUrl);
    const lookupXml = await lookupResponse.text();

    // Check for errors
    const errorMatch = lookupXml.match(/<Error>([^<]+)<\/Error>/);
    if (errorMatch) {
      return {
        callsign,
        found: false,
        error: errorMatch[1]
      };
    }

    // Parse the response
    const parseXmlField = (xml: string, field: string): string | undefined => {
      const match = xml.match(new RegExp(`<${field}>([^<]+)<\/${field}>`));
      return match ? match[1] : undefined;
    };

    // Use name_fmt if available (properly formatted), otherwise fall back to fname+lname or name
    const name = parseXmlField(lookupXml, 'name_fmt') || 
      (parseXmlField(lookupXml, 'fname') && parseXmlField(lookupXml, 'lname') 
        ? `${parseXmlField(lookupXml, 'fname')} ${parseXmlField(lookupXml, 'lname')}`
        : parseXmlField(lookupXml, 'name'));

    // Build QTH from available address components
    const addr2 = parseXmlField(lookupXml, 'addr2');
    const state = parseXmlField(lookupXml, 'state');
    const country = parseXmlField(lookupXml, 'country');
    
    let qth = '';
    if (addr2) qth += addr2;
    if (state) qth += (qth ? ', ' : '') + state;
    if (country && country !== 'United States') qth += (qth ? ', ' : '') + country;

    // Parse latitude and longitude from QRZ (more accurate if available)
    const qrzLatitude = parseXmlField(lookupXml, 'lat');
    const qrzLongitude = parseXmlField(lookupXml, 'lon');
    const gridLocator = parseXmlField(lookupXml, 'grid');

    // Use QRZ's lat/lng if available, otherwise calculate from grid locator
    let latitude: number | undefined;
    let longitude: number | undefined;

    if (qrzLatitude && qrzLongitude) {
      latitude = parseFloat(qrzLatitude);
      longitude = parseFloat(qrzLongitude);
    } else if (gridLocator && gridLocator.length >= 4) {
      // Fallback to grid locator conversion
      const coords = gridToLatLng(gridLocator);
      if (coords) {
        [latitude, longitude] = coords;
      }
    }

    return {
      callsign: callsign.toUpperCase(),
      name,
      qth: qth || undefined,
      grid_locator: gridLocator,
      latitude,
      longitude,
      country: parseXmlField(lookupXml, 'country'),
      email: parseXmlField(lookupXml, 'email'),
      url: parseXmlField(lookupXml, 'url'),
      qslmgr: parseXmlField(lookupXml, 'qslmgr'),
      found: true
    };

  } catch {
    return {
      callsign,
      found: false,
      error: 'Network error during QRZ lookup'
    };
  }
}

// Function to convert Contact to QRZ QSO format
export function contactToQRZFormat(contact: {
  callsign: string;
  datetime: Date;
  band: string;
  mode: string;
  frequency?: number;
  rst_sent?: string;
  rst_received?: string;
  grid_locator?: string;
  notes?: string;
  name?: string;
  qth?: string;
  state?: string;
  country?: string;
}): QRZQSOData {
  const qsoDate = new Date(contact.datetime);
  const qso_date = qsoDate.toISOString().split('T')[0]; // YYYY-MM-DD
  const time_on = qsoDate.toISOString().split('T')[1].substring(0, 5).replace(':', ''); // HHMM
  
  return {
    call: contact.callsign,
    qso_date,
    time_on,
    band: contact.band,
    mode: contact.mode,
    freq: contact.frequency ? (contact.frequency / 1000000).toString() : undefined, // Convert Hz to MHz
    rst_sent: contact.rst_sent,
    rst_rcvd: contact.rst_received,
    gridsquare: contact.grid_locator,
    comment: contact.notes,
    name: contact.name,
    qth: contact.qth,
    state: contact.state,
    country: contact.country
  };
}

// Function to upload QSO to QRZ Logbook (using API key)
export async function uploadQSOToQRZWithApiKey(
  qsoData: QRZQSOData, 
  apiKey: string
): Promise<QRZLogbookResult> {
  if (!apiKey) {
    return {
      success: false,
      error: 'Missing QRZ API key'
    };
  }

  try {
    const sessionUrl = `https://logbook.qrz.com/api`;
    
    // Upload the QSO using API key
    const uploadFormData = new FormData();
    uploadFormData.append('KEY', apiKey);
    uploadFormData.append('ACTION', 'INSERT');
    uploadFormData.append('ADIF', formatQSOAsADIF(qsoData));
    
    const uploadResponse = await fetch(sessionUrl, {
      method: 'POST',
      body: uploadFormData
    });
    
    const uploadResult = await uploadResponse.text();
    console.log('QRZ upload raw response:', uploadResult);
    
    // Parse upload result
    if (uploadResult.includes('FAIL')) {
      // Check for duplicate (case-insensitive)
      if (uploadResult.toLowerCase().includes('duplicate')) {
        console.log('Detected duplicate QSO in QRZ - treating as success');
        return {
          success: true,  // Changed to true - duplicate means it's in QRZ (success!)
          already_exists: true,
          error: 'QSO already exists in QRZ logbook'
        };
      }
      
      if (uploadResult.includes('INVALID_KEY')) {
        return {
          success: false,
          error: 'Invalid QRZ API key'
        };
      }
      
      return {
        success: false,
        error: `QRZ upload failed: ${uploadResult}`
      };
    }
    
    if (uploadResult.includes('OK')) {
      // Try to extract logbook ID if provided
      const idMatch = uploadResult.match(/LOGID=(\d+)/);
      const logbook_id = idMatch ? parseInt(idMatch[1]) : undefined;
      
      return {
        success: true,
        logbook_id
      };
    }
    
    return {
      success: false,
      error: `Unexpected response from QRZ: ${uploadResult}`
    };
    
  } catch (error) {
    return {
      success: false,
      error: `Network error during QRZ upload: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Function to upload QSO to QRZ Logbook (legacy username/password method)
export async function uploadQSOToQRZ(
  qsoData: QRZQSOData, 
  username: string, 
  password: string
): Promise<QRZLogbookResult> {
  if (!username || !password) {
    return {
      success: false,
      error: 'Missing QRZ username or password'
    };
  }

  try {
    // First, get a session key from QRZ
    const sessionUrl = `https://logbook.qrz.com/api`;
    
    const authFormData = new FormData();
    authFormData.append('username', username);
    authFormData.append('password', password);
    authFormData.append('agent', 'Nextlog_1.0');
    
    const sessionResponse = await fetch(sessionUrl, {
      method: 'POST',
      body: authFormData
    });
    
    const sessionResult = await sessionResponse.text();
    
    // Parse the response to check for session key or error
    if (sessionResult.includes('AUTH_FAILED') || sessionResult.includes('INVALID')) {
      return {
        success: false,
        error: 'Invalid QRZ credentials for logbook access'
      };
    }
    
    // Extract session key
    const keyMatch = sessionResult.match(/KEY=([A-Za-z0-9]+)/);
    if (!keyMatch) {
      return {
        success: false,
        error: 'Failed to authenticate with QRZ logbook API'
      };
    }
    
    const sessionKey = keyMatch[1];
    
    // Now upload the QSO
    const uploadFormData = new FormData();
    uploadFormData.append('KEY', sessionKey);
    uploadFormData.append('ACTION', 'INSERT');
    uploadFormData.append('ADIF', formatQSOAsADIF(qsoData));
    
    const uploadResponse = await fetch(sessionUrl, {
      method: 'POST',
      body: uploadFormData
    });
    
    const uploadResult = await uploadResponse.text();
    
    // Parse upload result
    if (uploadResult.includes('FAIL')) {
      // Check for duplicate (case-insensitive)
      if (uploadResult.toLowerCase().includes('duplicate')) {
        return {
          success: true,  // Changed to true - duplicate means it's in QRZ (success!)
          already_exists: true,
          error: 'QSO already exists in QRZ logbook'
        };
      }
      
      return {
        success: false,
        error: `QRZ upload failed: ${uploadResult}`
      };
    }
    
    if (uploadResult.includes('OK')) {
      // Try to extract logbook ID if provided
      const idMatch = uploadResult.match(/LOGID=(\d+)/);
      const logbook_id = idMatch ? parseInt(idMatch[1]) : undefined;
      
      return {
        success: true,
        logbook_id
      };
    }
    
    return {
      success: false,
      error: `Unexpected response from QRZ: ${uploadResult}`
    };
    
  } catch (error) {
    return {
      success: false,
      error: `Network error during QRZ upload: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Function to format QSO data as ADIF
function formatQSOAsADIF(qso: QRZQSOData): string {
  let adif = '';
  
  // Required fields
  adif += `<CALL:${qso.call.length}>${qso.call}`;
  adif += `<QSO_DATE:${qso.qso_date.length}>${qso.qso_date.replace(/-/g, '')}`;
  adif += `<TIME_ON:${qso.time_on.length}>${qso.time_on}`;
  adif += `<BAND:${qso.band.length}>${qso.band}`;
  adif += `<MODE:${qso.mode.length}>${qso.mode}`;
  
  // Optional fields
  if (qso.freq) {
    adif += `<FREQ:${qso.freq.length}>${qso.freq}`;
  }
  if (qso.rst_sent) {
    adif += `<RST_SENT:${qso.rst_sent.length}>${qso.rst_sent}`;
  }
  if (qso.rst_rcvd) {
    adif += `<RST_RCVD:${qso.rst_rcvd.length}>${qso.rst_rcvd}`;
  }
  if (qso.gridsquare) {
    adif += `<GRIDSQUARE:${qso.gridsquare.length}>${qso.gridsquare}`;
  }
  if (qso.comment) {
    adif += `<COMMENT:${qso.comment.length}>${qso.comment}`;
  }
  if (qso.name) {
    adif += `<NAME:${qso.name.length}>${qso.name}`;
  }
  if (qso.qth) {
    adif += `<QTH:${qso.qth.length}>${qso.qth}`;
  }
  if (qso.state) {
    adif += `<STATE:${qso.state.length}>${qso.state}`;
  }
  if (qso.country) {
    adif += `<COUNTRY:${qso.country.length}>${qso.country}`;
  }
  if (qso.time_off) {
    adif += `<TIME_OFF:${qso.time_off.length}>${qso.time_off}`;
  }
  
  adif += '<EOR>';
  
  return adif;
}

// Function to validate QRZ API key (for logbook operations)
export async function validateQRZApiKey(apiKey: string): Promise<{valid: boolean; error?: string}> {
  console.log('Validating QRZ API key (first 8 chars):', apiKey.substring(0, 8) + '...');
  
  if (!apiKey) {
    return {
      valid: false,
      error: 'API key is required'
    };
  }

  try {
    const sessionUrl = `https://logbook.qrz.com/api`;
    
    // Test the API key with a STATUS action
    const testFormData = new FormData();
    testFormData.append('KEY', apiKey);
    testFormData.append('ACTION', 'STATUS');
    
    console.log('Making request to QRZ logbook API for API key validation...');
    const response = await fetch(sessionUrl, {
      method: 'POST',
      body: testFormData
    });
    
    const result = await response.text();
    console.log('QRZ API key validation response:', result);
    
    if (result.includes('INVALID_KEY')) {
      console.log('QRZ API key validation failed - invalid key');
      return {
        valid: false,
        error: 'Invalid QRZ API key'
      };
    }
    
    if (result.includes('OK') || result.includes('STATUS')) {
      console.log('QRZ API key validation successful');
      return { valid: true };
    }
    
    console.log('Unexpected QRZ API response');
    return {
      valid: false,
      error: `Unexpected response from QRZ: ${result}`
    };
    
  } catch (error) {
    console.error('QRZ API key validation network error:', error);
    return {
      valid: false,
      error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Function to download QSOs from QRZ logbook (to check for confirmations)
export async function downloadQSOsFromQRZ(
  apiKey: string,
  since?: string // YYYY-MM-DD format
): Promise<QRZDownloadResult> {
  console.log('Downloading QSOs from QRZ logbook...');
  
  if (!apiKey) {
    return {
      success: false,
      qsos: [],
      error: 'Missing QRZ API key'
    };
  }

  try {
    const sessionUrl = `https://logbook.qrz.com/api`;
    
    // Download QSOs with FETCH action
    const downloadFormData = new FormData();
    downloadFormData.append('KEY', apiKey);
    downloadFormData.append('ACTION', 'FETCH');
    downloadFormData.append('OPTION', 'TYPE:ADIF');
    
    if (since) {
      downloadFormData.append('OPTION', `MODIFIEDSINCE:${since}`);
    }
    
    console.log('Making request to QRZ for QSO download...');
    const downloadResponse = await fetch(sessionUrl, {
      method: 'POST',
      body: downloadFormData
    });
    
    const downloadResult = await downloadResponse.text();
    console.log('QRZ download response received, parsing ADIF...');
    
    if (downloadResult.includes('INVALID_KEY')) {
      console.log('QRZ download failed - invalid key');
      return {
        success: false,
        qsos: [],
        error: 'Invalid QRZ API key'
      };
    }
    
    if (downloadResult.includes('FAIL')) {
      console.log('QRZ download failed');
      return {
        success: false,
        qsos: [],
        error: `QRZ download failed: ${downloadResult}`
      };
    }
    
    // Parse ADIF data to extract QSOs
    const qsos = parseADIFForQRZ(downloadResult);
    console.log(`Successfully parsed ${qsos.length} QSOs from QRZ`);
    
    return {
      success: true,
      qsos
    };
    
  } catch (error) {
    console.error('QRZ download network error:', error);
    return {
      success: false,
      qsos: [],
      error: `Network error during QRZ download: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Function to parse ADIF data from QRZ download
function parseADIFForQRZ(adifData: string): QRZQSORecord[] {
  const qsos: QRZQSORecord[] = [];
  
  // Split by <EOR> to get individual QSO records
  const records = adifData.split(/<EOR>/i);
  
  for (const record of records) {
    if (!record.trim()) continue;
    
    const qso: Partial<QRZQSORecord> = {};
    
    // Extract fields using regex
    const fields = [
      { key: 'call', field: 'CALL' },
      { key: 'qso_date', field: 'QSO_DATE' },
      { key: 'time_on', field: 'TIME_ON' },
      { key: 'band', field: 'BAND' },
      { key: 'mode', field: 'MODE' },
      { key: 'qsl_rcvd', field: 'QSL_RCVD' },
      { key: 'qsl_sent', field: 'QSL_SENT' },
      { key: 'logbook_id', field: 'APP_QRZ_LOGID' }
    ];
    
    for (const { key, field } of fields) {
      const regex = new RegExp(`<${field}:\\d+>([^<]+)`, 'i');
      const match = record.match(regex);
      if (match) {
        if (key === 'logbook_id') {
          qso[key as keyof QRZQSORecord] = parseInt(match[1]) as QRZQSORecord[keyof QRZQSORecord];
        } else {
          qso[key as keyof QRZQSORecord] = match[1].trim() as QRZQSORecord[keyof QRZQSORecord];
        }
      }
    }
    
    // Only include records that have the minimum required fields
    if (qso.call && qso.qso_date && qso.time_on) {
      qsos.push(qso as QRZQSORecord);
    }
  }
  
  return qsos;
}

// Function to validate QRZ logbook credentials (legacy)
export async function validateQRZCredentials(username: string, password: string): Promise<{valid: boolean; error?: string}> {
  console.log('Validating QRZ credentials for username:', username);
  
  try {
    const sessionUrl = `https://logbook.qrz.com/api`;
    
    const authFormData = new FormData();
    authFormData.append('username', username);
    authFormData.append('password', password);
    authFormData.append('agent', 'Nextlog_1.0');
    
    console.log('Making request to QRZ logbook API...');
    const response = await fetch(sessionUrl, {
      method: 'POST',
      body: authFormData
    });
    
    const result = await response.text();
    console.log('QRZ API response:', result);
    
    if (result.includes('AUTH_FAILED') || result.includes('INVALID')) {
      console.log('QRZ authentication failed');
      return {
        valid: false,
        error: 'Invalid QRZ credentials for logbook access'
      };
    }
    
    const keyMatch = result.match(/KEY=([A-Za-z0-9]+)/);
    if (!keyMatch) {
      console.log('No session key found in response');
      return {
        valid: false,
        error: 'Unable to authenticate with QRZ logbook API'
      };
    }
    
    console.log('QRZ validation successful, session key obtained');
    return { valid: true };
    
  } catch (error) {
    console.error('QRZ validation network error:', error);
    return {
      valid: false,
      error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}