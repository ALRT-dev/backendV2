# Webhook API Documentation: Create Hazards

## Overview

This document provides complete instructions for using the hazards webhook endpoint to programmatically create hazard alerts in the system. This API is designed for automation tools, third-party integrations, and external data sources.

---

## Endpoint Information

**Base URL:** `http://3.26.195.127`

**Endpoint:** `POST /api/webhook/hazards`

**Full URL:** `http://3.26.195.127/api/webhook/hazards`

**Authentication:** API Key (Header-based)

**Content-Type:** `application/json`

---

## Authentication

All requests must include a valid API key in the request headers:

```
X-Webhook-Api-Key: your-api-key-here
```

**Important:** Keep your API key secure and never expose it in client-side code or public repositories.

---

## Rate Limits

The API implements multiple layers of protection to ensure system stability:

| Layer                | Limit                              | Description                  |
| -------------------- | ---------------------------------- | ---------------------------- |
| **Burst Protection** | 10 requests/minute                 | Prevents rapid-fire requests |
| **Rate Limiter**     | 100 requests/15 minutes            | Main rate limiting window    |
| **Speed Limiter**    | Gradual slowdown after 50 requests | Progressive throttling       |
| **Daily Quota**      | 1,000 requests/day                 | Maximum daily usage          |

**Status Codes for Rate Limiting:**

- `429 Too Many Requests` - Rate limit exceeded

---

## Request Format

### Endpoint

```
POST /api/webhook/hazards
```

### Headers

```
Content-Type: application/json
X-Webhook-Api-Key: your-api-key-here
```

### Body

The request body must be a JSON array containing one or more hazard objects. Each hazard object can contain the following fields:

#### Required Fields

| Field         | Type   | Description                                            |
| ------------- | ------ | ------------------------------------------------------ |
| `description` | string | Detailed description of the hazard (1-1000 characters) |
| `sourceId`    | string | Source identifier for the hazard data                  |

#### Optional Fields

| Field            | Type    | Description                         | Constraints                                       |
| ---------------- | ------- | ----------------------------------- | ------------------------------------------------- |
| `title`          | string  | Short title for the hazard          | 1-100 characters                                  |
| `aiSummary`      | string  | AI-generated summary of the hazard  | 1-1000 characters                                 |
| `severity`       | enum    | Severity level of the hazard        | See [Severity Values](#severity-values)           |
| `severityBand`   | enum    | Severity band classification        | See [Severity Band Values](#severity-band-values) |
| `callToAction`   | string  | Recommended actions for users       | 1-500 characters                                  |
| `fireStatus`     | enum    | Status for fire-related hazards     | See [Fire Status Values](#fire-status-values)     |
| `latitude`       | number  | Latitude coordinate                 | -90 to 90                                         |
| `longitude`      | number  | Longitude coordinate                | -180 to 180                                       |
| `locationName`   | string  | Human-readable location name        | Max 200 characters                                |
| `northeastLat`   | number  | Northeast boundary latitude         | -90 to 90                                         |
| `northeastLng`   | number  | Northeast boundary longitude        | -180 to 180                                       |
| `southwestLat`   | number  | Southwest boundary latitude         | -90 to 90                                         |
| `southwestLng`   | number  | Southwest boundary longitude        | -180 to 180                                       |
| `categoryId`     | string  | Category identifier                 | 1-50 characters                                   |
| `isAwsCompliant` | boolean | Whether the hazard is AWS compliant | true/false                                        |
| `link`           | string  | External URL for more information   | Valid URL format                                  |
| `occurredAt`     | string  | When the hazard occurred            | ISO 8601 datetime                                 |
| `expiresAt`      | string  | When the hazard expires             | ISO 8601 datetime                                 |

---

## Enumeration Values

### Source ID Values

The `sourceId` field must be one of the following approved values:

- `rfs` - Rural Fire Service
- `bom` - Bureau of Meteorology
- `nswTransport` - NSW Transport
- `actEs` - ACT Emergency Services
- `cfs` - Country Fire Service
- `viceFire` - Victoria Emergency Fire
- `qldFire` - Queensland Fire
- `ntFireAndRescue` - Northern Territory Fire and Rescue
- `waqi` - World Air Quality Index
- `openMeteo` - Open Meteo Weather Service
- `smartraveller` - Smartraveller Travel Advisories
- `waDfes` - Western Australia Department of Fire and Emergency Services

### Severity Values

- `unknown` - Severity not yet determined
- `info` - Informational only
- `advice` - Advisory level
- `watchAndAct` - Watch and act required
- `emergency` - Emergency level

### Severity Band Values

- `info` - Informational band
- `monitor` - Monitoring required
- `action` - Action required
- `critical` - Critical situation

### Fire Status Values

- `active` - Fire is currently active
- `beingControlled` - Fire is being controlled
- `underControl` - Fire is under control
- `closed` - Fire incident closed

---

## Examples

### Example 1: Single Hazard (Minimal Required Fields)

```bash
curl -X POST http://3.26.195.127/api/webhook/hazards \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Api-Key: your-api-key-here" \
  -d '[
    {
      "description": "Bushfire reported in Blue Mountains area with smoke visible from multiple locations.",
      "sourceId": "rfs"
    }
  ]'
```

### Example 2: Single Hazard (Complete Information)

```bash
curl -X POST http://3.26.195.127/api/webhook/hazards \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Api-Key: your-api-key-here" \
  -d '[
    {
      "title": "Blue Mountains Bushfire Alert",
      "description": "A bushfire is currently burning in the Blue Mountains National Park. Multiple fire crews are on scene working to contain the blaze. Smoke may affect surrounding areas.",
      "aiSummary": "Active bushfire in Blue Mountains National Park with crews responding. Smoke visible in surrounding areas.",
      "severity": "watchAndAct",
      "severityBand": "action",
      "callToAction": "Monitor conditions, prepare to leave if situation worsens. Close windows and doors to prevent smoke entry.",
      "fireStatus": "beingControlled",
      "latitude": -33.7092,
      "longitude": 150.3105,
      "locationName": "Blue Mountains National Park, NSW",
      "northeastLat": -33.6892,
      "northeastLng": 150.3305,
      "southwestLat": -33.7292,
      "southwestLng": 150.2905,
      "categoryId": "bushfire",
      "sourceId": "rfs",
      "isAwsCompliant": true,
      "link": "https://rfs.nsw.gov.au/fire-information/fires-near-me",
      "occurredAt": "2025-12-15T08:30:00Z",
      "expiresAt": "2025-12-16T08:30:00Z"
    }
  ]'
```

### Example 3: Multiple Hazards

```bash
curl -X POST http://3.26.195.127/api/webhook/hazards \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Api-Key: your-api-key-here" \
  -d '[
    {
      "title": "Severe Thunderstorm Warning",
      "description": "Severe thunderstorms are likely to produce damaging winds, large hailstones and heavy rainfall in the Sydney metropolitan area.",
      "latitude": -33.8688,
      "longitude": 151.2093,
      "locationName": "Sydney, NSW",
      "sourceId": "bom",
      "occurredAt": "2025-12-15T14:00:00Z",
      "expiresAt": "2025-12-15T20:00:00Z"
    },
    {
      "title": "Road Closure - Pacific Highway",
      "description": "Pacific Highway closed between Hexham and Sandgate due to flooding. Motorists advised to use alternative routes.",
      "latitude": -32.8303,
      "longitude": 151.6975,
      "locationName": "Pacific Highway, NSW",
      "sourceId": "nswTransport",
      "link": "https://livetraffic.com/incidents",
      "occurredAt": "2025-12-15T06:00:00Z"
    },
    {
      "title": "Poor Air Quality Alert",
      "description": "Air quality index has reached unhealthy levels due to bushfire smoke. Sensitive groups should limit outdoor activities.",
      "latitude": -37.8136,
      "longitude": 144.9631,
      "locationName": "Melbourne, VIC",
      "sourceId": "waqi",
      "occurredAt": "2025-12-15T09:00:00Z",
      "expiresAt": "2025-12-15T18:00:00Z"
    }
  ]'
```

---

## Response Format

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Hazards created successfully",
  "data": {
    "created": 3,
    "hazards": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "title": "Severe Thunderstorm Warning",
        "description": "Severe thunderstorms are likely to produce...",
        "severity": "advice",
        "createdAt": "2025-12-15T14:30:00.000Z"
      }
      // ... more hazards
    ]
  }
}
```

### Error Responses

#### 400 Bad Request - Validation Error

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "description",
      "message": "Description cannot be empty"
    },
    {
      "field": "sourceId",
      "message": "Invalid sourceId provided"
    }
  ]
}
```

#### 401 Unauthorized - Invalid API Key

```json
{
  "success": false,
  "message": "Invalid or missing API key"
}
```

#### 429 Too Many Requests - Rate Limit Exceeded

```json
{
  "success": false,
  "message": "Rate limit exceeded. Please try again later.",
  "retryAfter": 60
}
```

#### 500 Internal Server Error

```json
{
  "success": false,
  "message": "An internal server error occurred"
}
```
