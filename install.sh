#!/bin/bash

# Nextlog Docker-Only Installation Script
# This script sets up Node.js dependencies only - PostgreSQL runs in Docker

set -e  # Exit on any error

echo "🚀 Nextlog Docker-Only Installation Script"
echo "=========================================="
echo "📝 Note: This script does NOT install PostgreSQL locally"
echo "    Use Docker Compose for the complete environment"
echo ""

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

# Function to check for Docker
check_docker() {
    echo "🐳 Checking Docker installation..."
    
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker is not installed"
        echo "Please install Docker first:"
        echo "  macOS: https://docs.docker.com/desktop/mac/"
        echo "  Linux: https://docs.docker.com/engine/install/"
        echo ""
        echo "After installing Docker, run: docker-compose up -d"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        echo "❌ Docker Compose is not installed"
        echo "Please install Docker Compose first:"
        echo "  https://docs.docker.com/compose/install/"
        exit 1
    fi
    
    echo "✅ Docker and Docker Compose are installed"
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

# Function to create environment file
create_env_file() {
    echo "⚙️  Creating environment configuration..."
    
    if [ ! -f ".env.local" ]; then
        cat > .env.local << EOF
# Database Configuration (Docker)
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
NEXT_PUBLIC_API_URL=http://localhost:3000
JWT_SECRET=your-jwt-secret-key-for-development
ENCRYPTION_SECRET=supersecretkeyforencryption
EOF
        echo "✅ Environment file created (.env.local)"
    else
        echo "⚠️  Environment file already exists"
    fi
}

# Function to start Docker environment
start_docker_environment() {
    echo "🐳 Starting Docker environment..."
    
    if [ ! -f "docker-compose.yml" ]; then
        echo "❌ docker-compose.yml not found"
        echo "Please ensure you're in the Nextlog project directory"
        exit 1
    fi
    
    # Start Docker containers
    docker-compose up -d
    
    # Wait for PostgreSQL to be ready
    echo "⏳ Waiting for PostgreSQL to be ready..."
    sleep 10
    
    # Check if containers are running
    if docker-compose ps | grep -q "Up"; then
        echo "✅ Docker environment started successfully"
    else
        echo "❌ Failed to start Docker environment"
        exit 1
    fi
}

# Function to verify Docker environment
verify_docker_environment() {
    echo "🔍 Verifying Docker environment..."
    
    # Check if containers are running
    if ! docker-compose ps | grep -q "Up"; then
        echo "❌ Docker containers are not running"
        echo "Run: docker-compose up -d"
        return 1
    fi
    
    # Check if database is accessible
    if docker exec nextlog-postgres psql -U nextlog -d nextlog -c "SELECT 1;" >/dev/null 2>&1; then
        echo "✅ Database is accessible"
    else
        echo "❌ Database is not accessible"
        return 1
    fi
    
    echo "✅ Docker environment verified successfully"
}

# Main installation process
main() {
    echo "🔧 Starting Nextlog Docker-only setup..."
    echo "   This script only sets up Node.js dependencies"
    echo "   Database runs in Docker containers"
    echo ""
    
    # Check prerequisites
    check_docker
    
    # Install Node.js dependencies
    install_node_dependencies
    
    # Create environment file
    create_env_file
    
    # Start Docker environment
    start_docker_environment
    
    # Verify Docker environment
    verify_docker_environment
    
    echo ""
    echo "🎉 Nextlog Docker setup completed successfully!"
    echo ""
    echo "📋 What was set up:"
    echo "   ✅ Node.js dependencies installed"
    echo "   ✅ Environment file created (.env.local)"
    echo "   ✅ Docker containers started"
    echo "   ✅ PostgreSQL database ready"
    echo ""
    echo "🚀 Next steps:"
    echo "1. Start the development server: npm run dev"
    echo "2. Open http://localhost:3000 in your browser"
    echo "3. Create your first user account"
    echo "4. Set up your station information"
    echo "5. Start logging contacts!"
    echo ""
    echo "📝 Note: Database runs in Docker (no local PostgreSQL installed)"
    echo "   To stop: docker-compose down"
    echo "   To start: docker-compose up -d"
    echo ""
    echo "Happy logging! 73 de Nextlog"
}

# Run the main function
main "$@"