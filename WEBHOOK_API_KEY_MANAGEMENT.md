# Webhook API Key Management Guide

## Overview

The webhook system now supports **multiple API keys** with individual management, custom rate limits, and the ability to enable/disable specific keys. This allows you to:

- Create separate API keys for different clients
- Set custom rate limits per key
- Block/unblock specific keys without affecting others
- Track usage per client
- Audit all webhook activity

## Multi-Key Architecture

### Database-Driven System

- API keys are stored securely in the database (bcrypt hashed)
- Each key has its own rate limits and configuration
- Full audit trail of all webhook requests
- Per-key usage statistics and monitoring

### Key Features

✅ **Multiple clients**: Create unlimited API keys
✅ **Custom rate limits**: Set different limits per key
✅ **Enable/Disable**: Block specific keys instantly
✅ **Expiration dates**: Set automatic expiry
✅ **Usage tracking**: Monitor requests per key
✅ **Audit logs**: Complete history of all webhook calls

## Admin API Endpoints

All endpoints require admin authentication (`Authorization: Bearer <admin-token>`)

### 1. List All API Keys

```http
GET /api/admin/webhook-api-keys
```

**Response:**

```json
[
  {
    "id": "uuid",
    "name": "Client A - N8N",
    "description": "Production automation for Client A",
    "isActive": true,
    "maxRequestsPerMinute": 10,
    "maxRequestsPerHour": 100,
    "maxRequestsPerDay": 1000,
    "totalRequests": 5420,
    "lastUsedAt": "2025-12-15T10:30:00Z",
    "lastUsedIp": "203.0.113.42",
    "createdAt": "2025-12-01T00:00:00Z",
    "expiresAt": null,
    "createdBy": {
      "id": "admin-uuid",
      "name": "John Admin",
      "email": "admin@example.com"
    }
  }
]
```

### 2. Get Single API Key (with detailed stats)

```http
GET /api/admin/webhook-api-keys/:keyId
```

**Response:**

```json
{
  "id": "uuid",
  "name": "Client A - N8N",
  "description": "Production automation",
  "isActive": true,
  "maxRequestsPerMinute": 10,
  "maxRequestsPerHour": 100,
  "maxRequestsPerDay": 1000,
  "totalRequests": 5420,
  "lastUsedAt": "2025-12-15T10:30:00Z",
  "lastUsedIp": "203.0.113.42",
  "stats": {
    "last24HoursRequests": 1245,
    "last24HoursFailures": 12,
    "successRate": 99.04
  },
  "recentLogs": [
    {
      "id": "log-uuid",
      "success": true,
      "statusCode": 201,
      "clientIp": "203.0.113.42",
      "endpoint": "/hazards",
      "responseTime": 245,
      "hazardId": "hazard-uuid",
      "createdAt": "2025-12-15T10:30:00Z"
    }
  ]
}
```

### 3. Create New API Key

```http
POST /api/admin/webhook-api-keys
Content-Type: application/json

{
  "name": "Client B - Automation",
  "description": "Partner integration for emergency alerts",
  "maxRequestsPerMinute": 20,
  "maxRequestsPerHour": 200,
  "maxRequestsPerDay": 2000,
  "expiresAt": "2026-12-31T23:59:59Z"
}
```

**Response:**

```json
{
  "id": "new-uuid",
  "name": "Client B - Automation",
  "description": "Partner integration",
  "isActive": true,
  "maxRequestsPerMinute": 20,
  "maxRequestsPerHour": 200,
  "maxRequestsPerDay": 2000,
  "createdAt": "2025-12-15T10:00:00Z",
  "expiresAt": "2026-12-31T23:59:59Z",
  "apiKey": "whk_ABC123...XYZ789",
  "message": "API key created successfully. SAVE THIS KEY NOW - it will never be shown again!"
}
```

**⚠️ IMPORTANT**: The `apiKey` field is only shown ONCE during creation. Save it immediately!

### 4. Update API Key

```http
PATCH /api/admin/webhook-api-keys/:keyId
Content-Type: application/json

{
  "name": "Client B - Updated Name",
  "isActive": false,
  "maxRequestsPerDay": 5000
}
```

**Use Cases:**

- Update name/description
- **Block a key**: `{"isActive": false}`
- **Unblock a key**: `{"isActive": true}`
- Increase/decrease rate limits
- Update expiration date

### 5. Delete API Key

```http
DELETE /api/admin/webhook-api-keys/:keyId
```

**Response:**

```json
{
  "message": "Webhook API key deleted successfully"
}
```

### 6. Get Webhook Logs

```http
GET /api/admin/webhook-logs?apiKeyId=uuid&success=false&page=1&pageSize=50
```

**Query Parameters:**

- `apiKeyId` (optional): Filter by specific API key
- `success` (optional): Filter by success/failure (`true`/`false`)
- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Items per page (default: 50)

**Response:**

```json
{
  "logs": [
    {
      "id": "log-uuid",
      "success": false,
      "statusCode": 429,
      "reason": "Rate limit exceeded",
      "clientIp": "203.0.113.42",
      "endpoint": "/hazards",
      "method": "POST",
      "responseTime": 10,
      "hazardId": null,
      "createdAt": "2025-12-15T10:30:00Z",
      "apiKey": {
        "id": "key-uuid",
        "name": "Client A - N8N"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "total": 150,
    "totalPages": 3
  }
}
```

## Common Use Cases

### Scenario 1: Adding a New Client

1. **Create API Key**:

```bash
curl -X POST https://your-api.com/api/admin/webhook-api-keys \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Client XYZ - N8N",
    "description": "Emergency alert automation",
    "maxRequestsPerMinute": 10,
    "maxRequestsPerHour": 100,
    "maxRequestsPerDay": 1000
  }'
```

2. **Save the returned API key** (shown only once!)
3. **Share securely with client** via encrypted channel
4. **Monitor usage** via admin dashboard

### Scenario 2: Blocking Abusive Client

If a client is abusing the API:

```bash
curl -X PATCH https://your-api.com/api/admin/webhook-api-keys/$KEY_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isActive": false}'
```

**Effect**: Instant - all requests from that key will be rejected with 403 status

### Scenario 3: Temporary Block During Maintenance

```bash
# Block key
curl -X PATCH .../webhook-api-keys/$KEY_ID \
  -d '{"isActive": false}'

# [Perform maintenance]

# Unblock key
curl -X PATCH .../webhook-api-keys/$KEY_ID \
  -d '{"isActive": true}'
```

### Scenario 4: Increasing Limits for Premium Client

```bash
curl -X PATCH https://your-api.com/api/admin/webhook-api-keys/$KEY_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "maxRequestsPerMinute": 30,
    "maxRequestsPerHour": 500,
    "maxRequestsPerDay": 5000
  }'
```

### Scenario 5: Auditing Suspicious Activity

```bash
# Get all failed requests for a specific key
curl "https://your-api.com/api/admin/webhook-logs?apiKeyId=$KEY_ID&success=false" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Review logs
# If abuse confirmed, block the key
curl -X PATCH .../webhook-api-keys/$KEY_ID -d '{"isActive": false}'
```

### Scenario 6: Setting Expiration for Trial Clients

```bash
curl -X POST https://your-api.com/api/admin/webhook-api-keys \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Trial Client - 30 Days",
    "maxRequestsPerDay": 100,
    "expiresAt": "2026-01-15T00:00:00Z"
  }'
```

Key automatically stops working after expiration date.

## Rate Limit Configuration

Each API key can have custom rate limits:

| Setting                | Min | Max   | Default | Description      |
| ---------------------- | --- | ----- | ------- | ---------------- |
| `maxRequestsPerMinute` | 1   | 60    | 10      | Burst protection |
| `maxRequestsPerHour`   | 1   | 1000  | 100     | Hourly limit     |
| `maxRequestsPerDay`    | 1   | 10000 | 1000    | Daily quota      |

**Example Configurations:**

**Conservative (default):**

```json
{
  "maxRequestsPerMinute": 10,
  "maxRequestsPerHour": 100,
  "maxRequestsPerDay": 1000
}
```

**Premium Client:**

```json
{
  "maxRequestsPerMinute": 30,
  "maxRequestsPerHour": 500,
  "maxRequestsPerDay": 5000
}
```

**Low-volume Trial:**

```json
{
  "maxRequestsPerMinute": 5,
  "maxRequestsPerHour": 50,
  "maxRequestsPerDay": 100
}
```

## Security Best Practices

### 1. API Key Generation

- Keys are automatically generated using `crypto.randomBytes(32)`
- Format: `whk_<base64url-encoded-random-bytes>`
- Stored as bcrypt hash (never plain text)

### 2. Key Distribution

- **Never send keys via plain email**
- Use encrypted channels:
  - Password managers (1Password, LastPass)
  - Encrypted messaging (Signal)
  - Secure file transfer with encryption

### 3. Key Rotation

- Set expiration dates for periodic rotation
- Create new key before old one expires
- Delete old key after client migrates

### 4. Monitoring

- Review logs weekly for suspicious activity
- Set up alerts for:
  - High failure rates (>10%)
  - Sudden traffic spikes
  - Multiple rate limit hits
  - Access from unexpected IPs

### 5. Incident Response

1. **Detect**: Monitor logs for anomalies
2. **Block**: Disable key immediately (`isActive: false`)
3. **Investigate**: Review webhook logs
4. **Notify**: Contact client if legitimate key compromised
5. **Rotate**: Issue new key after investigation

## Monitoring & Analytics

### Key Metrics to Track

1. **Per-Key Metrics**:

   - Total requests
   - Success rate
   - Last used date/IP
   - Rate limit hits

2. **System-Wide Metrics**:

   - Total active keys
   - Total requests across all keys
   - Average success rate
   - Most active keys

3. **Security Metrics**:
   - Failed authentication attempts
   - Blocked key usage attempts
   - Unusual IP addresses
   - Traffic patterns

### Dashboard Queries

**Most Active Keys (Last 24h)**:

```sql
SELECT
  wak.name,
  COUNT(*) as requests,
  SUM(CASE WHEN wl.success THEN 1 ELSE 0 END) as successful,
  AVG(wl.responseTime) as avg_response_time
FROM WebhookLog wl
JOIN WebhookApiKey wak ON wl.apiKeyId = wak.id
WHERE wl.createdAt >= NOW() - INTERVAL '24 hours'
GROUP BY wak.id, wak.name
ORDER BY requests DESC
LIMIT 10;
```

**Keys Approaching Rate Limits**:

```sql
SELECT
  name,
  totalRequests,
  maxRequestsPerDay,
  (totalRequests::float / maxRequestsPerDay * 100) as usage_percentage
FROM WebhookApiKey
WHERE isActive = true
AND (totalRequests::float / maxRequestsPerDay) > 0.8
ORDER BY usage_percentage DESC;
```

## Migration from Single Key

If you were previously using `WEBHOOK_API_KEY` environment variable:

1. **Create API key in database**:

```bash
curl -X POST .../webhook-api-keys \
  -d '{"name": "Legacy Key", "maxRequestsPerDay": 1000}'
```

2. **Save the new key** returned in response

3. **Update client** with new key

4. **Remove** `WEBHOOK_API_KEY` from `.env` file

5. **Test** that new key works

6. **Delete legacy system** code (no longer needed)

## Troubleshooting

### "This API key has been disabled"

- Key's `isActive` is set to `false`
- Contact admin to re-enable or get new key

### "This API key has expired"

- Key's `expiresAt` date has passed
- Contact admin for new key

### Can't find my API key

- Keys are NEVER displayed after creation
- Only bcrypt hash is stored
- Must generate new key if lost

### How to recover from lost key

1. Admin creates new key
2. Admin disables old key (optional)
3. Client updates N8N with new key
4. Admin deletes old key (optional)

## Summary

The multi-key webhook system provides:

✅ **Flexibility**: Different keys for different clients  
✅ **Security**: Disable individual keys without affecting others  
✅ **Control**: Custom rate limits per client  
✅ **Transparency**: Full audit trail of all activity  
✅ **Scalability**: Support unlimited clients  
✅ **Monitoring**: Detailed usage statistics per key

For technical implementation details, see `WEBHOOK_SECURITY.md`
