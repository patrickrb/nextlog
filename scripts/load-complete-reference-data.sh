#!/bin/bash

# Load Complete Reference Data for Nextlog
# This script loads all 402 DXCC entities and 1849 states/provinces

echo "Loading complete reference data for Nextlog..."
echo "This will add all missing DXCC entities and states/provinces."
echo ""

# Check if Docker container is running
if ! docker exec nextlog-postgres psql --version > /dev/null 2>&1; then
    echo "Error: nextlog-postgres container is not running or accessible"
    echo "Please ensure the database container is running with: docker-compose up -d"
    exit 1
fi

echo "Loading all 402 DXCC entities..."
if docker exec nextlog-postgres psql -U nextlog -d nextlog -f /tmp/scripts/dxcc_entities.sql > /dev/null 2>&1; then
    echo "✅ DXCC entities loaded successfully"
else
    echo "❌ Failed to load DXCC entities"
    echo "Make sure scripts are copied to container: docker cp scripts nextlog-postgres:/tmp/"
    exit 1
fi

echo "Preparing states/provinces import..."
# Handle duplicates in states/provinces
docker exec nextlog-postgres psql -U nextlog -d nextlog -c "
    ALTER TABLE states_provinces DROP CONSTRAINT IF EXISTS states_provinces_dxcc_entity_code_key;
" > /dev/null 2>&1

echo "Loading all 1849 states/provinces..."
if docker exec nextlog-postgres psql -U nextlog -d nextlog -f /tmp/scripts/states_provinces_import.sql > /dev/null 2>&1; then
    echo "✅ States/provinces loaded successfully"
else
    echo "❌ Failed to load states/provinces"
    exit 1
fi

echo "Cleaning up duplicates and restoring constraints..."
docker exec nextlog-postgres psql -U nextlog -d nextlog -c "
    -- Remove any duplicates
    DELETE FROM states_provinces sp1 
    USING states_provinces sp2 
    WHERE sp1.id > sp2.id 
    AND sp1.dxcc_entity = sp2.dxcc_entity 
    AND sp1.code = sp2.code;
    
    -- Restore unique constraint
    ALTER TABLE states_provinces ADD CONSTRAINT states_provinces_dxcc_entity_code_key UNIQUE (dxcc_entity, code);
" > /dev/null 2>&1

# Get final counts
DXCC_COUNT=$(docker exec nextlog-postgres psql -U nextlog -d nextlog -t -c "SELECT COUNT(*) FROM dxcc_entities;" | tr -d ' ')
STATES_COUNT=$(docker exec nextlog-postgres psql -U nextlog -d nextlog -t -c "SELECT COUNT(*) FROM states_provinces;" | tr -d ' ')

echo ""
echo "🎉 Complete reference data loaded successfully!"
echo "📊 Final counts:"
echo "   DXCC entities: $DXCC_COUNT"
echo "   States/provinces: $STATES_COUNT"
echo ""
echo "Your Nextlog database now has complete reference data for:"
echo "• All DXCC entities for award tracking"
echo "• All states/provinces for WAS and other awards"
echo "• Full geographic and zone information"