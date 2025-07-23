#!/bin/bash

# Nextlog Database Installation Script
# This script sets up the complete Nextlog database schema

set -e  # Exit on any error

echo "🚀 Nextlog Database Installation Script"
echo "======================================"

# Configuration
DB_NAME="nextlog"
DB_USER="nextlog"
DB_PASSWORD="password"
DB_HOST="localhost"
DB_PORT="5432"

# Check if PostgreSQL is available
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL client (psql) is not installed or not in PATH"
    echo "Please install PostgreSQL client tools first"
    exit 1
fi

# Function to check if database exists
check_database() {
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"
}

# Function to create database if it doesn't exist
create_database() {
    echo "📋 Creating database '$DB_NAME'..."
    createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"
    echo "✅ Database '$DB_NAME' created successfully"
}

# Function to install schema
install_schema() {
    echo "📦 Installing database schema..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f install-database.sql
    echo "✅ Database schema installed successfully"
}

# Function to load DXCC entities data
load_dxcc_data() {
    if [ -f "scripts/dxcc_entities.sql" ]; then
        echo "🌍 Loading DXCC entities data..."
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f scripts/dxcc_entities.sql
        echo "✅ DXCC entities data loaded successfully"
        
        # Count loaded entities
        local count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM dxcc_entities;")
        echo "   📊 Loaded $count DXCC entities"
    else
        echo "❌ DXCC entities data file not found (scripts/dxcc_entities.sql)"
        echo "   This file is required for proper operation"
        exit 1
    fi
}

# Function to load states/provinces data
load_states_data() {
    if [ -f "scripts/states_provinces_import.sql" ]; then
        echo "🗺️  Loading states/provinces data..."
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f scripts/states_provinces_import.sql
        echo "✅ States/provinces data loaded successfully"
        
        # Count loaded states/provinces
        local count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM states_provinces;")
        echo "   📊 Loaded $count states/provinces"
    else
        echo "❌ States/provinces data file not found (scripts/states_provinces_import.sql)"
        echo "   This file is required for proper operation"
        exit 1
    fi
}

# Function to verify installation
verify_installation() {
    echo "🔍 Verifying installation..."
    
    # Check if all tables exist
    TABLES=(users stations contacts dxcc_entities states_provinces)
    for table in "${TABLES[@]}"; do
        if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\\dt $table" | grep -q "$table"; then
            echo "  ✅ Table '$table' exists"
        else
            echo "  ❌ Table '$table' missing"
            exit 1
        fi
    done
    
    # Check if functions exist
    FUNCTIONS=(update_updated_at_column ensure_single_default_station set_default_station_for_contact)
    for func in "${FUNCTIONS[@]}"; do
        if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\\df $func" | grep -q "$func"; then
            echo "  ✅ Function '$func' exists"
        else
            echo "  ❌ Function '$func' missing"
            exit 1
        fi
    done
    
    # Verify data was loaded
    local dxcc_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM dxcc_entities;")
    local states_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM states_provinces;")
    
    if [ "$dxcc_count" -gt 0 ]; then
        echo "  ✅ DXCC entities data loaded ($dxcc_count records)"
    else
        echo "  ❌ No DXCC entities data found"
        exit 1
    fi
    
    if [ "$states_count" -gt 0 ]; then
        echo "  ✅ States/provinces data loaded ($states_count records)"
    else
        echo "  ❌ No states/provinces data found"
        exit 1
    fi
    
    echo "✅ All components verified successfully"
}

# Main installation process
main() {
    echo "🔧 Starting Nextlog database installation..."
    echo "   Database: $DB_NAME"
    echo "   User: $DB_USER"
    echo "   Host: $DB_HOST:$DB_PORT"
    echo ""
    
    # Set PostgreSQL password
    export PGPASSWORD="$DB_PASSWORD"
    
    # Check if database exists
    if check_database; then
        echo "⚠️  Database '$DB_NAME' already exists!"
        read -p "Do you want to drop and recreate it? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "🗑️  Dropping existing database..."
            dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"
            create_database
        else
            echo "❌ Installation cancelled"
            exit 1
        fi
    else
        create_database
    fi
    
    # Install schema
    install_schema
    
    # Load reference data
    load_dxcc_data
    load_states_data
    
    # Verify installation
    verify_installation
    
    echo ""
    echo "🎉 Nextlog database installation completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Start your Nextlog application"
    echo "2. Create your first user account"
    echo "3. Set up your station information"
    echo "4. Start logging contacts!"
    echo ""
    echo "Happy logging! 73 de Nextlog"
}

# Run the main function
main "$@"