#!/usr/bin/env node

/**
 * ADIF File Splitter Utility
 * Splits large ADIF files into smaller chunks for easier importing
 * 
 * Usage: node scripts/split-adif.js input.adi [records_per_file]
 */

const fs = require('fs');
const path = require('path');

function splitADIFFile(inputFile, recordsPerFile = 500) {
  console.log(`Splitting ADIF file: ${inputFile}`);
  console.log(`Target records per file: ${recordsPerFile}`);

  if (!fs.existsSync(inputFile)) {
    console.error(`Error: File ${inputFile} not found`);
    process.exit(1);
  }

  const content = fs.readFileSync(inputFile, 'utf8');
  
  // Extract header (everything before <eoh>)
  const eohIndex = content.toLowerCase().indexOf('<eoh>');
  const header = eohIndex >= 0 ? content.substring(0, eohIndex + 5) + '\n' : '';
  const dataContent = eohIndex >= 0 ? content.substring(eohIndex + 5) : content;

  // Split by <eor> (end of record)
  const recordStrings = dataContent.split(/<eor>/i);
  const records = recordStrings.filter(r => r.trim()).map(r => r.trim() + '<eor>');

  console.log(`Found ${records.length} records in ADIF file`);

  if (records.length <= recordsPerFile) {
    console.log(`File already has ${records.length} records (≤ ${recordsPerFile}). No splitting needed.`);
    return;
  }

  const totalFiles = Math.ceil(records.length / recordsPerFile);
  const baseName = path.basename(inputFile, path.extname(inputFile));
  const outputDir = path.dirname(inputFile);

  console.log(`Creating ${totalFiles} split files...`);

  for (let fileIndex = 0; fileIndex < totalFiles; fileIndex++) {
    const startRecord = fileIndex * recordsPerFile;
    const endRecord = Math.min(startRecord + recordsPerFile, records.length);
    const fileRecords = records.slice(startRecord, endRecord);

    const outputFile = path.join(outputDir, `${baseName}_part${fileIndex + 1}_of_${totalFiles}.adi`);
    const fileContent = header + fileRecords.join('\n') + '\n';

    fs.writeFileSync(outputFile, fileContent);
    console.log(`Created ${outputFile} with ${fileRecords.length} records`);
  }

  console.log('\n✅ ADIF file splitting completed!');
  console.log(`📁 Split into ${totalFiles} files with ${recordsPerFile} records each`);
  console.log(`💡 You can now import each file separately for better reliability`);
}

// Command line usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node scripts/split-adif.js input.adi [records_per_file]');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/split-adif.js mylog.adi        # Split into 500-record files');
    console.log('  node scripts/split-adif.js mylog.adi 250    # Split into 250-record files');
    process.exit(1);
  }

  const inputFile = args[0];
  const recordsPerFile = args[1] ? parseInt(args[1]) : 500;

  if (isNaN(recordsPerFile) || recordsPerFile < 1) {
    console.error('Error: records_per_file must be a positive number');
    process.exit(1);
  }

  splitADIFFile(inputFile, recordsPerFile);
}

module.exports = { splitADIFFile };