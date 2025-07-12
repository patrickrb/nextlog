# ADIF Import Guide for Large Files

## Problem: Large ADIF Files Timing Out

If your ADIF file has more than 1000 contacts, it might timeout during import on Vercel's serverless platform.

## Solution: Split Large Files

### 1. Use the ADIF Splitter Tool

```bash
# Split your file into 400-record chunks (recommended)
node scripts/split-adif.js yourfile.adi 400

# Or smaller chunks for very large files
node scripts/split-adif.js yourfile.adi 250
```

### 2. Import Each Split File

After splitting, you'll get files like:
- `yourfile_part1_of_8.adi`
- `yourfile_part2_of_8.adi`
- etc.

Import each file one by one through the web interface.

### 3. Monitor Progress

Each import will show:
- **Imported**: New contacts added
- **Skipped**: Duplicates (already imported)
- **Errors**: Failed records

## Current Limits (Configurable in Admin Settings)

- **Max File Size**: 10 MB
- **Max Records**: 5000 per import
- **Batch Size**: 25 records per batch
- **Timeout**: 27 seconds

## For Your 3000+ Contact File

Since you have 3000+ contacts and already imported 750:

1. **Split the original file**:
   ```bash
   node scripts/split-adif.js original.adi 400
   ```

2. **Import remaining chunks**: The duplicates will be automatically skipped

3. **Alternative**: If you have the remaining unimported contacts in a separate file, split that file instead.

## Troubleshooting

- **Too many skipped**: File contains contacts already imported
- **Import stops early**: File is hitting timeout, use smaller chunks
- **Network errors**: Try again or use smaller batch sizes in admin settings

## Admin Settings

Admins can adjust these limits in `/admin/settings`:
- Increase timeout for more processing time
- Adjust batch size for performance tuning
- Modify record limits based on server capacity