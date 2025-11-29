// API utility functions for Nextlog
// Shared utilities for API routes

import { NextResponse } from 'next/server';

/**
 * Add rate limiting headers to API responses
 * @param response - NextResponse to add headers to
 * @param remaining - Remaining requests in current window
 * @param limit - Total rate limit per hour
 * @param resetTime - Optional reset timestamp (defaults to 1 hour from now)
 * @returns Response with rate limit headers added
 */
export function addRateLimitHeaders(
    response: NextResponse,
    remaining: number,
    limit: number,
    resetTime?: number
): NextResponse {
    const reset = resetTime || Math.floor(Date.now() / 1000 + 3600);

    response.headers.set('X-RateLimit-Limit', limit.toString());
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    response.headers.set('X-RateLimit-Reset', reset.toString());

    return response;
}

/**
 * Create a JSON response with rate limit headers
 * @param data - Response data
 * @param status - HTTP status code
 * @param remaining - Remaining requests
 * @param limit - Rate limit per hour
 * @returns NextResponse with JSON data and rate limit headers
 */
export function createRateLimitedResponse(
    data: unknown,
    status: number,
    remaining: number,
    limit: number
): NextResponse {
    const response = NextResponse.json(data, { status });
    return addRateLimitHeaders(response, remaining, limit);
}

/**
 * Create a successful JSON response with rate limit headers
 * @param data - Response data
 * @param remaining - Remaining requests
 * @param limit - Rate limit per hour
 * @returns NextResponse with JSON data and rate limit headers
 */
export function successWithRateLimit(
    data: unknown,
    remaining: number,
    limit: number
): NextResponse {
    return createRateLimitedResponse(data, 200, remaining, limit);
}

/**
 * Create an error response
 * @param message - Error message
 * @param status - HTTP status code
 * @returns NextResponse with error
 */
export function errorResponse(
    message: string,
    status: number = 500
): NextResponse {
    return NextResponse.json({ error: message }, { status });
}
