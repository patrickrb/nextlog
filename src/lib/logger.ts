// Logging utility for Nextlog
// Provides environment-aware, structured logging with different log levels

interface LogContext {
    [key: string]: unknown;
}

/**
 * Structured logger with environment-aware log levels
 */
export const logger = {
    /**
     * Debug logging - only shown in development environment
     * Use for detailed debugging information
     */
    debug: (message: string, context?: LogContext) => {
        if (process.env.NODE_ENV === 'development') {
            console.log(`[DEBUG] ${message}`, context || '');
        }
    },

    /**
     * Info logging - shown in all environments
     * Use for general informational messages
     */
    info: (message: string, context?: LogContext) => {
        console.log(`[INFO] ${message}`, context || '');
    },

    /**
     * Warning logging - shown in all environments
     * Use for Warning conditions that don't prevent operation
     */
    warn: (message: string, context?: LogContext) => {
        console.warn(`[WARN] ${message}`, context || '');
    },

    /**
     * Error logging - shown in all environments
     * Use for error conditions that need attention
     */
    error: (message: string, error?: unknown, context?: LogContext) => {
        const errorDetails = error instanceof Error ? {
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            ...context
        } : { error, ...context };

        console.error(`[ERROR] ${message}`, errorDetails);
    },

    /**
     * Log slow database queries (development only)
     */
    slowQuery: (duration: number, query: string, params?: unknown) => {
        if (process.env.NODE_ENV === 'development') {
            console.warn(`[SLOW QUERY] ${duration}ms`, {
                query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
                params: params ? `${Array.isArray(params) ? params.length : 'object'} params` : 'no params'
            });
        }
    }
};

/**
 * Legacy console.log replacement - use logger.debug instead
 * @deprecated Use logger.debug() instead
 */
export const log = logger.debug;
