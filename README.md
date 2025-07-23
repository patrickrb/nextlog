# Nextlog - Amateur Radio Logging Software

A modern, web-based amateur radio logging application built with Next.js and PostgreSQL. This is a clone of [Wavelog](https://github.com/wavelog/wavelog) with a modern tech stack.

## Features

- **Contact Logging**: Log amateur radio contacts with detailed information
- **User Authentication**: Secure user registration and login system
- **Responsive Design**: Works on desktop and mobile devices
- **Modern UI**: Clean, intuitive interface built with Tailwind CSS
- **Search & Filter**: Find contacts quickly (coming soon)
- **Export Functionality**: Export logs in various formats (coming soon)

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

## Usage

1. **Register**: Create a new account with your amateur radio callsign
2. **Login**: Sign in to access your logbook
3. **Log Contacts**: Add new contacts with frequency, mode, RST, and other details
4. **View Logbook**: Browse your logged contacts on the dashboard

## API Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login  
- `POST /api/auth/logout` - User logout
- `GET /api/contacts` - Get user's contacts
- `POST /api/contacts` - Create new contact
- `GET /api/contacts/[id]` - Get specific contact
- `PUT /api/contacts/[id]` - Update contact
- `DELETE /api/contacts/[id]` - Delete contact

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
