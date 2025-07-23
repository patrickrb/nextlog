
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