# Vercel Cron Jobs Configuration

This document outlines the configuration required for LoTW cron jobs to work properly in Vercel.

## Environment Variables Required

Ensure the following environment variables are set in your Vercel deployment:

### Required Variables
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT token signing
- `ENCRYPTION_SECRET` - Key for encrypting sensitive data like LoTW passwords
- `NEXTAUTH_URL` - Full URL of your deployed application (e.g., `https://yourapp.vercel.app`)

### Optional Variables  
- `CRON_SECRET` - Additional security for external cron triggers (recommended for production)

## Cron Job Schedule

The cron jobs are configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/lotw-upload",
      "schedule": "0 1 * * *"
    },
    {
      "path": "/api/cron/lotw-download", 
      "schedule": "0 1 * * *"
    }
  ]
}
```

Both jobs run daily at 1:00 AM UTC.

## Authentication

The cron endpoints use flexible authentication that works with Vercel's cron infrastructure:

1. **Vercel Cron Jobs**: Automatically authenticated based on request headers
2. **External Triggers**: Require `Authorization: Bearer ${CRON_SECRET}` header

## Error Logging

The cron jobs include comprehensive error logging to help diagnose issues:

- Request headers (excluding sensitive data)
- Environment variable validation
- Detailed error messages for failed uploads/downloads
- Station-by-station processing results

## Troubleshooting

### 401 Unauthorized Errors
- Verify `CRON_SECRET` is set if triggering externally
- Check that all required environment variables are configured
- Review Vercel function logs for detailed error information

### 500 Internal Server Errors
- Ensure database connection is working (`DATABASE_URL`)
- Verify all required environment variables are set
- Check that LoTW credentials are properly configured for stations

### No Stations Processed
- Verify stations have `is_active = true`
- Ensure LoTW credentials are configured (username/password or third_party_services)
- For uploads, verify LoTW certificates are uploaded and active

## Testing

You can test the cron endpoints manually:

```bash
# Test upload endpoint
curl -X GET "https://yourapp.vercel.app/api/cron/lotw-upload" \
  -H "Authorization: Bearer your-cron-secret"

# Test download endpoint  
curl -X GET "https://yourapp.vercel.app/api/cron/lotw-download" \
  -H "Authorization: Bearer your-cron-secret"
```

## Monitoring

Monitor cron job execution in:
- Vercel Dashboard > Functions tab
- Application logs for detailed processing information
- Database `lotw_upload_logs` and `lotw_download_logs` tables for historical data