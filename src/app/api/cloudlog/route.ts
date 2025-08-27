// Cloudlog-compatible API endpoint
// GET: API status and information
// This endpoint provides basic API information similar to Cloudlog

import { NextResponse } from 'next/server';
import { addCorsHeaders, createCorsPreflightResponse } from '@/lib/cors';

// OPTIONS /api/cloudlog - Handle CORS preflight requests
export async function OPTIONS() {
  return createCorsPreflightResponse();
}

export async function GET() {
  const response = NextResponse.json({
    success: true,
    api_name: 'Nextlog Cloudlog-compatible API',
    api_version: '1.0.0',
    cloudlog_compatibility: 'v2.7.0',
    description: 'Cloudlog-compatible API for amateur radio logging software integration',
    endpoints: {
      '/api/cloudlog/qso': 'QSO management (GET, POST, PUT, DELETE)',
      '/api/cloudlog/station': 'Station information',
      '/api/cloudlog/user': 'User information',
      '/api/cloudlog/bands': 'Available bands',
      '/api/cloudlog/modes': 'Available modes',
      '/api/cloudlog/dxcc': 'DXCC entities',
      '/api/cloudlog/awards': 'Award tracking'
    },
    authentication: {
      methods: [
        'API Key in X-API-Key header',
        'API Key in query parameter (api_key)',
        'Bearer token in Authorization header',
        'API Key in JSON body (for POST/PUT requests)'
      ],
      note: 'All API requests require a valid API key (Cloudlog-compatible format)'
    },
    rate_limiting: {
      default_limit: '1000 requests per hour per API key',
      headers: {
        'X-RateLimit-Limit': 'Maximum requests per hour',
        'X-RateLimit-Remaining': 'Remaining requests in current hour',
        'X-RateLimit-Reset': 'Unix timestamp when limit resets'
      }
    },
    created_by: 'Nextlog - Modern Amateur Radio Logging',
    documentation: '/api/cloudlog/docs'
  });
  
  return addCorsHeaders(response);
}