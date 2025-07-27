#!/bin/bash

# Nextlog Complete Installation Script
# This script sets up everything needed for Nextlog development

set -e  # Exit on any error

echo "🚀 Nextlog Complete Installation Script"
echo "======================================"

# Configuration
DB_NAME="nextlog"
DB_USER="nextlog"
DB_PASSWORD="password"
DB_HOST="localhost"
DB_PORT="5432"

# Check operating system
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
else
    echo "❌ Unsupported operating system: $OSTYPE"
    exit 1
fi

echo "🔍 Detected OS: $OS"

# Function to install PostgreSQL
install_postgresql() {
    echo "📦 Installing PostgreSQL..."
    
    if [[ "$OS" == "macos" ]]; then
        if ! command -v brew &> /dev/null; then
            echo "❌ Homebrew is required for PostgreSQL installation on macOS"
            echo "Please install Homebrew first: https://brew.sh"
            exit 1
        fi
        
        brew install postgresql@15
        brew services start postgresql@15
        
        # Add PostgreSQL to PATH
        export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"
        echo 'export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"' >> ~/.zshrc
        
    elif [[ "$OS" == "linux" ]]; then
        # Ubuntu/Debian
        if command -v apt-get &> /dev/null; then
            sudo apt-get update
            sudo apt-get install -y postgresql postgresql-contrib
            sudo systemctl start postgresql
            sudo systemctl enable postgresql
        # CentOS/RHEL/Fedora
        elif command -v yum &> /dev/null; then
            sudo yum install -y postgresql postgresql-server postgresql-contrib
            sudo postgresql-setup initdb
            sudo systemctl start postgresql
            sudo systemctl enable postgresql
        else
            echo "❌ Unsupported Linux distribution"
            exit 1
        fi
    fi
    
    echo "✅ PostgreSQL installed successfully"
}

# Function to install Node.js dependencies
install_node_dependencies() {
    echo "📦 Installing Node.js dependencies..."
    
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js is not installed"
        echo "Please install Node.js first: https://nodejs.org"
        exit 1
    fi
    
    npm install
    echo "✅ Node.js dependencies installed successfully"
}

# Function to install Docker (optional)
install_docker() {
    echo "🐳 Installing Docker (optional for containerized development)..."
    
    if [[ "$OS" == "macos" ]]; then
        if ! command -v brew &> /dev/null; then
            echo "⚠️  Skipping Docker installation (Homebrew not available)"
            return
        fi
        brew install --cask docker
    elif [[ "$OS" == "linux" ]]; then
        # Install Docker using official script
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        sudo usermod -aG docker $USER
        rm get-docker.sh
        echo "⚠️  Please log out and back in for Docker group changes to take effect"
    fi
    
    echo "✅ Docker installation completed"
}

# Function to setup PostgreSQL user and database
setup_postgresql() {
    echo "🔧 Setting up PostgreSQL user and database..."
    
    # Create user and database
    if [[ "$OS" == "macos" ]]; then
        createuser -s "$DB_USER" 2>/dev/null || true
        createdb "$DB_NAME" -O "$DB_USER" 2>/dev/null || true
    elif [[ "$OS" == "linux" ]]; then
        sudo -u postgres createuser -s "$DB_USER" 2>/dev/null || true
        sudo -u postgres createdb "$DB_NAME" -O "$DB_USER" 2>/dev/null || true
        
        # Set password for user
        sudo -u postgres psql -c "ALTER USER $DB_USER PASSWORD '$DB_PASSWORD';" 2>/dev/null || true
    fi
    
    echo "✅ PostgreSQL user and database setup completed"
}

# Function to check if database exists
check_database() {
    if [[ "$OS" == "macos" ]]; then
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"
    elif [[ "$OS" == "linux" ]]; then
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"
    fi
}

# Function to install database schema
install_database_schema() {
    echo "📦 Installing database schema..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Install main schema
    if [[ "$OS" == "macos" ]]; then
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f install-database.sql
    elif [[ "$OS" == "linux" ]]; then
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f install-database.sql
    fi
    
    echo "✅ Database schema installed successfully"
}

# Function to run migrations
run_migrations() {
    echo "🔄 Running database migrations..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Run LoTW migration
    if [[ "$OS" == "macos" ]]; then
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f postgres-lotw-migration.sql
    elif [[ "$OS" == "linux" ]]; then
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f postgres-lotw-migration.sql
    fi
    
    # Run additional migrations from scripts directory
    for migration_file in scripts/add-*.sql scripts/migrate-*.sql; do
        if [ -f "$migration_file" ]; then
            echo "  📝 Running migration: $(basename $migration_file)"
            if [[ "$OS" == "macos" ]]; then
                psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$migration_file"
            elif [[ "$OS" == "linux" ]]; then
                PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$migration_file"
            fi
        fi
    done
    
    echo "✅ Database migrations completed successfully"
}

# Function to load reference data
load_reference_data() {
    echo "🌍 Loading reference data..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Load DXCC entities
    if [ -f "scripts/dxcc_entities.sql" ]; then
        echo "  📡 Loading DXCC entities..."
        if [[ "$OS" == "macos" ]]; then
            psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f scripts/dxcc_entities.sql
        elif [[ "$OS" == "linux" ]]; then
            PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f scripts/dxcc_entities.sql
        fi
        
        # Count loaded entities
        local dxcc_count
        if [[ "$OS" == "macos" ]]; then
            dxcc_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM dxcc_entities;")
        elif [[ "$OS" == "linux" ]]; then
            dxcc_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM dxcc_entities;")
        fi
        echo "    📊 Loaded $dxcc_count DXCC entities"
    else
        echo "  ⚠️  DXCC entities file not found (scripts/dxcc_entities.sql)"
        echo "     You can add this later for complete functionality"
    fi
    
    # Load states/provinces
    if [ -f "scripts/states_provinces_import.sql" ]; then
        echo "  🗺️  Loading states/provinces..."
        if [[ "$OS" == "macos" ]]; then
            psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f scripts/states_provinces_import.sql
        elif [[ "$OS" == "linux" ]]; then
            PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f scripts/states_provinces_import.sql
        fi
        
        # Count loaded states/provinces
        local states_count
        if [[ "$OS" == "macos" ]]; then
            states_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM states_provinces;")
        elif [[ "$OS" == "linux" ]]; then
            states_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM states_provinces;")
        fi
        echo "    📊 Loaded $states_count states/provinces"
    else
        echo "  ⚠️  States/provinces file not found (scripts/states_provinces_import.sql)"
        echo "     You can add this later for complete functionality"
    fi
    
    echo "✅ Reference data loaded successfully"
}

# Function to create environment file
create_env_file() {
    echo "⚙️  Creating environment configuration..."
    
    if [ ! -f ".env.local" ]; then
        cat > .env.local << EOF
# Database Configuration
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
POSTGRES_HOST=$DB_HOST
POSTGRES_PORT=$DB_PORT
POSTGRES_DB=$DB_NAME
POSTGRES_USER=$DB_USER
POSTGRES_PASSWORD=$DB_PASSWORD

# NextAuth Configuration
NEXTAUTH_SECRET="your-secret-key-here-change-in-production"
NEXTAUTH_URL="http://localhost:3000"

# Azure Storage (optional)
AZURE_STORAGE_ACCOUNT_NAME=""
AZURE_STORAGE_ACCOUNT_KEY=""
AZURE_STORAGE_CONTAINER_NAME=""

# Development
NODE_ENV=development
EOF
        echo "✅ Environment file created (.env.local)"
    else
        echo "⚠️  Environment file already exists"
    fi
}

# Function to verify installation
verify_installation() {
    echo "🔍 Verifying installation..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Check if all tables exist
    TABLES=(users stations contacts dxcc_entities states_provinces qsl_images storage_config admin_audit_log)
    for table in "${TABLES[@]}"; do
        local exists
        if [[ "$OS" == "macos" ]]; then
            exists=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\\dt $table" | grep -c "$table" || echo "0")
        elif [[ "$OS" == "linux" ]]; then
            exists=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\\dt $table" | grep -c "$table" || echo "0")
        fi
        
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
    echo "🔧 Starting Nextlog complete installation..."
    echo "   Database: $DB_NAME"
    echo "   User: $DB_USER"
    echo "   Host: $DB_HOST:$DB_PORT"
    echo ""
    
    # Check prerequisites
    if ! command -v psql &> /dev/null; then
        echo "🔄 PostgreSQL not found, installing..."
        install_postgresql
    else
        echo "✅ PostgreSQL already installed"
    fi
    
    # Install Node.js dependencies
    install_node_dependencies
    
    # Optionally install Docker
    read -p "Do you want to install Docker? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        install_docker
    fi
    
    # Setup PostgreSQL
    setup_postgresql
    
    # Check if database exists and handle accordingly
    if check_database; then
        echo "⚠️  Database '$DB_NAME' already exists!"
        read -p "Do you want to drop and recreate it? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "🗑️  Dropping existing database..."
            if [[ "$OS" == "macos" ]]; then
                dropdb "$DB_NAME" 2>/dev/null || true
                createdb "$DB_NAME" -O "$DB_USER"
            elif [[ "$OS" == "linux" ]]; then
                sudo -u postgres dropdb "$DB_NAME" 2>/dev/null || true
                sudo -u postgres createdb "$DB_NAME" -O "$DB_USER"
            fi
        else
            echo "❌ Installation cancelled"
            exit 1
        fi
    fi
    
    # Install database schema
    install_database_schema
    
    # Run migrations
    run_migrations
    
    # Load reference data
    load_reference_data
    
    # Create environment file
    create_env_file
    
    # Verify installation
    verify_installation
    
    echo ""
    echo "🎉 Nextlog installation completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Review and update .env.local with your settings"
    echo "2. Start the development server: npm run dev"
    echo "3. Open http://localhost:3000 in your browser"
    echo "4. Create your first user account"
    echo "5. Set up your station information"
    echo "6. Start logging contacts!"
    echo ""
    echo "Happy logging! 73 de Nextlog"
}

# Run the main function
main "$@"