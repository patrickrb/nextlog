#!/bin/bash

# Docker development script for Nextlog

echo "🚀 Starting Nextlog in development mode with Docker..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    echo "📄 Creating .env.local from .env.docker..."
    cp .env.docker .env.local
fi

# Build and start services
echo "🔨 Building and starting services..."
docker-compose up --build -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 5

# Check if services are running
if docker-compose ps | grep -q "Up"; then
    echo "✅ Services are running!"
    echo ""
    echo "🌐 Application: http://localhost:3000"
    echo "📊 MongoDB Admin: http://localhost:8081"
    echo "   Username: admin"
    echo "   Password: admin123"
    echo ""
    echo "📝 To view logs:"
    echo "   docker-compose logs -f nextlog-app"
    echo ""
    echo "🛑 To stop services:"
    echo "   docker-compose down"
else
    echo "❌ Some services failed to start. Check logs with:"
    echo "   docker-compose logs"
fi