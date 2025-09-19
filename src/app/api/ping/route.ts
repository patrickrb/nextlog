// API health check endpoint
// GET: Health check with API key validation
// This endpoint provides a simple health check that validates API keys for client applications

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
    // Verify API key authentication
    const authResult = await verifyApiKey(request);
    
    if (!authResult.success) {
      // Handle database connection errors gracefully for health checks
      let statusCode = authResult.statusCode || 401;
      let errorMessage = authResult.error || 'Authentication failed';
      
      // If it's a server error but we haven't checked authentication yet,
      // return a more appropriate authentication error
      if (statusCode === 500 && errorMessage === 'Internal server error') {
        statusCode = 401;
        errorMessage = 'API key is required';
      }
      
      const response = NextResponse.json({
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString()
      }, { 
        status: statusCode 
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