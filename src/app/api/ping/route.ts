// API health check endpoint
// GET: Health check with API key validation
// This endpoint provides a simple health check that validates API keys for client applications
//
// Usage:
//   GET /api/ping
//   Authorization: Bearer <api_key>
//   OR X-API-Key: <api_key>
//   OR ?api_key=<api_key>
//
// Response (success):
//   {
//     "success": true,
//     "message": "API is healthy and API key is valid",
//     "api_name": "Nextlog API",
//     "api_version": "1.0.0", 
//     "timestamp": "2025-09-19T22:45:28.588Z",
//     "authenticated": true,
//     "api_key_info": {
//       "key_name": "My API Key",
//       "is_read_only": false,
//       "rate_limit_per_hour": 1000,
//       "station_id": 1
//     }
//   }
//
// Response (error):
//   {
//     "success": false,
//     "error": "API key is required",
//     "timestamp": "2025-09-19T22:45:28.588Z"
//   }

import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey } from '@/lib/api-auth';
import { addCorsHeaders, createCorsPreflightResponse } from '@/lib/cors';

// OPTIONS /api/ping - Handle CORS preflight requests
export async function OPTIONS() {
  return createCorsPreflightResponse();
}

// GET /api/ping - Health check with API key validation
export async function GET(request: NextRequest) {
  try {
    // First, extract the API key manually to provide better error messages
    let apiKey: string | null = null;

    // 1. Check Authorization header (Bearer token format)
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7);
    }

    // 2. Check X-API-Key header (Cloudlog style)
    if (!apiKey) {
      apiKey = request.headers.get('x-api-key');
    }

    // 3. Check query parameters (for simple integrations)
    if (!apiKey) {
      const url = new URL(request.url);
      apiKey = url.searchParams.get('api_key');
    }

    // Return appropriate error if no API key provided
    if (!apiKey) {
      const response = NextResponse.json({
        success: false,
        error: 'API key is required',
        timestamp: new Date().toISOString()
      }, { 
        status: 401 
      });
      return addCorsHeaders(response);
    }

    // Check API key format
    const isValidFormat = /^nextlog_[A-Za-z0-9]{32}$/.test(apiKey);
    if (!isValidFormat) {
      const response = NextResponse.json({
        success: false,
        error: 'Invalid API key format',
        timestamp: new Date().toISOString()
      }, { 
        status: 401 
      });
      return addCorsHeaders(response);
    }

    // Now verify API key authentication with database
    const authResult = await verifyApiKey(request);
    
    if (!authResult.success) {
      // If we have a valid format key but database validation fails, 
      // return the actual error from the auth system
      const response = NextResponse.json({
        success: false,
        error: authResult.error || 'Authentication failed',
        timestamp: new Date().toISOString()
      }, { 
        status: authResult.statusCode || 401 
      });
      return addCorsHeaders(response);
    }

    // API key is valid - return success response
    const response = NextResponse.json({
      success: true,
      message: 'API is healthy and API key is valid',
      api_name: 'Nextlog API',
      api_version: '1.0.0',
      timestamp: new Date().toISOString(),
      authenticated: true,
      api_key_info: {
        key_name: authResult.auth!.keyName,
        is_read_only: authResult.auth!.isReadOnly,
        rate_limit_per_hour: authResult.auth!.rateLimitPerHour,
        station_id: authResult.auth!.stationId
      }
    });
    
    return addCorsHeaders(response);

  } catch (error) {
    console.error('Ping endpoint error:', error);
    const response = NextResponse.json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    }, { 
      status: 500 
    });
    return addCorsHeaders(response);
  }
}