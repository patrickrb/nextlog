// API Authentication middleware for Cloudlog-compatible API
// Handles API key authentication and rate limiting

import { NextRequest } from 'next/server';
import { query } from '@/lib/db';

export interface ApiKeyAuth {
  userId: number;
  stationId: number | null;
  keyId: number;
  keyName: string;
  isReadOnly: boolean;
  rateLimitPerHour: number;
}

export interface ApiAuthResult {
  success: boolean;
  auth?: ApiKeyAuth;
  error?: string;
  statusCode?: number;
}

/**
 * Verify API key authentication
 * Supports both header-based and query parameter-based authentication
 * Uses only API key (Cloudlog-compatible approach)
 */
export async function verifyApiKey(request: NextRequest): Promise<ApiAuthResult> {
  try {
    // Try to get API key from different sources
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

    // 4. Check JSON body for POST requests
    if (!apiKey && (request.method === 'POST' || request.method === 'PUT')) {
      try {
        const body = await request.clone().json();
        if (body.api_key) {
          apiKey = body.api_key;
        } else if (body.key) {
          // SmartSDR sends API key as 'key' field
          apiKey = body.key;
        }
      } catch {
        // Ignore JSON parsing errors
      }
    }

    if (!apiKey) {
      return {
        success: false,
        error: 'API key is required',
        statusCode: 401
      };
    }
    
    // Validate API key format
    if (!isValidApiKeyFormat(apiKey)) {
      return {
        success: false,
        error: 'Invalid API key format',
        statusCode: 401
      };
    }

    // Look up the API key in the database
    const keyResult = await query(`
      SELECT 
        ak.id,
        ak.user_id,
        ak.station_id,
        ak.key_name,
        ak.is_active,
        ak.read_only,
        ak.rate_limit_per_hour,
        ak.expires_at,
        ak.last_used_at,
        ak.total_requests
      FROM api_keys ak
      WHERE ak.api_key = $1
    `, [apiKey]);

    if (keyResult.rows.length === 0) {
      return {
        success: false,
        error: 'Invalid API key',
        statusCode: 401
      };
    }

    const keyRecord = keyResult.rows[0];

    // Check if API key is enabled
    if (!keyRecord.is_active) {
      return {
        success: false,
        error: 'API key is disabled',
        statusCode: 401
      };
    }

    // Check if API key has expired
    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return {
        success: false,
        error: 'API key has expired',
        statusCode: 401
      };
    }

    // Check rate limiting
    const rateLimitCheck = await checkRateLimit(keyRecord.id, keyRecord.rate_limit_per_hour);
    if (!rateLimitCheck.allowed) {
      return {
        success: false,
        error: `Rate limit exceeded. Maximum ${keyRecord.rate_limit_per_hour} requests per hour.`,
        statusCode: 429
      };
    }

    // Update last used timestamp and request count
    await updateApiKeyUsage(keyRecord.id, request);

    return {
      success: true,
      auth: {
        userId: keyRecord.user_id,
        stationId: keyRecord.station_id,
        keyId: keyRecord.id,
        keyName: keyRecord.key_name,
        isReadOnly: keyRecord.read_only,
        rateLimitPerHour: keyRecord.rate_limit_per_hour
      }
    };

  } catch (error) {
    console.error('API key verification error:', error);
    return {
      success: false,
      error: 'Internal server error',
      statusCode: 500
    };
  }
}

/**
 * Check if the API key format is valid
 */
function isValidApiKeyFormat(key: string): boolean {
  return /^nextlog_[A-Za-z0-9]{32}$/.test(key);
}

/**
 * Check rate limiting for an API key
 */
async function checkRateLimit(keyId: number, limitPerHour: number): Promise<{ allowed: boolean; remaining: number }> {
  try {
    // Count requests in the last hour
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const countResult = await query(`
      SELECT COUNT(*) as request_count
      FROM api_key_usage_logs
      WHERE api_key_id = $1 AND created_at >= $2
    `, [keyId, hourAgo]);

    const currentCount = parseInt(countResult.rows[0].request_count);
    const remaining = Math.max(0, limitPerHour - currentCount);
    
    return {
      allowed: currentCount < limitPerHour,
      remaining
    };

  } catch (error) {
    console.error('Rate limit check error:', error);
    // On error, allow the request but log it
    return { allowed: true, remaining: 0 };
  }
}

/**
 * Update API key usage statistics and log the request
 */
async function updateApiKeyUsage(keyId: number, request: NextRequest): Promise<void> {
  try {
    const startTime = Date.now();
    
    // Update the API key's last_used_at and total_requests
    await query(`
      UPDATE api_keys 
      SET 
        last_used_at = CURRENT_TIMESTAMP,
        total_requests = total_requests + 1
      WHERE id = $1
    `, [keyId]);

    // Extract request information
    const url = new URL(request.url);
    const endpoint = url.pathname;
    const method = request.method;
    const userAgent = request.headers.get('user-agent') || '';
    const ipAddress = getClientIP(request);

    // Log the request (we'll update with response details later if needed)
    await query(`
      INSERT INTO api_key_usage_logs (
        api_key_id,
        endpoint,
        method,
        ip_address,
        user_agent,
        status_code,
        response_time_ms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      keyId,
      endpoint,
      method,
      ipAddress,
      userAgent,
      200, // Default to success, will be updated if needed
      Date.now() - startTime
    ]);

  } catch (error) {
    console.error('API key usage update error:', error);
    // Don't fail the request if logging fails
  }
}

/**
 * Extract client IP address from request
 */
function getClientIP(request: NextRequest): string | null {
  // Check various headers for the real client IP
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // Fallback to X-Real-IP header or null
  return request.headers.get('x-real-ip') || null;
}

/**
 * Middleware wrapper for API routes that require authentication
 */
export function withApiAuth(handler: (request: NextRequest, auth: ApiKeyAuth, context: Record<string, unknown>) => Promise<Response>) {
  return async (request: NextRequest, context: Record<string, unknown>) => {
    const authResult = await verifyApiKey(request);
    
    if (!authResult.success) {
      return new Response(JSON.stringify({
        success: false,
        error: authResult.error
      }), {
        status: authResult.statusCode || 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return handler(request, authResult.auth!, context);
  };
}

/**
 * Check if the authenticated user can perform write operations
 */
export function canWrite(auth: ApiKeyAuth): boolean {
  return !auth.isReadOnly;
}

/**
 * Check if the authenticated user can access a specific station
 */
export async function canAccessStation(auth: ApiKeyAuth, stationId: number): Promise<boolean> {
  // If the API key is tied to a specific station, only allow access to that station
  if (auth.stationId !== null) {
    return auth.stationId === stationId;
  }

  // Otherwise, check if the user owns the station
  try {
    const stationResult = await query(
      'SELECT user_id FROM stations WHERE id = $1',
      [stationId]
    );

    return stationResult.rows.length > 0 && stationResult.rows[0].user_id === auth.userId;
  } catch (error) {
    console.error('Station access check error:', error);
    return false;
  }
}