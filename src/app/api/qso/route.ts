// Direct Cloudlog compatibility endpoint for QSO operations
// This handles the /api/qso path that many logging programs expect

import { NextRequest } from 'next/server';

// Import the handlers from our main Cloudlog API
import { 
  GET as CloudlogGET, 
  POST as CloudlogPOST, 
  PUT as CloudlogPUT, 
  DELETE as CloudlogDELETE 
} from '../cloudlog/qso/route';

// Forward all requests to the main Cloudlog QSO API
export async function GET(request: NextRequest) {
  return CloudlogGET(request);
}

export async function POST(request: NextRequest) {
  return CloudlogPOST(request);
}

export async function PUT(request: NextRequest) {
  return CloudlogPUT(request);
}

export async function DELETE(request: NextRequest) {
  return CloudlogDELETE(request);
}