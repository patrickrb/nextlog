# Nextlog - Amateur Radio Logging Software

A modern, web-based amateur radio logging application built with Next.js and PostgreSQL. This is a clone of [Wavelog](https://github.com/wavelog/wavelog) with a modern tech stack.

## Features

- **Modern Amateur Radio Logging**: Clean, intuitive interface for logging QSOs
- **Multi-Station Support**: Manage multiple stations under one account
- **Award Tracking**: Built-in DXCC and WAS award progress tracking
- **LoTW Integration**: Automatic upload and download with Logbook of the World
- **QSL Management**: Track paper QSL cards with image uploads
- **Advanced Search**: Powerful filtering and search capabilities
- **Cloudlog API Compatibility**: Full compatibility with third-party logging software
- **SmartSDR Integration**: Direct QSO uploads from FlexRadio SmartSDR
- **API Key Management**: Secure authentication for third-party integrations
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Open Source**: MIT licensed and community-driven

## Technology Stack

- **Frontend**: Next.js 15 with TypeScript
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with native SQL
- **Authentication**: JWT-based authentication
- **Styling**: Tailwind CSS
- **Deployment**: Vercel-ready

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL 13+ database
- Docker and Docker Compose (recommended)
- Git

### Installation

#### Option 1: Docker Compose (Recommended)

1. Clone the repository:
```bash
git clone <repository-url>
cd nextlog
```

2. Start the application with Docker:
```bash
docker-compose up -d
```

This will start:
- PostgreSQL database on port 5432
- Nextlog application on port 3000
- PgAdmin (optional) on port 8081

3. Open [http://localhost:3000](http://localhost:3000) in your browser

#### Option 2: Manual Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd nextlog
```

2. Install dependencies:
```bash
npm install
```

3. Set up PostgreSQL database:
```bash
# Install and start PostgreSQL (method varies by OS)
# Create database and user
createuser -U postgres nextlog
createdb -U postgres -O nextlog nextlog
```

4. Run the database installation script:
```bash
./install-database.sh
```

5. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your settings:
```
DATABASE_URL=postgresql://nextlog:password@localhost:5432/nextlog
JWT_SECRET=your-jwt-secret-key-change-this-in-production
NEXT_PUBLIC_API_URL=http://localhost:3000
ENCRYPTION_SECRET=supersecretkeyforencryption
```

6. Start the development server:
```bash
npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000) in your browser

## Database Installation Script

Nextlog includes a comprehensive database installation script that sets up the complete schema and reference data.

### Features

- Creates all required tables (users, stations, contacts, dxcc_entities, states_provinces)
- Sets up indexes for optimal performance
- Installs database functions and triggers
- Loads DXCC entities data (340+ countries/entities)
- Loads states/provinces data for awards tracking
- Verifies installation completeness

### Usage

```bash
# Make the script executable
chmod +x install-database.sh

# Run the installation
./install-database.sh
```

The script will:
1. Create the database if it doesn't exist
2. Install the complete schema
3. Load reference data
4. Verify the installation

### Configuration

The script uses these default settings:
- Database: `nextlog`
- User: `nextlog`
- Password: `password`
- Host: `localhost`
- Port: `5432`

You can modify these values at the top of the `install-database.sh` file if needed.

### Required Files

The script requires these data files to be present:
- `scripts/dxcc_entities.sql` - DXCC entities reference data
- `scripts/states_provinces_import.sql` - States/provinces reference data

Both files are included in the repository.

## Testing

Nextlog includes comprehensive end-to-end tests using Playwright to ensure application stability and feature reliability.

### Running Tests

```bash
# Run all tests
npm test

# Run tests for specific browser
npm run test:chromium

# Run tests in headed mode (visible browser)
npm run test:headed

# Run tests in UI mode for debugging
npm run test:ui

# View test report
npm run test:report
```

### Test Coverage

The test suite covers:
- **Authentication**: Login and registration flows
- **Navigation**: Page routing and redirects  
- **Forms**: Input validation and submission
- **Responsive Design**: Mobile and desktop layouts
- **Error Handling**: Database connection failures
- **Core Features**: Contact management, awards, ADIF import/export
- **Build Quality**: JavaScript errors, CSS loading, performance
- **Security**: Protected routes and authentication redirects

### Continuous Integration

Tests run automatically on:
- Pull requests to main/develop branches
- Pushes to main/develop branches

The CI workflow requires all tests to pass before merging. See `/.github/workflows/ci.yml` and `/.github/branch-protection.md` for setup details.

See `/tests/README.md` for detailed testing documentation.

## Usage

1. **Register**: Create a new account with your amateur radio callsign
2. **Login**: Sign in to access your logbook
3. **Log Contacts**: Add new contacts with frequency, mode, RST, and other details
4. **View Logbook**: Browse your logged contacts on the dashboard

## Cloudlog API Compatibility

Nextlog provides full compatibility with Cloudlog's API, allowing you to use any third-party amateur radio software that supports Cloudlog integration.

### Supported Software

- **FlexRadio SmartSDR** - Direct QSO uploads
- **Ham Radio Deluxe** - Logging and rig control integration
- **N1MM Logger+** - Contest logging integration
- **WSJT-X** - Digital mode QSO uploads
- **Any software supporting Cloudlog API format**

### API Key Management

1. **Create API Key**: Go to Station Settings → API Key Management
2. **Configure Software**: Use the generated API key in your logging software
3. **Authentication**: API keys work with standard Cloudlog authentication methods

### API Endpoints

#### Authentication
All API requests require authentication using one of these methods:
- `X-API-Key: your_api_key` (header)
- `Authorization: Bearer your_api_key` (header)
- `api_key=your_api_key` (query parameter)
- `"key": "your_api_key"` (JSON body for POST/PUT)

#### Core API Endpoints

**API Information**
- `GET /api/cloudlog` - API status and information
- `GET /index.php/api` - Cloudlog compatibility endpoint

**QSO Management**
- `GET /api/cloudlog/qso` - Retrieve QSOs with filtering
- `POST /api/cloudlog/qso` - Create new QSO
- `PUT /api/cloudlog/qso` - Update existing QSO
- `DELETE /api/cloudlog/qso` - Delete QSO
- `POST /index.php/api/qso` - SmartSDR compatibility endpoint

**Station Information**
- `GET /api/cloudlog/station` - Get station information
- `GET /api/cloudlog/station?station_id=123` - Get specific station

**Reference Data**
- `GET /api/cloudlog/bands` - Get available bands
- `GET /api/cloudlog/modes` - Get available modes
- `GET /api/dxcc` - Get DXCC entities
- `GET /api/states` - Get states/provinces

#### QSO API Details

**Retrieve QSOs**
```bash
GET /api/cloudlog/qso?limit=100&offset=0&callsign=W1AW&band=20M&mode=SSB
```

Query Parameters:
- `limit` - Number of QSOs to return (max 1000, default 100)
- `offset` - Starting offset for pagination
- `callsign` - Filter by callsign
- `band` - Filter by band
- `mode` - Filter by mode
- `date_from` - Filter by start date (YYYY-MM-DD)
- `date_to` - Filter by end date (YYYY-MM-DD)
- `station_id` - Filter by station ID
- `confirmed` - Only confirmed QSOs (true/false)

**Create QSO**
```bash
POST /api/cloudlog/qso
Content-Type: application/json
X-API-Key: your_api_key

{
  "callsign": "W1AW",
  "band": "20M",
  "mode": "SSB",
  "rst_sent": "59",
  "rst_rcvd": "59",
  "qso_date": "2024-01-15",
  "time_on": "14:30:00",
  "freq": "14.205",
  "gridsquare": "FN31pr",
  "name": "John",
  "country": "United States",
  "state": "CT"
}
```

**SmartSDR ADIF Format**
```bash
POST /index.php/api/qso
Content-Type: application/json

{
  "key": "your_api_key",
  "station_profile_id": "1",
  "type": "adif",
  "string": "<CALL:4>W1AW<QSO_DATE:8>20240115<TIME_ON:6>143000<BAND:3>20M<MODE:3>SSB<RST_SENT:2>59<RST_RCVD:2>59<EOR>"
}
```

#### Response Format

**Success Response**
```json
{
  "success": true,
  "qsos": [...],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": 1500,
    "has_more": true
  }
}
```

**Error Response**
```json
{
  "success": false,
  "error": "Missing required field: callsign"
}
```

#### Rate Limiting

- Default: 1000 requests per hour per API key
- Headers included in responses:
  - `X-RateLimit-Limit` - Maximum requests per hour
  - `X-RateLimit-Remaining` - Remaining requests
  - `X-RateLimit-Reset` - Reset time (unix timestamp)

### SmartSDR Configuration

1. **Create API Key** in Nextlog station settings
2. **Configure SmartSDR**:
   - Open SmartSDR Settings
   - Go to Logbook section
   - Set URL: `http://your-nextlog-url/index.php/api/qso`
   - Set API Key: Your generated API key
   - Enable automatic QSO upload

### Integration Examples

**Ham Radio Deluxe Setup**
1. Go to Logbook → Online Logbook Services
2. Select "Cloudlog" 
3. URL: `http://your-nextlog-url/api/cloudlog`
4. API Key: Your generated API key

**WSJT-X Setup**
1. File → Settings → Reporting
2. Select "Cloudlog"
3. URL: `http://your-nextlog-url/api/cloudlog/qso`
4. API Key: Your generated API key

## Standard API Endpoints (Web Interface)

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login  
- `POST /api/auth/logout` - User logout
- `GET /api/contacts` - Get user's contacts
- `POST /api/contacts` - Create new contact
- `GET /api/contacts/[id]` - Get specific contact
- `PUT /api/contacts/[id]` - Update contact
- `DELETE /api/contacts/[id]` - Delete contact
- `GET /api/stations` - Get user's stations
- `POST /api/stations` - Create new station
- `GET /api/stations/[id]` - Get specific station
- `PUT /api/stations/[id]` - Update station
- `DELETE /api/stations/[id]` - Delete station

## Database Schema

### Users Table
- Email, password, name
- Amateur radio callsign
- Grid locator
- QRZ.com credentials
- Timestamps

### Stations Table
- Station information (callsign, name, operator)
- Location data (QTH, address, grid, lat/lon)
- Zone information (CQ, ITU)
- Equipment details (power, rig, antenna)
- Integration settings (QRZ, LoTW)
- Default station management

### Contacts Table
- User and station references
- Core contact data (callsign, frequency, mode, band, datetime)
- RST sent/received
- Location data (QTH, grid, lat/lon, country, state)
- DXCC and zone information
- QSL status (paper, eQSL, LoTW)
- Additional ADIF fields
- Notes and timestamps

### DXCC Entities Table
- ADIF entity codes
- Country/entity names and prefixes
- Zone information (CQ, ITU)
- Geographic coordinates
- Reference data for awards tracking

### States/Provinces Table
- State/province codes and names
- DXCC entity associations
- Zone information
- Reference data for awards tracking

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgments

- Inspired by [Wavelog](https://github.com/wavelog/wavelog)
- Built for the amateur radio community
