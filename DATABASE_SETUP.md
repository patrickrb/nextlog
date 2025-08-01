# Nextlog Database Setup

This guide covers the complete database setup process for the Nextlog amateur radio logging application.

## Quick Setup (Recommended)

### One-Command Setup

Run the automated setup script that handles everything:

```bash
./setup-database.sh
```

This script will:
- ✅ Drop and recreate all database tables
- ✅ Install complete schema with all 13 tables  
- ✅ Load all 402 DXCC entities
- ✅ Load all 1849 states/provinces
- ✅ Configure indexes, functions, and triggers
- ✅ Verify installation completeness

**Total setup time: ~30 seconds**

## Manual Setup (Advanced)

If you prefer manual control or need to troubleshoot:

### 1. Basic Schema Installation

```bash
# Copy install script to container
docker cp install-database.sql nextlog-postgres:/tmp/

# Run basic installation (creates schema + essential reference data)
docker exec nextlog-postgres psql -U nextlog -d nextlog -f /tmp/install-database.sql
```

### 2. Load Complete Reference Data

```bash
# Copy scripts to container
docker cp scripts nextlog-postgres:/tmp/

# Load all DXCC entities
docker exec nextlog-postgres psql -U nextlog -d nextlog -f /tmp/scripts/dxcc_entities.sql

# Load all states/provinces (with duplicate handling)
docker exec nextlog-postgres psql -U nextlog -d nextlog -c "
ALTER TABLE states_provinces DROP CONSTRAINT IF EXISTS states_provinces_dxcc_entity_code_key;"

docker exec nextlog-postgres psql -U nextlog -d nextlog -f /tmp/scripts/states_provinces_import.sql

docker exec nextlog-postgres psql -U nextlog -d nextlog -c "
DELETE FROM states_provinces sp1 USING states_provinces sp2 
WHERE sp1.id > sp2.id AND sp1.dxcc_entity = sp2.dxcc_entity AND sp1.code = sp2.code;
ALTER TABLE states_provinces ADD CONSTRAINT states_provinces_dxcc_entity_code_key UNIQUE (dxcc_entity, code);"
```

## Database Schema

The complete installation creates:

### Core Tables (8)
- `users` - User accounts and authentication
- `stations` - Amateur radio stations
- `contacts` - QSO log entries
- `dxcc_entities` - DXCC country/entity reference data
- `states_provinces` - States/provinces for awards
- `api_keys` - API authentication
- `storage_config` - File storage configuration
- `admin_audit_log` - Administrative actions

### LOTW Integration Tables (4)
- `lotw_credentials` - LoTW certificate management
- `lotw_upload_logs` - Upload history and status
- `lotw_download_logs` - Download history and status  
- `lotw_job_queue` - Background job processing

### Additional Tables (1)
- `qsl_images` - QSL card image storage

## Reference Data

### DXCC Entities (402 total)
Complete DXCC entity list including:
- All current DXCC entities
- Deleted/historical entities
- Proper CQ/ITU zone assignments
- Geographic coordinates
- Continent assignments

### States/Provinces (1849 total)
Complete geographic subdivisions:
- All US states + DC
- All Canadian provinces/territories
- International states/provinces for awards
- Proper zone assignments

## Verification

Check your installation:

```bash
# Verify table count
docker exec nextlog-postgres psql -U nextlog -d nextlog -c "
SELECT COUNT(*) as tables FROM information_schema.tables WHERE table_schema = 'public';"

# Verify reference data
docker exec nextlog-postgres psql -U nextlog -d nextlog -c "
SELECT 'DXCC entities: ' || COUNT(*) FROM dxcc_entities;
SELECT 'States/provinces: ' || COUNT(*) FROM states_provinces;"
```

Expected results:
- **Tables**: 13
- **DXCC entities**: 402
- **States/provinces**: 1849+ (includes duplicates for historical periods)

## Awards Support

With complete reference data, your installation supports:

### DXCC (DX Century Club)
- All 402 current and deleted entities
- Proper entity validation
- Mixed mode tracking
- Band-specific awards

### WAS (Worked All States)
- All 50 US states + DC
- Proper state validation
- Canadian provinces (VE/VO awards)

### International Awards
- WAC (Worked All Continents)
- CQ WPX (Worked All Prefixes)
- IOTA (Islands on the Air)
- Custom awards based on zones

## Troubleshooting

### Container Not Running
```bash
# Start the database container
docker-compose up -d
```

### Permission Issues
```bash
# Ensure scripts are executable
chmod +x setup-database.sh
chmod +x scripts/load-complete-reference-data.sh
```

### Data Loading Failures
```bash
# Check container logs
docker logs nextlog-postgres

# Verify scripts are copied
docker exec nextlog-postgres ls -la /tmp/scripts/
```

### Constraint Violations
The setup script handles duplicate data automatically, but if you encounter issues:

```bash
# Manual cleanup
docker exec nextlog-postgres psql -U nextlog -d nextlog -c "
DELETE FROM states_provinces sp1 USING states_provinces sp2 
WHERE sp1.id > sp2.id AND sp1.dxcc_entity = sp2.dxcc_entity AND sp1.code = sp2.code;"
```

## Performance

The complete setup includes:
- **38+ indexes** for optimal query performance
- **8 database functions** for automation
- **7 triggers** for data consistency
- **Proper foreign keys** for referential integrity

Post-installation, your database will handle:
- Fast DXCC lookups for award calculations
- Efficient state/province validation
- Optimized contact searches and filtering
- Background LOTW processing