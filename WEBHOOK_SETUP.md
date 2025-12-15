# Webhook Setup Guide

## Quick Start

### 1. Run Database Migration

Ensure the database has the webhook tables:

```bash
yarn prisma:migrate:dev
```

### 2. Install Dependencies

If you haven't already, install the required packages:

```bash
npm install express-rate-limit express-slow-down bcrypt
```

### 3. Create API Key via Admin Endpoint

Use the admin API to create a webhook API key:

```bash
curl -X POST http://localhost:3000/api/admin/webhook-api-keys \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Client A - N8N",
    "description": "Production automation",
    "maxRequestsPerMinute": 10,
    "maxRequestsPerHour": 100,
    "maxRequestsPerDay": 1000
  }'
```

**⚠️ IMPORTANT**: Save the `apiKey` from the response - it's shown only once!

### 4. Test the Webhook

```bash
curl -X POST http://localhost:3000/api/webhook/hazards \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Api-Key: x7K9mP2nQ5vR8sT1wY4zL6bN3jH0dF5g" \
  -d '{
    "description": "Test fire alert",
    "sourceId": "your-source-id-here",
    "latitude": -33.8688,
    "longitude": 151.2093,
    "locationName": "Sydney, NSW"
  }'
```

### 5. Test Rate Limiting (Optional)

Verify security is working:

```bash
# This should fail after 10 requests (burst protection)
for i in {1..15}; do
  echo "Request $i"
  curl -X POST http://localhost:3000/api/webhook/hazards \
    -H "X-Webhook-Api-Key: x7K9mP2nQ5vR8sT1wY4zL6bN3jH0dF5g" \
    -H "Content-Type: application/json" \
    -d '{"description":"test","sourceId":"xxx","latitude":0,"longitude":0}'
## Security Features

The webhook includes **6 layers of protection**:

1. **Burst Protection**: 10 requests/minute max
2. **Rate Limiting**: 100 requests/15 minutes max
3. **Speed Limiting**: Gradual slowdown after 50 requests
4. **Daily Quota**: 1,000 requests/day max
5. **API Key Auth**: Constant-time validation + logging
6. **Input Validation**: Schema validation on all requests

### What This Means

✅ **Protected from abuse**: Even if someone gets your API key, maximum damage is 1,000 requests/day

✅ **Automatic recovery**: Limits reset automatically (1min, 15min, 24hr windows)

✅ **Full audit trail**: All requests logged with IP, timestamp, success/failure

✅ **Client-friendly**: Normal usage unaffected, generous limits for typical workflows

### For detailed security architecture, see:
- `WEBHOOK_SECURITY.md` - Complete security documentation
- `WEBHOOK_DOCUMENTATION.md` - API documentation with rate limit details

## Security Notes

- Use different API keys for dev/staging/production
- Rotate keys every 3-6 months
- Monitor logs for suspicious activity (`[WEBHOOK FAILURE]` entries)
- In production, consider using Redis for distributed rate limiting
- Set up alerts for rate limit violations
- Consider IP whitelisting for additional security
Send the API key to your client through a secure channel:
- Encrypted email
- Password manager (1Password, LastPass)
- Secure messaging (Signal, encrypted chat)

**Never commit the API key to version control!**

## For Your Client (N8N Setup)

1. In N8N, add an HTTP Request node
2. Configure:
   - Method: POST
   - URL: `https://your-api-domain.com/api/webhook/hazards`
   - Add Header: `X-Webhook-Api-Key` = `your-api-key-here`
   - Set Body to JSON with required fields

See `WEBHOOK_DOCUMENTATION.md` for complete API documentation.

## Security Notes

- Use different API keys for dev/staging/production
- Rotate keys every 3-6 months
- Monitor webhook usage for suspicious activity
- Consider adding IP whitelisting for production
```
