# Webhook Quick Reference Card

## Endpoint

```
POST https://your-api-domain.com/api/webhook/hazards
```

## Authentication

```http
X-Webhook-Api-Key: your-secret-api-key-here
```

## Rate Limits

| Limit Type | Maximum        | Window         |
| ---------- | -------------- | -------------- |
| **Burst**  | 10 requests    | per minute     |
| **Rate**   | 100 requests   | per 15 minutes |
| **Daily**  | 1,000 requests | per 24 hours   |

## Minimum Required Fields

```json
{
  "description": "Fire reported in area",
  "sourceId": "uuid-of-source",
  "latitude": -33.8688,
  "longitude": 151.2093
}
```

## Optional Fields

- `title` - Auto-generated if not provided
- `aiSummary` - Auto-generated if not provided
- `callToAction` - Auto-generated if not provided
- `locationName` - Human-readable location
- `categoryId` - Auto-detected if not provided
- `severity` - emergency | watch_and_act | advice | unknown
- `severityBand` - emergency | alert | warning | info
- `fireStatus` - goingFire | beingControlled | underControl
- `isAwsCompliant` - Boolean
- `link` - URL to source
- `occurredAt` - ISO 8601 datetime
- `expiresAt` - ISO 8601 datetime

## Response Codes

- `201` - Success
- `400` - Invalid data
- `401` - Missing API key
- `403` - Invalid API key
- `429` - Rate limit exceeded
- `500` - Server error

## Rate Limit Headers

Every response includes:

```http
RateLimit-Limit: 100
RateLimit-Remaining: 73
RateLimit-Reset: 1639478400
```

## Error Response Example

```json
{
  "error": "Too many webhook requests",
  "message": "You have exceeded the rate limit...",
  "retryAfter": "15 minutes"
}
```

## N8N Setup Checklist

- [ ] Add `WEBHOOK_API_KEY` to N8N environment variables
- [ ] Set HTTP Request node method to POST
- [ ] Add `X-Webhook-Api-Key` header: `={{$env.WEBHOOK_API_KEY}}`
- [ ] Add `Content-Type` header: `application/json`
- [ ] Set body to JSON with required fields
- [ ] Add error handling for 429 responses
- [ ] Implement retry logic with `Retry-After` header
- [ ] Test in development first
- [ ] Monitor rate limit headers

## Recommended N8N Workflow Schedule

- Every 1 minute: ✅ Safe (1,440/day)
- Every 30 seconds: ⚠️ Approaching limits (2,880/day)
- Every 10 seconds: ❌ Will hit daily quota

## Support

For issues: See `WEBHOOK_DOCUMENTATION.md` for full troubleshooting guide

## Security Reminders

- Never commit API key to version control
- Don't share API key in plain text
- Rotate key every 3-6 months
- Monitor usage in logs
- Report suspicious activity immediately
