#!/bin/bash

# Nextlog Docker Database Installation Script
# This script sets up the complete Nextlog database schema for Docker containers

set -e  # Exit on any error

echo "🐳 Nextlog Docker Database Installation Script"
echo "=============================================="

# Configuration (for Docker containers)
DB_NAME="nextlog"
DB_USER="nextlog"
DB_PASSWORD="password"
DB_HOST="postgres"
DB_PORT="5432"

# Wait for PostgreSQL to be ready
wait_for_postgres() {
    echo "⏳ Waiting for PostgreSQL to be ready..."
    while ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1; do
        echo "  📡 PostgreSQL not ready yet, waiting..."
        sleep 2
    done
    echo "✅ PostgreSQL is ready"
}

# Function to install database schema
install_database_schema() {
    echo "📦 Installing database schema..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Install main schema
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f /app/install-database.sql
    
    echo "✅ Database schema installed successfully"
}

# Function to run migrations
run_migrations() {
    echo "🔄 Running database migrations..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Run LoTW migration
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f /app/postgres-lotw-migration.sql
    
    # Run additional migrations from scripts directory
    for migration_file in /app/scripts/add-*.sql /app/scripts/migrate-*.sql; do
        if [ -f "$migration_file" ]; then
            echo "  📝 Running migration: $(basename $migration_file)"
            PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$migration_file"
        fi
    done
    
    echo "✅ Database migrations completed successfully"
}

# Function to load reference data
load_reference_data() {
    echo "🌍 Loading reference data..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Load DXCC entities
    if [ -f "/app/scripts/dxcc_entities.sql" ]; then
        echo "  📡 Loading DXCC entities..."
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f /app/scripts/dxcc_entities.sql
        
        # Count loaded entities
        local dxcc_count
        dxcc_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM dxcc_entities;")
        echo "    📊 Loaded $dxcc_count DXCC entities"
    else
        echo "  ⚠️  DXCC entities file not found"
    fi
    
    # Load states/provinces
    if [ -f "/app/scripts/states_provinces_import.sql" ]; then
        echo "  🗺️  Loading states/provinces..."
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f /app/scripts/states_provinces_import.sql
        
        # Count loaded states/provinces
        local states_count
        states_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM states_provinces;")
        echo "    📊 Loaded $states_count states/provinces"
    else
        echo "  ⚠️  States/provinces file not found"
    fi
    
    echo "✅ Reference data loaded successfully"
}

# Function to verify installation
verify_installation() {
    echo "🔍 Verifying installation..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Check if all tables exist
    TABLES=(users stations contacts dxcc_entities states_provinces qsl_images storage_config admin_audit_log lotw_credentials lotw_upload_logs lotw_download_logs lotw_job_queue system_settings)
    for table in "${TABLES[@]}"; do
        local exists
        exists=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\\dt $table" | grep -c "$table" || echo "0")
        
        if [ "$exists" -gt 0 ]; then
            echo "  ✅ Table '$table' exists"
        else
            echo "  ❌ Table '$table' missing"
            return 1
        fi
    done
    
    echo "✅ All components verified successfully"
}

# Main installation process
main() {
    echo "🔧 Starting Nextlog Docker database installation..."
    echo "   Database: $DB_NAME"
    echo "   User: $DB_USER"
    echo "   Host: $DB_HOST:$DB_PORT"
    echo ""
    
    # Wait for PostgreSQL to be ready
    wait_for_postgres
    
    # Check if database is already initialized
    local table_count
    table_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")
    
    if [ "$table_count" -gt 5 ]; then
        echo "✅ Database appears to be already initialized ($table_count tables found)"
        echo "   Skipping installation..."
        return 0
    fi
    
    # Install database schema
    install_database_schema
    
    # Run migrations
    run_migrations
    
    # Load reference data
    load_reference_data
    
    # Verify installation
    verify_installation
    
    echo ""
    echo "🎉 Nextlog Docker database installation completed successfully!"
    echo ""
    echo "Database is ready for the application to connect."
}

# Run the main function
main "$@"