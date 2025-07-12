#!/usr/bin/env node

/**
 * ADIF File Debug Utility
 * Analyzes ADIF files to identify potential parsing issues
 * 
 * Usage: node scripts/debug-adif.js input.adi
 */

const fs = require('fs');

function debugADIFFile(inputFile) {
  console.log(`Debugging ADIF file: ${inputFile}`);

  if (!fs.existsSync(inputFile)) {
    console.error(`Error: File ${inputFile} not found`);
    process.exit(1);
  }

  const content = fs.readFileSync(inputFile, 'utf8');
  console.log(`File size: ${content.length} characters`);
  
  // Extract header (everything before <eoh>)
  const eohIndex = content.toLowerCase().indexOf('<eoh>');
  const header = eohIndex >= 0 ? content.substring(0, eohIndex + 5) : '';
  const dataContent = eohIndex >= 0 ? content.substring(eohIndex + 5) : content;

  console.log(`Header size: ${header.length} characters`);
  console.log(`Data content size: ${dataContent.length} characters`);

  // Split by <eor> (end of record)
  const recordStrings = dataContent.split(/<eor>/i);
  const records = recordStrings.filter(r => r.trim());

  console.log(`\nFound ${records.length} records`);

  // Analyze first few records
  console.log('\n=== First 3 Records Analysis ===');
  for (let i = 0; i < Math.min(3, records.length); i++) {
    console.log(`\nRecord ${i + 1}:`);
    const record = parseADIFRecord(records[i].trim());
    if (record && record.fields) {
      console.log(`  Fields: ${Object.keys(record.fields).length}`);
      console.log(`  Keys: ${Object.keys(record.fields).join(', ')}`);
      if (record.fields.call) console.log(`  Callsign: ${record.fields.call}`);
      if (record.fields.qso_date) console.log(`  Date: ${record.fields.qso_date}`);
      if (record.fields.time_on) console.log(`  Time: ${record.fields.time_on}`);
    } else {
      console.log(`  ERROR: Failed to parse record`);
      console.log(`  Content: ${records[i].substring(0, 200)}...`);
    }
  }

  // Check records around position 650-800 (where your import stops)
  console.log('\n=== Records Around Position 650-800 ===');
  for (let i = 650; i < Math.min(800, records.length); i += 50) {
    console.log(`\nRecord ${i + 1}:`);
    const record = parseADIFRecord(records[i].trim());
    if (record && record.fields) {
      console.log(`  OK - Fields: ${Object.keys(record.fields).length}`);
      if (record.fields.call) console.log(`  Callsign: ${record.fields.call}`);
    } else {
      console.log(`  ERROR: Failed to parse record ${i + 1}`);
      console.log(`  Content preview: ${records[i].substring(0, 100)}...`);
    }
  }

  // Check for common issues
  console.log('\n=== Potential Issues ===');
  
  // Look for malformed field patterns
  let malformedCount = 0;
  const fieldRegex = /<([^:>]+):(\\d+)>([^<]*)/gi;
  
  for (let i = 0; i < records.length; i++) {
    const recordContent = records[i].trim();
    const matches = recordContent.match(fieldRegex);
    if (!matches || matches.length === 0) {
      malformedCount++;
      if (malformedCount <= 5) {
        console.log(`  Malformed record ${i + 1}: ${recordContent.substring(0, 100)}...`);
      }
    }
  }
  
  if (malformedCount > 0) {
    console.log(`  Found ${malformedCount} potentially malformed records`);
  } else {
    console.log(`  No obvious parsing issues found`);
  }

  // Check for non-ASCII characters that might cause issues
  const nonAsciiMatches = content.match(/[^\x00-\x7F]/g);
  if (nonAsciiMatches) {
    console.log(`  Found ${nonAsciiMatches.length} non-ASCII characters`);
  }

  console.log('\n=== Summary ===');
  console.log(`Total records: ${records.length}`);
  console.log(`Malformed records: ${malformedCount}`);
  console.log(`File appears ${malformedCount === 0 ? 'valid' : 'to have issues'}`);
}

function parseADIFRecord(recordString) {
  const fields = {};
  
  // Regular expression to match ADIF fields: <fieldname:length>value
  const fieldRegex = /<([^:>]+):(\\d+)>([^<]*)/gi;
  let match;
  
  while ((match = fieldRegex.exec(recordString)) !== null) {
    const fieldName = match[1].toLowerCase();
    const length = parseInt(match[2]);
    let value = match[3];
    
    // Ensure we only take the specified length
    if (value.length > length) {
      value = value.substring(0, length);
    }
    
    fields[fieldName] = value.trim();
  }
  
  return { fields };
}

// Command line usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node scripts/debug-adif.js input.adi');
    console.log('');
    console.log('This tool analyzes ADIF files to identify potential parsing issues.');
    process.exit(1);
  }

  const inputFile = args[0];
  debugADIFFile(inputFile);
}

module.exports = { debugADIFFile };