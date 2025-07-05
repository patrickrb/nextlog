#!/bin/bash

# Docker cleanup script for NodeLog

echo "🧹 Cleaning up NodeLog Docker environment..."

# Stop and remove containers
echo "🛑 Stopping containers..."
docker-compose down

# Remove images
echo "🗑️  Removing images..."
docker rmi nodelog-nodelog-app 2>/dev/null || true

# Remove volumes (optional - comment out if you want to keep data)
read -p "🗄️  Remove database volumes? This will delete all data! (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️  Removing volumes..."
    docker-compose down -v
    docker volume rm nodelog_mongodb_data 2>/dev/null || true
fi

# Remove unused Docker resources
echo "🧽 Cleaning up unused Docker resources..."
docker system prune -f

echo "✅ Cleanup complete!"