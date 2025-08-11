
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

// Function to upload QSO to QRZ Logbook
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
      if (uploadResult.includes('DUPLICATE')) {
        return {
          success: false,
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

// Function to validate QRZ logbook credentials
export async function validateQRZCredentials(username: string, password: string): Promise<{valid: boolean; error?: string}> {
  try {
    const sessionUrl = `https://logbook.qrz.com/api`;
    
    const authFormData = new FormData();
    authFormData.append('username', username);
    authFormData.append('password', password);
    authFormData.append('agent', 'Nextlog_1.0');
    
    const response = await fetch(sessionUrl, {
      method: 'POST',
      body: authFormData
    });
    
    const result = await response.text();
    
    if (result.includes('AUTH_FAILED') || result.includes('INVALID')) {
      return {
        valid: false,
        error: 'Invalid QRZ credentials for logbook access'
      };
    }
    
    const keyMatch = result.match(/KEY=([A-Za-z0-9]+)/);
    if (!keyMatch) {
      return {
        valid: false,
        error: 'Unable to authenticate with QRZ logbook API'
      };
    }
    
    return { valid: true };
    
  } catch (error) {
    return {
      valid: false,
      error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}