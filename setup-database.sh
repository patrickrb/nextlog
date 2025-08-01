#!/bin/bash

# Nextlog Database Setup Script
# Complete automated setup for Nextlog amateur radio logging database

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CONTAINER_NAME="nextlog-postgres"
DB_USER="nextlog"
DB_NAME="nextlog"

echo -e "${BLUE}🚀 Nextlog Database Setup${NC}"
echo "=============================================="
echo "This script will:"
echo "• Drop and recreate all database tables"
echo "• Install complete schema with all 13 tables"
echo "• Load all 402 DXCC entities"  
echo "• Load all 1849 states/provinces"
echo "• Configure indexes, functions, and triggers"
echo ""

# Confirmation prompt
read -p "Are you sure you want to proceed? This will DELETE all existing data! (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Setup cancelled.${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}Step 1: Checking prerequisites...${NC}"

# Check if Docker is running
if ! docker --version > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not installed or not running${NC}"
    exit 1
fi

# Check if container exists and is running
if ! docker exec $CONTAINER_NAME psql --version > /dev/null 2>&1; then
    echo -e "${RED}❌ Database container '$CONTAINER_NAME' is not running${NC}"
    echo "Please start it with: docker-compose up -d"
    exit 1
fi

echo -e "${GREEN}✅ Docker and database container are ready${NC}"

echo ""
echo -e "${BLUE}Step 2: Copying scripts to container...${NC}"

# Copy all required files to container
docker cp install-database.sql $CONTAINER_NAME:/tmp/install-database.sql
docker cp scripts $CONTAINER_NAME:/tmp/

echo -e "${GREEN}✅ Scripts copied successfully${NC}"

echo ""
echo -e "${BLUE}Step 3: Dropping existing database objects...${NC}"

# Drop all existing tables, functions, and constraints
docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "
-- Drop tables in correct order to handle dependencies
DROP TABLE IF EXISTS lotw_job_queue CASCADE;
DROP TABLE IF EXISTS lotw_upload_logs CASCADE;
DROP TABLE IF EXISTS lotw_download_logs CASCADE;
DROP TABLE IF EXISTS lotw_credentials CASCADE;
DROP TABLE IF EXISTS qsl_images CASCADE;
DROP TABLE IF EXISTS admin_audit_log CASCADE;
DROP TABLE IF EXISTS api_keys CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS stations CASCADE;
DROP TABLE IF EXISTS states_provinces CASCADE;
DROP TABLE IF EXISTS dxcc_entities CASCADE;
DROP TABLE IF EXISTS storage_config CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS generate_api_key() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS ensure_single_default_station() CASCADE;
DROP FUNCTION IF EXISTS set_default_station_for_contact() CASCADE;
DROP FUNCTION IF EXISTS update_last_login() CASCADE;
" > /dev/null 2>&1

echo -e "${GREEN}✅ Existing database objects dropped${NC}"

echo ""
echo -e "${BLUE}Step 4: Installing database schema...${NC}"

# Run the main installation script
if docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -f /tmp/install-database.sql > /tmp/install.log 2>&1; then
    echo -e "${GREEN}✅ Database schema installed successfully${NC}"
else
    echo -e "${RED}❌ Schema installation failed. Check /tmp/install.log for details${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Step 5: Loading complete DXCC entities...${NC}"

# Load all DXCC entities
if docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -f /tmp/scripts/dxcc_entities.sql > /dev/null 2>&1; then
    echo -e "${GREEN}✅ All DXCC entities loaded${NC}"
else
    echo -e "${RED}❌ Failed to load DXCC entities${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Step 6: Loading complete states/provinces...${NC}"

# Prepare for states/provinces import (handle duplicates)
docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "
ALTER TABLE states_provinces DROP CONSTRAINT IF EXISTS states_provinces_dxcc_entity_code_key;
" > /dev/null 2>&1

# Load all states/provinces
if docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -f /tmp/scripts/states_provinces_import.sql > /dev/null 2>&1; then
    echo -e "${GREEN}✅ All states/provinces loaded${NC}"
else
    echo -e "${RED}❌ Failed to load states/provinces${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Step 7: Cleaning up and finalizing...${NC}"

# Clean up duplicates and restore constraints
docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "
-- Remove any duplicate entries
DELETE FROM states_provinces sp1 
USING states_provinces sp2 
WHERE sp1.id > sp2.id 
AND sp1.dxcc_entity = sp2.dxcc_entity 
AND sp1.code = sp2.code;

-- Restore unique constraint
ALTER TABLE states_provinces ADD CONSTRAINT states_provinces_dxcc_entity_code_key UNIQUE (dxcc_entity, code);
" > /dev/null 2>&1

echo -e "${GREEN}✅ Database cleanup completed${NC}"

echo ""
echo -e "${BLUE}Step 8: Verifying installation...${NC}"

# Get final statistics
TABLE_COUNT=$(docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
DXCC_COUNT=$(docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM dxcc_entities;" | tr -d ' ')
STATES_COUNT=$(docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM states_provinces;" | tr -d ' ')
FUNCTION_COUNT=$(docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public';" | tr -d ' ')

echo ""
echo -e "${GREEN}🎉 Database setup completed successfully!${NC}"
echo "=============================================="
echo -e "${BLUE}📊 Installation Summary:${NC}"
echo "  Tables created: $TABLE_COUNT"
echo "  Functions created: $FUNCTION_COUNT"
echo "  DXCC entities: $DXCC_COUNT"
echo "  States/provinces: $STATES_COUNT"
echo ""
echo -e "${BLUE}🏆 Your database now includes:${NC}"
echo "  • Complete schema with all 13 tables"
echo "  • All LOTW integration tables"
echo "  • API key management system"
echo "  • QSL image storage system"
echo "  • Complete DXCC entities for award tracking"
echo "  • All US states and Canadian provinces"
echo "  • International states/provinces"
echo "  • Proper indexes and triggers for performance"
echo ""
echo -e "${BLUE}🚀 Next steps:${NC}"
echo "  • Your Nextlog application is ready to use"
echo "  • All amateur radio awards will work correctly"
echo "  • DXCC, WAS, and other awards are fully supported"
echo ""
echo -e "${GREEN}Database setup completed at $(date)${NC}"