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
   - npm install takes ~55 seconds, NEVER CANCEL
   - Set timeout to 300 seconds (5+ minutes) for network variations

2. **Database setup (PostgreSQL required):**
   ```bash
   # Start PostgreSQL if not running
   sudo systemctl start postgresql  # Linux
   brew services start postgresql@15  # macOS
   
   # Create PostgreSQL user (one-time setup)
   sudo -u postgres createuser -d -r -s nextlog
   sudo -u postgres psql -c "ALTER USER nextlog PASSWORD 'password';"
   
   # Run complete database setup - TAKES 2-3 SECONDS
   chmod +x install-database.sh
   echo "y" | ./install-database.sh
   ```
   - Database installation takes ~2 seconds (much faster than expected), NEVER CANCEL
   - Set timeout to 60 seconds for safety
   - Creates user, database, schema, and loads 402 DXCC entities + 1851 states/provinces
   - Script is interactive but can be automated with "y" input

3. **Environment configuration:**
   ```bash
   cp .env.example .env.local
   ```
   Required environment variables:
   ```env
   DATABASE_URL="postgresql://nextlog:password@localhost:5432/nextlog"
   JWT_SECRET="your-secret-key-here-change-in-production"
   NEXTAUTH_URL="http://localhost:3000"
   ENCRYPTION_SECRET="your-encryption-key-for-lotw-passwords"
   ```

### Build and Development

4. **Build the application:**
   ```bash
   npm run build
   ```
   - Build takes ~45 seconds, NEVER CANCEL
   - Set timeout to 300 seconds (5+ minutes)
   - Builds successfully even without database connection
   - Generates ~80 routes including API endpoints

5. **Start development server:**
   ```bash
   npm run dev
   ```
   - Starts on http://localhost:3000
   - Uses Turbopack for fast hot reloading (~1 second startup)
   - Requires database connection for full functionality

6. **Linting and code quality:**
   ```bash
   npm run lint
   ```
   - Takes ~2.5 seconds
   - Uses Next.js ESLint configuration
   - Always run before committing changes

## Validation and Testing

### Playwright Test Suite

**ALWAYS run the test suite to validate changes:**
```bash
npm run test
```
- Takes ~85 seconds with 38 tests, NEVER CANCEL
- Set timeout to 300 seconds (5+ minutes)
- May have 1-2 flaky tests (normal behavior)
- Tests cover authentication, navigation, forms, responsiveness, and core features

### Manual Functional Testing

**ALWAYS test complete user workflows after making changes:**

1. **First-time setup workflow:**
   - Navigate to http://localhost:3000 (redirects to /install)
   - Complete installation form with admin user details
   - Installation process takes ~30 seconds with 6 steps
   - Should redirect to login page with success message

2. **User authentication workflow:**
   - Log in with created admin credentials
   - Should redirect to /dashboard
   - Verify navigation (Contacts, Tools, Data menus work)

3. **Contact logging workflow:**
   - Click "New Contact" button
   - Fill required fields: Callsign (e.g., W1AW), Frequency (e.g., 14.205), Mode (SSB), Band (auto-selects 20M)
   - Verify dropdowns populate correctly and frequency auto-selects band
   - Test QRZ.com lookup functionality (enabled when callsign entered)
   - Save contact and verify it appears on dashboard with updated stats

4. **API endpoint testing:**
   ```bash
   # Test install status
   curl http://localhost:3000/api/install/check
   
   # Test Cloudlog API compatibility
   curl http://localhost:3000/api/cloudlog
   ```

### Docker Development (Alternative)

**WARNING: Docker setup may fail in CI environments due to network restrictions:**
```bash
# Start complete environment - MAY FAIL
docker compose up -d
```
- May fail with "Permission denied" accessing Alpine repositories
- If successful: Downloads and builds images ~5+ minutes, NEVER CANCEL
- Set timeout to 600 seconds (10+ minutes)
- Includes PostgreSQL, application, and pgAdmin
- Access application: http://localhost:3000
- Access pgAdmin: http://localhost:8081 (admin@nextlog.com / admin123)

## Critical Build Information

### Timeout Requirements (VALIDATED)
- **npm install**: 300 seconds (55 seconds actual + network buffer)
- **Database setup**: 60 seconds (2 seconds actual + safety buffer)
- **npm run build**: 300 seconds (45 seconds actual + compilation buffer)
- **npm run test**: 300 seconds (85 seconds actual + test buffer)
- **Docker compose up**: 600 seconds (if network permits)

### Expected Build Behavior
- Build succeeds without database connection
- Development server requires database for full functionality
- Database installation is ONE-TIME operation (persists data)
- Comprehensive test suite using Playwright validates functionality

## Key Components and Architecture

### Database Schema (VALIDATED)
- **Core tables**: users, stations, contacts, dxcc_entities, states_provinces
- **Integration**: qsl_images, lotw_credentials, api_keys
- **Reference data**: 402 DXCC entities, 1851 states/provinces loaded automatically
- **Functions**: Automatic timestamp updates, station management triggers
- **Database creation**: ~2 seconds with all data (much faster than expected)

### API Endpoints (VALIDATED)
- **Authentication**: /api/auth/login, /api/auth/register
- **Contacts**: /api/contacts (CRUD operations)
- **Cloudlog compatibility**: /api/cloudlog/* (SmartSDR, HRD, WSJT-X integration)
- **Awards**: /api/awards/dxcc, /api/awards/was
- **Admin**: /api/admin/* (user management, settings)
- **Install**: /api/install/check, /api/install/create-admin
- **All endpoints respond correctly with proper JSON**

### Key Features (VALIDATED)
- **Multi-station support**: Users can have multiple amateur radio stations
- **Cloudlog API**: Full compatibility with third-party logging software
- **LoTW integration**: Automatic upload/download with Logbook of the World
- **Award tracking**: DXCC and WAS (Worked All States) progress
- **QSL management**: Image uploads for QSL cards
- **Real-time contact logging**: Live logging toggle for current operations
- **Frequency/band validation**: Auto-selects band from frequency (e.g., 14.205 → 20M)

## Navigation and Code Organization

### Important Directories
- `src/app/` - Next.js app router pages and API routes
- `src/components/` - Reusable React components
- `src/models/` - Database models and business logic
- `src/types/` - TypeScript type definitions
- `scripts/` - Database setup and migration scripts
- `tests/` - Playwright end-to-end test suite

### Key Files to Know
- `install-database.sh` - Complete database setup script (fast execution)
- `postgres-init.sql` - Docker PostgreSQL initialization
- `src/app/api/cloudlog/` - Third-party API compatibility
- `src/app/install/` - First-time setup workflow
- `src/components/ui/` - Shadcn/ui component library
- `tests/*.spec.ts` - Comprehensive Playwright test suite

### Configuration Files
- `next.config.ts` - Next.js configuration with Docker support
- `tailwind.config.ts` - Tailwind CSS customization
- `eslint.config.mjs` - ESLint configuration
- `docker-compose.yml` - Development environment setup
- `playwright.config.ts` - End-to-end test configuration

## Integration Points

### Amateur Radio Specific Features (VALIDATED)
- **ADIF import/export**: Industry standard file format
- **Frequency/band validation**: Amateur radio frequency allocations (14.205 → 20M)
- **Grid square calculations**: Maidenhead locator system
- **DXpedition tracking**: Current and upcoming DX operations (live data)
- **Propagation prediction**: Solar data integration

### Third-party Integrations
- **QRZ.com**: Callsign lookup and verification (button enabled with callsign)
- **LoTW**: ARRL Logbook of the World
- **SmartSDR**: FlexRadio automatic logging
- **Azure Storage**: QSL card image storage

## Common Development Tasks

### Adding New Features
1. **Always check existing API endpoints** - extensive API already exists
2. **Follow existing patterns** in src/app/ for pages and API routes
3. **Use existing UI components** from src/components/ui/
4. **Test with real amateur radio data** - use realistic callsigns and frequencies
5. **Always run test suite** - npm run test validates UI and functionality

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
5. **Run test suite** - npm run test catches common issues

## Known Limitations and Workarounds

### Development Environment (VALIDATED)
- **Docker networking issues**: Use local PostgreSQL if Docker fails (common in CI)
- **Port conflicts**: Application uses port 3000, PostgreSQL uses 5432
- **Map tiles blocked**: OpenStreetMap tiles may be blocked in some environments (expect errors)
- **Alpine package access**: Docker build may fail due to repository access restrictions

### Amateur Radio Specifics (VALIDATED)
- **Callsign validation**: Must follow amateur radio callsign patterns
- **Frequency allocations**: Application validates against amateur bands and auto-selects
- **Grid square format**: Must be valid Maidenhead locator (e.g., FN31pr)
- **QRZ lookup**: Requires QRZ credentials configuration, otherwise button is disabled

## Performance Considerations

### Database Operations (VALIDATED)
- **Contact searches**: Indexed on callsign, date, band, mode
- **DXCC lookups**: Prefix matching for country identification
- **Award calculations**: Optimized queries for progress tracking
- **Installation speed**: Complete setup in ~2 seconds vs expected 10+ minutes

### Client-Side Performance (VALIDATED)
- **Map rendering**: Leaflet maps with contact markers (may have tile loading issues)
- **Real-time updates**: WebSocket integration for live logging
- **Responsive design**: Works on mobile devices for field operations
- **Dashboard stats**: Real-time QSO counts and recent activity

---

**Remember**: Always follow these instructions first. The application is feature-complete for amateur radio logging with extensive APIs and integrations. Focus on testing complete user workflows rather than individual components. All timings have been validated and are much faster than originally documented.