# NodeLog - Amateur Radio Logging Software

A modern, web-based amateur radio logging application built with Next.js and MongoDB. This is a clone of [Wavelog](https://github.com/wavelog/wavelog) with a modern tech stack.

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
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT-based authentication
- **Styling**: Tailwind CSS
- **Deployment**: Vercel-ready

## Getting Started

### Prerequisites

- Node.js 18+ 
- MongoDB database (local or cloud)
- Git

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd nodelog
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your settings:
```
MONGODB_URI=mongodb://localhost:27017/nodelog
JWT_SECRET=your-jwt-secret-key-change-this-in-production
```

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

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

### User Model
- Email, password, name
- Amateur radio callsign
- Grid locator
- Timestamps

### Contact Model
- User reference
- Callsign, frequency, mode, band
- Date/time of contact
- RST sent/received
- Operator name, QTH, grid locator
- QSL and LoTW status
- Notes and other details

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
