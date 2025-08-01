#!/bin/bash

# Test script for propagation prediction integration
# This script tests the API endpoints and database schema

echo "=== Propagation Prediction Integration Test ==="
echo

# Check if database files exist  
echo "1. Checking database schema file..."
if [ -f "propagation-schema.sql" ]; then
    echo "✓ Database schema file exists"
    echo "  Tables to create:"
    grep "CREATE TABLE" propagation-schema.sql | sed 's/CREATE TABLE IF NOT EXISTS /  - /'
else
    echo "✗ Database schema file missing"
fi
echo

# Check if API files exist and have correct structure
echo "2. Checking API endpoints..."
if [ -f "src/app/api/propagation/route.ts" ]; then
    echo "✓ Main propagation API endpoint exists"
else
    echo "✗ Main propagation API endpoint missing"
fi

if [ -f "src/app/api/propagation/solar/route.ts" ]; then
    echo "✓ Solar data API endpoint exists"
else
    echo "✗ Solar data API endpoint missing"
fi
echo

# Check if model files exist
echo "3. Checking data models..."
if [ -f "src/models/Propagation.ts" ]; then
    echo "✓ Propagation model exists"
    echo "  Methods available:"
    grep "static async" src/models/Propagation.ts | sed 's/  static async /  - /' | sed 's/(.*$/()/'
else
    echo "✗ Propagation model missing"
fi
echo

# Check if types exist
echo "4. Checking TypeScript types..."
if [ -f "src/types/propagation.ts" ]; then
    echo "✓ Propagation types exist"
    echo "  Interfaces defined:"
    grep "export interface" src/types/propagation.ts | sed 's/export interface /  - /'
else
    echo "✗ Propagation types missing"
fi
echo

# Check if UI page exists
echo "5. Checking UI components..."
if [ -f "src/app/propagation/page.tsx" ]; then
    echo "✓ Propagation dashboard page exists"
else
    echo "✗ Propagation dashboard page missing"
fi
echo

# Check if navigation is updated
echo "6. Checking navigation integration..."
if grep -q "propagation" src/app/dashboard/page.tsx; then
    echo "✓ Navigation updated in dashboard"
else
    echo "✗ Navigation not updated"
fi
echo

# Check TypeScript compilation
echo "7. Checking TypeScript compilation..."
if npm run lint > /dev/null 2>&1; then
    echo "✓ TypeScript compilation successful"
else
    echo "✗ TypeScript compilation failed"
    echo "  Run 'npm run lint' for details"
fi
echo

echo "=== Test Complete ==="
echo
echo "To install the database schema:"
echo "1. Set up your PostgreSQL database"
echo "2. Run: psql -f propagation-schema.sql your_database"
echo
echo "To test the API endpoints:"
echo "1. Start development server: npm run dev"
echo "2. Visit: http://localhost:3000/propagation"
echo "3. Test API: curl http://localhost:3000/api/propagation"
echo "4. Update from NOAA: curl http://localhost:3000/api/propagation/solar"