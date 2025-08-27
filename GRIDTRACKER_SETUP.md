# GridTracker Integration Guide

GridTracker is now fully supported with Nextlog's Cloudlog-compatible API. This guide explains how to configure GridTracker to automatically log QSOs to your Nextlog instance.

## Prerequisites

1. **Nextlog instance running** with API access
2. **API key created** in Nextlog station settings
3. **GridTracker installed** and configured for your station

## Configuration Steps

### 1. Create API Key in Nextlog

1. Log into your Nextlog instance
2. Go to **Station Settings** → **API Key Management**
3. Click **"Create New API Key"**
4. Set permissions:
   - ✅ **Write access** (required for logging QSOs)
   - ✅ **Station access** (set to your station)
5. Copy the generated API key (format: `nextlog_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)

### 2. Configure GridTracker

1. **Open GridTracker settings**
2. **Go to Logging section**
3. **Select "Cloudlog" as logging type**
4. **Configure the following:**

   | Setting | Value |
   |---------|-------|
   | **API URL** | `http://your-nextlog-domain/api/cloudlog` |
   | **API Key** | Your generated Nextlog API key |
   | **Station ID** | Leave blank (auto-detected) |

   **Example URL formats:**
   - Local: `http://localhost:3000/api/cloudlog`
   - Domain: `https://yourlog.example.com/api/cloudlog`
   - Vercel: `https://your-nextlog.vercel.app/api/cloudlog`

5. **Test the connection** using GridTracker's test button
6. **Enable automatic logging** if desired

### 3. Verify Configuration

#### Test API Connection
```bash
curl -H "X-API-Key: your_api_key" \
     "http://your-nextlog-domain/api/cloudlog"
```

**Expected response:**
```json
{
  "success": true,
  "api_name": "Nextlog Cloudlog-compatible API",
  "cloudlog_compatibility": "v2.7.0"
}
```

#### Test QSO Logging
GridTracker will automatically test QSO logging when you configure it. You can also manually test:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  "http://your-nextlog-domain/api/cloudlog/qso" \
  -d '{
    "callsign": "W1AW",
    "band": "20M", 
    "mode": "FT8",
    "qso_date": "2024-01-15",
    "time_on": "14:30:00",
    "gridsquare": "FN31pr"
  }'
```

## Supported Features

GridTracker integration supports:

- ✅ **Automatic QSO logging** for FT4/FT8 contacts
- ✅ **Real-time uploads** as contacts are made
- ✅ **Grid square tracking** and mapping
- ✅ **Band/mode information** from GridTracker
- ✅ **Station identification** via API key
- ✅ **Error handling** with detailed messages

## API Endpoints Used by GridTracker

GridTracker typically uses these Nextlog endpoints:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/cloudlog` | API information and compatibility check |
| `POST /api/cloudlog/qso` | Create new QSO records |
| `GET /api/cloudlog/bands` | Available amateur radio bands |
| `GET /api/cloudlog/modes` | Available transmission modes |

## Troubleshooting

### Common Issues

**1. "Connection failed" error**
- ✅ Check API URL is correct (include `/api/cloudlog`)
- ✅ Verify Nextlog instance is accessible
- ✅ Check firewall settings

**2. "Authentication failed" error**
- ✅ Verify API key is copied correctly
- ✅ Check API key hasn't expired
- ✅ Ensure API key has write permissions

**3. "CORS error" in browser**
- ✅ This is now fixed - update to latest Nextlog version
- ✅ Restart GridTracker after Nextlog update

**4. "QSO not appearing in log"**
- ✅ Check API key station permissions
- ✅ Verify station is set up in Nextlog
- ✅ Check Nextlog dashboard for new contacts

### Enable Debug Logging

In GridTracker:
1. Enable **"Debug logging"** in settings
2. Check log files for detailed error messages
3. Look for HTTP response codes and error details

### API Testing

Test your API configuration manually:

```bash
# Test authentication
curl -H "X-API-Key: YOUR_KEY" http://your-domain/api/cloudlog

# Test QSO creation  
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_KEY" \
  "http://your-domain/api/cloudlog/qso" \
  -d '{"callsign":"TEST","band":"20M","mode":"FT8"}'
```

## Security Notes

- 🔒 **API keys are sensitive** - treat them like passwords
- 🔒 **Use HTTPS** in production for encrypted communication
- 🔒 **Limit API key permissions** to only what GridTracker needs
- 🔒 **Rotate API keys** periodically for security

## Support

If you encounter issues:

1. **Check this guide** for common solutions
2. **Test API manually** with curl commands above  
3. **Check Nextlog logs** for server-side errors
4. **Report issues** on the Nextlog GitHub repository

---

**Note**: This integration uses Nextlog's Cloudlog-compatible API, which supports all standard amateur radio logging software that works with Cloudlog.