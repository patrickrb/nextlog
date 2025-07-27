# Nextlog Installation Guide

This guide covers the complete installation process for Nextlog, including all database setup, migrations, and reference data loading.

## Quick Start

### Option 1: Local Development (Recommended for first-time setup)

1. **Run the complete installation script:**
   ```bash
   ./install.sh
   ```
   
   This script will:
   - Install PostgreSQL (if not present)
   - Install Node.js dependencies
   - Set up PostgreSQL user and database
   - Install complete database schema
   - Apply all migrations
   - Load reference data (DXCC entities and states/provinces)
   - Create environment configuration
   - Verify installation

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   Navigate to http://localhost:3000

### Option 2: Docker Development

1. **Start with Docker Compose:**
   ```bash
   docker-compose up -d
   ```
   
   The Docker setup automatically:
   - Initializes PostgreSQL database
   - Installs complete schema and migrations
   - Loads all reference data
   - Starts the Next.js development server

2. **Access the application:**
   - Application: http://localhost:3000
   - PgAdmin: http://localhost:8081 (admin@nextlog.com / admin123)

## What's Included

### Database Schema
- **13 core tables** including users, stations, contacts, QSL images
- **LoTW integration** with credential management and sync logs
- **Award tracking** with system settings
- **Admin features** with audit logging
- **Complete indexing** for optimal performance

### Reference Data
- **402 DXCC entities** for country/territory tracking
- **1851 states/provinces** for award calculations (WAS, etc.)
- **System settings** with ADIF import limits

### Migrations
All database migrations are automatically applied:
- LoTW integration tables and fields
- QSL image storage
- Station logbooks
- System settings
- Admin features

## Manual Installation Steps

If you prefer to run individual steps:

### 1. Install Prerequisites

**macOS:**
```bash
# Install PostgreSQL
brew install postgresql@15
brew services start postgresql@15

# Install Node.js dependencies
npm install
```

**Linux:**
```bash
# Install PostgreSQL (Ubuntu/Debian)
sudo apt-get install postgresql postgresql-contrib

# Install Node.js dependencies
npm install
```

### 2. Database Setup

```bash
# Create user and database
createuser -s nextlog
createdb nextlog -O nextlog

# Install schema
psql -U nextlog -d nextlog -f install-database.sql

# Apply migrations
psql -U nextlog -d nextlog -f postgres-lotw-migration.sql
for file in scripts/add-*.sql scripts/migrate-*.sql; do
  psql -U nextlog -d nextlog -f "$file"
done

# Load reference data
psql -U nextlog -d nextlog -f scripts/dxcc_entities.sql
psql -U nextlog -d nextlog -f scripts/states_provinces_import.sql
```

### 3. Environment Configuration

Create `.env.local`:
```env
DATABASE_URL="postgresql://nextlog:password@localhost:5432/nextlog"
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"
NODE_ENV=development
```

## Troubleshooting

### PostgreSQL Connection Issues

**Check if PostgreSQL is running:**
```bash
# macOS
brew services list | grep postgresql

# Linux
sudo systemctl status postgresql
```

**Reset database:**
```bash
dropdb nextlog
createdb nextlog -O nextlog
./install.sh
```

### Docker Issues

**Rebuild containers:**
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

**Check logs:**
```bash
docker logs nextlog-app
docker logs nextlog-postgres
```

### Reference Data Missing

If DXCC entities or states/provinces data is missing:

```bash
# Check current counts
psql -U nextlog -d nextlog -c "SELECT COUNT(*) FROM dxcc_entities;"
psql -U nextlog -d nextlog -c "SELECT COUNT(*) FROM states_provinces;"

# Reload if needed
psql -U nextlog -d nextlog -f scripts/dxcc_entities.sql
psql -U nextlog -d nextlog -f scripts/states_provinces_import.sql
```

Expected counts:
- DXCC entities: 402
- States/provinces: 1851

## Features Enabled by Complete Installation

### Award Tracking
- **WAS (Worked All States)** - Requires states/provinces data
- **DXCC** - Requires DXCC entities data
- **LoTW integration** - Automatic confirmation matching

### QSL Management
- **Image uploads** to Azure Blob Storage
- **Front/back QSL card storage**
- **Automatic file management**

### Station Management
- **Multiple station support**
- **Automatic default station assignment**
- **Complete station metadata**

### Admin Features
- **User management**
- **Storage configuration**
- **Audit logging**
- **System settings**

## Next Steps

After installation:

1. **Create your first user account** at http://localhost:3000
2. **Set up your station information** in Settings
3. **Configure integrations** (QRZ, LoTW) if needed
4. **Import existing logs** or start logging new contacts
5. **Set up awards tracking** to monitor your progress

## Support

For issues or questions:
- Check the troubleshooting section above
- Review Docker/application logs
- Ensure all reference data is loaded correctly
- Verify environment configuration matches your setup