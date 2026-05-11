import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker
  output: 'standalone',

  // Ship the Drizzle migrations folder with the serverless function bundle.
  // Without this, /api/admin/migrate can't read drizzle/migrations/*.sql at
  // runtime — Next.js's file tracer only follows explicit `import`s and
  // these are read via `fs.readFileSync`.
  outputFileTracingIncludes: {
    '/api/admin/migrate': ['./drizzle/migrations/**/*'],
  },

  // Configure images for external domains
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.blob.core.windows.net',
      },
      {
        protocol: 'https',
        hostname: '*.amazonaws.com',
      }
    ]
  },
  
  // Allow hot reloading in Docker development
  ...(process.env.NODE_ENV === 'development' && {
    experimental: {
      serverActions: {
        allowedOrigins: ['localhost:3000', '127.0.0.1:3000']
      }
    }
  }),

  // Map wavelog's legacy /index.php/api/* URL form onto the canonical /api/*
  // routes. Some older ham radio software hardcodes the index.php prefix
  // because wavelog/cloudlog ships without URL rewriting by default.
  async rewrites() {
    return [
      { source: '/index.php/api/:path*', destination: '/api/:path*' },
    ];
  },
};

export default nextConfig;
