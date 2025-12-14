// LoTW (Logbook of The World) utility functions for Nextlog

import crypto from 'crypto';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { LotwConfirmation, ContactWithLoTW } from '@/types/lotw';
import { encrypt, decrypt } from './crypto';

// Use centralized encryption utilities
export function encryptString(text: string): string {
  return encrypt(text);
}

export function decryptString(encryptedText: string): string {
  return decrypt(encryptedText);
}

// ADIF generation for LoTW upload
export function generateAdifForLoTW(contacts: ContactWithLoTW[], stationCallsign: string): string {
  const header = `ADIF Export for LoTW Upload
<ADIF_VER:5>3.1.5
<PROGRAMID:7>Nextlog
<PROGRAMVERSION:5>1.0.0
<EOH>

`;

  const records = contacts.map(contact => {
    let adifRecord = '';
    
    // Required fields for LoTW
    adifRecord += `<CALL:${contact.callsign.length}>${contact.callsign}`;
    
    // Format date as YYYYMMDD
    const qsoDate = contact.datetime.toISOString().slice(0, 10).replace(/-/g, '');
    adifRecord += `<QSO_DATE:8>${qsoDate}`;
    
    // Format time as HHMMSS
    const qsoTime = contact.datetime.toISOString().slice(11, 19).replace(/:/g, '');
    adifRecord += `<TIME_ON:6>${qsoTime}`;
    
    // Band is required
    if (contact.band) {
      adifRecord += `<BAND:${contact.band.length}>${contact.band}`;
    }
    
    // Mode is required  
    if (contact.mode) {
      adifRecord += `<MODE:${contact.mode.length}>${contact.mode}`;
    }
    
    // Station callsign
    adifRecord += `<STATION_CALLSIGN:${stationCallsign.length}>${stationCallsign}`;
    
    // Optional fields
    if (contact.frequency) {
      const freqStr = contact.frequency.toString();
      adifRecord += `<FREQ:${freqStr.length}>${freqStr}`;
    }
    
    if (contact.rst_sent) {
      adifRecord += `<RST_SENT:${contact.rst_sent.length}>${contact.rst_sent}`;
    }
    
    if (contact.rst_received) {
      adifRecord += `<RST_RCVD:${contact.rst_received.length}>${contact.rst_received}`;
    }
    
    if (contact.grid_locator) {
      adifRecord += `<GRIDSQUARE:${contact.grid_locator.length}>${contact.grid_locator}`;
    }
    
    if (contact.name) {
      adifRecord += `<NAME:${contact.name.length}>${contact.name}`;
    }
    
    if (contact.qth) {
      adifRecord += `<QTH:${contact.qth.length}>${contact.qth}`;
    }
    
    if (contact.state) {
      adifRecord += `<STATE:${contact.state.length}>${contact.state}`;
    }
    
    if (contact.country) {
      adifRecord += `<COUNTRY:${contact.country.length}>${contact.country}`;
    }
    
    if (contact.dxcc) {
      const dxccStr = contact.dxcc.toString();
      adifRecord += `<DXCC:${dxccStr.length}>${dxccStr}`;
    }
    
    if (contact.cqz) {
      const cqzStr = contact.cqz.toString();
      adifRecord += `<CQZ:${cqzStr.length}>${cqzStr}`;
    }
    
    if (contact.ituz) {
      const ituzStr = contact.ituz.toString();
      adifRecord += `<ITUZ:${ituzStr.length}>${ituzStr}`;
    }
    
    // End of record
    adifRecord += '<EOR>\n';
    
    return adifRecord;
  });
  
  return header + records.join('');
}

// Parse ADIF file from LoTW download
export function parseLoTWAdif(adifContent: string): LotwConfirmation[] {
  const confirmations: LotwConfirmation[] = [];
  
  // Split into individual records
  const records = adifContent.split('<EOR>').filter(record => record.trim());
  
  for (const record of records) {
    const confirmation: LotwConfirmation = {
      call: '',
      qso_date: '',
      time_on: '',
      band: '',
      mode: ''
    };
    
    // Extract fields using regex
    const fieldRegex = /<(\w+):(\d+)>([^<]*)/g;
    let match;
    
    while ((match = fieldRegex.exec(record)) !== null) {
      const fieldName = match[1].toLowerCase();
      const fieldValue = match[3];
      
      // Map ADIF fields to our confirmation object
      switch (fieldName) {
        case 'call':
          confirmation.call = fieldValue;
          break;
        case 'qso_date':
          confirmation.qso_date = fieldValue;
          break;
        case 'time_on':
          confirmation.time_on = fieldValue;
          break;
        case 'band':
          confirmation.band = fieldValue;
          break;
        case 'mode':
          confirmation.mode = fieldValue;
          break;
        case 'freq':
          confirmation.freq = fieldValue;
          break;
        case 'app_lotw_qsl_rcvd':
          confirmation.app_lotw_qsl_rcvd = fieldValue;
          break;
        case 'qsl_rcvd_date':
          confirmation.qsl_rcvd_date = fieldValue;
          break;
        default:
          // Store any additional fields
          confirmation[fieldName] = fieldValue;
      }
    }
    
    // Only include records with required fields
    if (confirmation.call && confirmation.qso_date && confirmation.time_on) {
      confirmations.push(confirmation);
    }
  }
  
  return confirmations;
}

// Match LoTW confirmations with local contacts
export function matchLoTWConfirmations(
  confirmations: LotwConfirmation[],
  contacts: ContactWithLoTW[]
): Array<{ contact: ContactWithLoTW; confirmation: LotwConfirmation; matchStatus: 'confirmed' | 'partial' | 'mismatch' }> {
  const matches: Array<{ contact: ContactWithLoTW; confirmation: LotwConfirmation; matchStatus: 'confirmed' | 'partial' | 'mismatch' }> = [];
  
  for (const confirmation of confirmations) {
    // Convert LoTW date/time format to JavaScript Date for comparison
    const confirmationDateTime = parseLoTWDateTime(confirmation.qso_date, confirmation.time_on);
    
    // Find matching contact(s)
    const matchingContacts = contacts.filter(contact => {
      // Callsign must match (case insensitive)
      if (contact.callsign.toLowerCase() !== confirmation.call.toLowerCase()) {
        return false;
      }
      
      // Date/time must be within tolerance (e.g., 5 minutes)
      const timeDiff = Math.abs(contact.datetime.getTime() - confirmationDateTime.getTime());
      if (timeDiff > 5 * 60 * 1000) { // 5 minutes tolerance
        return false;
      }
      
      return true;
    });
    
    for (const contact of matchingContacts) {
      let matchStatus: 'confirmed' | 'partial' | 'mismatch' = 'confirmed';
      
      // Check band match
      if (contact.band && confirmation.band) {
        if (contact.band.toLowerCase() !== confirmation.band.toLowerCase()) {
          matchStatus = 'partial';
        }
      }
      
      // Check mode match
      if (contact.mode && confirmation.mode) {
        if (contact.mode.toLowerCase() !== confirmation.mode.toLowerCase()) {
          matchStatus = 'partial';
        }
      }
      
      matches.push({ contact, confirmation, matchStatus });
    }
  }
  
  return matches;
}

// Parse LoTW date/time format (YYYYMMDD HHMMSS) to JavaScript Date
function parseLoTWDateTime(qsoDate: string, timeOn: string): Date {
  // qsoDate format: YYYYMMDD
  // timeOn format: HHMMSS
  
  const year = parseInt(qsoDate.substring(0, 4));
  const month = parseInt(qsoDate.substring(4, 6)) - 1; // Month is 0-indexed
  const day = parseInt(qsoDate.substring(6, 8));
  
  const hour = parseInt(timeOn.substring(0, 2));
  const minute = parseInt(timeOn.substring(2, 4));
  const second = parseInt(timeOn.substring(4, 6));
  
  return new Date(year, month, day, hour, minute, second);
}

// Sign ADIF file using TQSL or OpenSSL
export async function signAdifWithCertificate(
  adifContent: string,
  p12CertBuffer: Buffer,
  callsign: string
): Promise<string> {
  // Create temporary files
  const tempDir = '/tmp';
  const adifFile = path.join(tempDir, `lotw_upload_${Date.now()}.adi`);
  const p12File = path.join(tempDir, `lotw_cert_${Date.now()}.p12`);
  const signedFile = path.join(tempDir, `lotw_signed_${Date.now()}.tq8`);
  
  try {
    // Write ADIF content to file
    await fs.writeFile(adifFile, adifContent);
    
    // Write P12 certificate to file
    await fs.writeFile(p12File, p12CertBuffer);
    
    // Try TQSL first (preferred method)
    try {
      const tqslResult = await signWithTQSL(adifFile, p12File, signedFile, callsign);
      if (tqslResult) {
        const signedContent = await fs.readFile(signedFile, 'utf8');
        return signedContent;
      }
    } catch (tqslError) {
      console.warn('TQSL signing failed, falling back to OpenSSL:', tqslError);
    }
    
    // Fallback to OpenSSL-based signing
    const opensslResult = await signWithOpenSSL(adifContent);
    return opensslResult;
    
  } finally {
    // Clean up temporary files
    try {
      await fs.unlink(adifFile);
      await fs.unlink(p12File);
      await fs.unlink(signedFile);
    } catch (cleanupError) {
      console.warn('Failed to clean up temporary files:', cleanupError);
    }
  }
}

// Sign using TQSL (preferred method)
async function signWithTQSL(
  adifFile: string,
  p12File: string,
  outputFile: string,
  callsign: string
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const tqsl = spawn('tqsl', [
      '-d',           // Use default location
      '-l', callsign, // Callsign
      '-c', p12File,  // Certificate file
      '-o', outputFile, // Output file
      adifFile        // Input ADIF file
    ]);
    
    let errorOutput = '';
    
    tqsl.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    tqsl.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        reject(new Error(`TQSL failed with code ${code}: ${errorOutput}`));
      }
    });
    
    tqsl.on('error', (error) => {
      reject(error);
    });
  });
}

// Fallback signing using OpenSSL
async function signWithOpenSSL(adifContent: string): Promise<string> {
  // This is a simplified implementation
  // In a real implementation, you would use OpenSSL to:
  // 1. Extract the private key and certificate from the P12 file
  // 2. Create a PKCS#7 signed message
  // 3. Return the signed ADIF content
  
  // For now, return the original content with a signature placeholder
  // This should be replaced with actual OpenSSL-based signing
  console.warn('OpenSSL signing not fully implemented - returning unsigned ADIF');
  return adifContent;
}

// Generate SHA-256 hash of ADIF content for tracking
export function generateAdifHash(adifContent: string): string {
  return crypto.createHash('sha256').update(adifContent).digest('hex');
}

// Validate LoTW credentials
export async function validateLoTWCredentials(username: string, password: string): Promise<boolean> {
  try {
    const response = await fetch('https://lotw.arrl.org/lotwuser/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        login: username,
        password: password,
      }),
    });
    
    // LoTW returns different status codes/content for valid/invalid credentials
    // This is a simplified check - you may need to adjust based on actual LoTW response
    return response.status === 200 && !response.url.includes('login');
  } catch (error) {
    console.error('LoTW credential validation error:', error);
    return false;
  }
}

// Build LoTW download URL
export function buildLoTWDownloadUrl(
  username: string,
  password: string,
  dateFrom?: string,
  dateTo?: string
): string {
  const baseUrl = 'https://lotw.arrl.org/lotwuser/lotwreport.adi';
  const params = new URLSearchParams({
    login: username,
    password: password,
    qso_query: '1',
  });
  
  if (dateFrom) {
    params.append('qso_qsl_since', dateFrom);
  }
  
  if (dateTo) {
    params.append('qso_qsl_before', dateTo);
  }
  
  return `${baseUrl}?${params.toString()}`;
}