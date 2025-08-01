# Propagation Prediction Feature

This document describes the propagation prediction integration in Nextlog, which provides amateur radio operators with real-time band conditions and solar activity data to optimize QSO timing.

## Overview

The propagation prediction feature integrates with NOAA Space Weather services to provide:
- Real-time solar activity monitoring (Solar Flux Index, A-index, K-index)
- Automated HF band condition predictions  
- Simple propagation quality assessments
- Visual dashboard for quick reference

## Architecture

### Database Schema

The feature adds four new tables to the PostgreSQL database:

1. **`solar_activity`** - Stores real-time solar activity data from NOAA
2. **`propagation_forecasts`** - Stores calculated band condition forecasts
3. **`propagation_alerts`** - User-specific alerts for enhanced propagation
4. **`user_propagation_preferences`** - User preferences for monitoring

### API Endpoints

- **`GET /api/propagation`** - Retrieve current propagation conditions
- **`GET /api/propagation/solar`** - Update solar data from NOAA Space Weather

### Data Flow

1. Solar activity data is fetched from NOAA Space Weather API
2. Data is stored in the `solar_activity` table
3. Band conditions are calculated using a simple algorithm
4. Forecasts are stored in `propagation_forecasts` table
5. UI displays current conditions and allows manual refresh

## Usage

### Accessing the Feature

1. Navigate to the Dashboard
2. Click the "Propagation" button in the navigation bar
3. View current solar activity and band conditions
4. Click "Update from NOAA" to refresh data from space weather services

### Dashboard Features

#### Solar Activity Panel
- **Solar Flux Index (SFI)**: 10.7cm radio flux measurement
- **A-Index**: Daily geomagnetic activity index  
- **K-Index**: 3-hour geomagnetic activity index

#### Band Conditions Matrix
- Shows condition predictions for HF bands (160M - 6M)
- Color-coded quality indicators:
  - 🔴 Poor - Difficult propagation expected
  - 🟡 Fair - Average propagation conditions
  - 🔵 Good - Above-average propagation
  - 🟢 Excellent - Optimal propagation conditions
- Confidence percentage for each prediction

#### General Forecast
- Overall propagation assessment
- Source attribution (NOAA)
- Last update timestamp

## Implementation Details

### Propagation Algorithm

The current implementation uses a simplified propagation model:

**High Bands (10M-15M)**:
- Favor high solar flux (SFI > 150)
- Sensitive to geomagnetic disturbances (K-index < 3)

**Mid Bands (17M-30M)**:
- Most reliable bands
- Less sensitive to solar variations
- Good baseline conditions

**Low Bands (40M-160M)**:
- Favor low geomagnetic activity (K-index < 2)
- Less dependent on solar flux

### Data Sources

- **Primary**: NOAA Space Weather Prediction Center
- **Solar Flux**: `services.swpc.noaa.gov/json/solar-cycle/solar-cycle-indices.json`
- **Geomagnetic**: `services.swpc.noaa.gov/json/planetary_k_index_1m.json`

### Caching Strategy

- API responses are cached for 1 hour
- Database stores historical data for trend analysis
- Manual refresh available for immediate updates

## Installation

### Database Setup

1. Run the database migration:
```sql
psql -f propagation-schema.sql your_nextlog_database
```

2. Verify tables were created:
```sql
\dt *propagation*
\dt solar_activity
```

### Environment Variables

No additional environment variables required. The feature uses:
- Existing database connection (`DATABASE_URL`)
- Public NOAA APIs (no authentication required)

## API Reference

### Get Current Propagation Data

```http
GET /api/propagation
```

**Response:**
```json
{
  "success": true,
  "solar_activity": {
    "timestamp": "2024-01-15T12:00:00Z",
    "solar_flux_index": 120.5,
    "a_index": 15.2,
    "k_index": 2.3
  },
  "band_conditions": [
    {
      "band": "20M",
      "condition": "good",
      "confidence": 80,
      "predicted_for": "2024-01-15T12:00:00Z",
      "updated_at": "2024-01-15T12:00:00Z"
    }
  ],
  "forecast": {
    "general_conditions": "good",
    "notes": "Automated forecast based on NOAA space weather data",
    "source": "NOAA"
  }
}
```

### Update from NOAA

```http
GET /api/propagation/solar
```

Fetches latest data from NOAA and updates the database.

## Future Enhancements

### Phase 2 Features
- Path-specific propagation calculations
- Great circle beam heading calculations
- Real-time band opening alerts
- Integration with reverse beacon network

### Phase 3 Features  
- Propagation maps and visualizations
- Historical trend analysis
- Contest-specific band planning
- Mobile app integration

## Troubleshooting

### Common Issues

**No Data Available**
- Check internet connectivity for NOAA API access
- Verify database tables were created correctly
- Try manual refresh with "Update from NOAA" button

**Outdated Conditions**
- Solar data updates every 15 minutes from NOAA  
- Use manual refresh for immediate updates
- Check NOAA service status if persistent issues

**Navigation Missing**
- Verify propagation button appears in dashboard navigation
- Check user authentication status
- Clear browser cache if navigation doesn't update

## Support

For issues or feature requests:
1. Check the troubleshooting section above
2. Verify database schema is properly installed
3. Test API endpoints directly with curl/Postman
4. Submit issues with relevant error messages and logs