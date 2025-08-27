// CORS utility functions for API endpoints
// Enables GridTracker and other third-party amateur radio software integration

import { NextResponse } from 'next/server';

/**
 * Add CORS headers to a response for amateur radio software integration
 * Allows GridTracker and other desktop applications to access the API
 */
export function addCorsHeaders(response: NextResponse): NextResponse {
  // Allow requests from any origin for amateur radio software compatibility
  response.headers.set('Access-Control-Allow-Origin', '*');
  
  // Allow common HTTP methods used by logging software
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  
  // Allow headers commonly used for authentication and content
  response.headers.set(
    'Access-Control-Allow-Headers', 
    'Content-Type, X-API-Key, Authorization, X-Requested-With'
  );
  
  // Allow credentials for authenticated requests
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  
  // Cache preflight responses for 24 hours
  response.headers.set('Access-Control-Max-Age', '86400');
  
  return response;
}

/**
 * Create a CORS preflight response for OPTIONS requests
 * Required for GridTracker and other applications making complex requests
 */
export function createCorsPreflightResponse(): Response {
  const response = new Response(null, { status: 200 });
  
  // Set CORS headers
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set(
    'Access-Control-Allow-Headers', 
    'Content-Type, X-API-Key, Authorization, X-Requested-With'
  );
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Max-Age', '86400');
  
  return response;
}

/**
 * Wrap a JSON response with CORS headers
 * Convenience function for API endpoints
 */
export function corsJsonResponse(data: any, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(data, init);
  return addCorsHeaders(response);
}