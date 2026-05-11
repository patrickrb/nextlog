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
  })
};

export default nextConfig;
