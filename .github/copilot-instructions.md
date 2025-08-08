# Nextlog - Amateur Radio Logging Software

Nextlog is a modern Next.js 15 amateur radio logging application with PostgreSQL database, built with TypeScript and Tailwind CSS. This application provides comprehensive contact logging, award tracking, LoTW integration, and Cloudlog API compatibility for third-party amateur radio software.

**ALWAYS reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.**

## Working Effectively

### Initial Repository Setup

**NEVER CANCEL builds or database operations - they may take significant time and are critical for functionality.**

1. **Clone and bootstrap the repository:**
   ```bash
   git clone <repository-url>
   cd nextlog
   npm install
   ```
   - npm install takes ~1 minute, NEVER CANCEL
   - Set timeout to 5+ minutes

2. **Database setup (PostgreSQL required):**
   ```bash
   # Install PostgreSQL if not available
   sudo apt-get install postgresql postgresql-contrib  # Linux
   brew install postgresql@15 && brew services start postgresql@15  # macOS
   
   # Run complete database setup - TAKES 10+ MINUTES
   ./install-database.sh
   ```
   - Database installation takes ~10 minutes, NEVER CANCEL
   - Set timeout to 15+ minutes
   - Creates user, database, schema, and loads 402 DXCC entities + 1851 states/provinces
   - Script is interactive and may prompt for database recreation

3. **Environment configuration:**
   ```bash
   cp .env.example .env.local
   ```
   Required environment variables:
   ```env
   DATABASE_URL="postgresql://nextlog:password@localhost:5432/nextlog"
   JWT_SECRET="your-secret-key-here"
   NEXTAUTH_URL="http://localhost:3000"
   ENCRYPTION_SECRET="your-encryption-key-for-lotw-passwords"
   ```

### Build and Development

4. **Build the application:**
   ```bash
   npm run build
   ```
   - Build takes ~45 seconds, NEVER CANCEL
   - Set timeout to 2+ minutes
   - Builds successfully even without database connection
   - Generates ~79 routes including API endpoints

5. **Start development server:**
   ```bash
   npm run dev
   ```
   - Starts on http://localhost:3000
   - Uses Turbopack for fast hot reloading
   - Requires database connection for full functionality

6. **Linting and code quality:**
   ```bash
   npm run lint
   ```
   - Takes ~10 seconds
   - Uses Next.js ESLint configuration
   - Always run before committing changes

## Validation and Testing

### Manual Functional Testing

**ALWAYS test complete user workflows after making changes:**

1. **First-time setup workflow:**
   - Navigate to http://localhost:3000 (redirects to /install)
   - Complete installation form with admin user details
   - Installation process takes ~1 minute with 6 steps
   - Should redirect to login page with success message

2. **User authentication workflow:**
   - Log in with created admin credentials
   - Should redirect to /dashboard
   - Verify navigation (Contacts, Tools, Data menus work)

3. **Contact logging workflow:**
   - Click "New Contact" button
   - Fill required fields: Callsign, Frequency, Mode, Band
   - Verify dropdowns populate correctly
   - Test QRZ.com lookup functionality (if configured)

4. **API endpoint testing:**
   ```bash
   # Test install status
   curl http://localhost:3000/api/install/check
   
   # Test Cloudlog API compatibility
   curl http://localhost:3000/api/cloudlog
   ```

### Docker Development (Alternative)

**Docker setup for complete environment:**
```bash
# Start complete environment - TAKES 5+ MINUTES
docker compose up -d
```
- Downloads and builds images: ~5 minutes, NEVER CANCEL
- Set timeout to 10+ minutes
- Includes PostgreSQL, application, and pgAdmin
- Access application: http://localhost:3000
- Access pgAdmin: http://localhost:8081 (admin@nextlog.com / admin123)

## Critical Build Information

### Timeout Requirements
- **npm install**: 5+ minutes (network dependent)
- **Database setup**: 15+ minutes (loads extensive reference data)
- **npm run build**: 2+ minutes (optimized production build)
- **Docker compose up**: 10+ minutes (first run with image downloads)

### Expected Build Behavior
- Build succeeds without database connection
- Development server requires database for full functionality
- Database installation is ONE-TIME operation (persists data)
- No test suite present - rely on manual validation

## Key Components and Architecture

### Database Schema
- **Core tables**: users, stations, contacts, dxcc_entities, states_provinces
- **Integration**: qsl_images, lotw_credentials, api_keys
- **Reference data**: 402 DXCC entities, 1851 states/provinces loaded automatically
- **Functions**: Automatic timestamp updates, station management triggers

### API Endpoints
- **Authentication**: /api/auth/login, /api/auth/register
- **Contacts**: /api/contacts (CRUD operations)
- **Cloudlog compatibility**: /api/cloudlog/* (SmartSDR, HRD, WSJT-X integration)
- **Awards**: /api/awards/dxcc, /api/awards/was
- **Admin**: /api/admin/* (user management, settings)

### Key Features to Test
- **Multi-station support**: Users can have multiple amateur radio stations
- **Cloudlog API**: Full compatibility with third-party logging software
- **LoTW integration**: Automatic upload/download with Logbook of the World
- **Award tracking**: DXCC and WAS (Worked All States) progress
- **QSL management**: Image uploads for QSL cards

## Navigation and Code Organization

### Important Directories
- `src/app/` - Next.js app router pages and API routes
- `src/components/` - Reusable React components
- `src/models/` - Database models and business logic
- `src/types/` - TypeScript type definitions
- `scripts/` - Database setup and migration scripts

### Key Files to Know
- `install-database.sh` - Complete database setup script
- `postgres-init.sql` - Docker PostgreSQL initialization
- `src/app/api/cloudlog/` - Third-party API compatibility
- `src/app/install/` - First-time setup workflow
- `src/components/ui/` - Shadcn/ui component library

### Configuration Files
- `next.config.ts` - Next.js configuration with Docker support
- `tailwind.config.ts` - Tailwind CSS customization
- `eslint.config.mjs` - ESLint configuration
- `docker-compose.yml` - Development environment setup

## Integration Points

### Amateur Radio Specific Features
- **ADIF import/export**: Industry standard file format
- **Frequency/band validation**: Amateur radio frequency allocations
- **Grid square calculations**: Maidenhead locator system
- **DXpedition tracking**: Current and upcoming DX operations
- **Propagation prediction**: Solar data integration

### Third-party Integrations
- **QRZ.com**: Callsign lookup and verification
- **LoTW**: ARRL Logbook of the World
- **SmartSDR**: FlexRadio automatic logging
- **Azure Storage**: QSL card image storage

## Common Development Tasks

### Adding New Features
1. **Always check existing API endpoints** - extensive API already exists
2. **Follow existing patterns** in src/app/ for pages and API routes
3. **Use existing UI components** from src/components/ui/
4. **Test with real amateur radio data** - use realistic callsigns and frequencies

### Database Changes
1. **Never modify install-database.sql directly** - create migration scripts
2. **Always test with reference data** - DXCC/states data is critical
3. **Verify indexes** - contact lookups must be fast
4. **Test station relationships** - users can have multiple stations

### Debugging Issues
1. **Check database connection** - many features require PostgreSQL
2. **Verify environment variables** - JWT_SECRET and DATABASE_URL required
3. **Test API endpoints directly** - use curl for debugging
4. **Check amateur radio data validity** - frequencies, callsigns, grids

## Known Limitations and Workarounds

### Development Environment
- **Docker networking issues**: Use local PostgreSQL if Docker fails
- **Port conflicts**: Application uses port 3000, PostgreSQL uses 5432
- **Map tiles blocked**: OpenStreetMap tiles may be blocked in some environments

### Amateur Radio Specifics
- **Callsign validation**: Must follow amateur radio callsign patterns
- **Frequency allocations**: Application validates against amateur bands
- **Grid square format**: Must be valid Maidenhead locator (e.g., FN31pr)

## Performance Considerations

### Database Operations
- **Contact searches**: Indexed on callsign, date, band, mode
- **DXCC lookups**: Prefix matching for country identification
- **Award calculations**: Optimized queries for progress tracking

### Client-Side Performance
- **Map rendering**: Leaflet maps with contact markers
- **Real-time updates**: WebSocket integration for live logging
- **Responsive design**: Works on mobile devices for field operations

---

**Remember**: Always follow these instructions first. The application is feature-complete for amateur radio logging with extensive APIs and integrations. Focus on testing complete user workflows rather than individual components.