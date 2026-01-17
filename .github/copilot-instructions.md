# ALRT Backend - AI Coding Agent Instructions

## Project Overview

ALRT is a hazard alerting platform that ingests, processes, and distributes emergency alerts from official Australian government sources and user-reported incidents. The system uses AI to normalize, summarize, and assess hazard information before distributing it via push notifications, Socket.IO, and REST APIs.

**Stack**: Node.js + Express + TypeScript + Prisma + PostgreSQL (with PostGIS) + OpenAI + Socket.IO + AWS S3 + Firebase Cloud Messaging

## Architecture Highlights

### Data Ingestion Pipeline (Core Feature)

- **Automated hazard ingestion** runs every 15 minutes via cron ([scheduler.service.ts](../src/services/scheduler.service.ts))
- Fetches from 11+ official sources (RFS, BOM, state fire services, WAQI, Smartraveller, etc.)
- Source configs in [ingestion.service.ts](../src/services/ingestion.service.ts) define parsers, API URLs, and severity filters
- Pipeline stages: fetch → parse → geocode → AI summary → confidence scoring → notification dispatch
- See [HAZARDS_INGESTION_DOCUMENTATION.md](../HAZARDS_INGESTION_DOCUMENTATION.md) for data flow details

### AI Processing System

- **Five prompt categories** based on hazard source and severity band (INFO/MONITOR/ACTION/CRITICAL)
- User-reported alerts use cautious, unverified language; official sources use authoritative tone
- AI generates: title (max 80 chars), summary, calls-to-action (2-4 items), confidence level
- Prompts stored in database (`AIPrompt` model) with dynamic variable substitution
- See [AI_PROMPTS_DOCUMENTATION.md](../AI_PROMPTS_DOCUMENTATION.md) for prompt selection logic

### Real-time Communication

- Socket.IO server initialized in [index.ts](../src/index.ts) with auth middleware
- Events sent to users within geo-subscribed areas (circular radius or bounding box)
- Push notifications via Firebase Cloud Messaging for new hazards matching user preferences
- WebSocket connections authenticated via JWT tokens

### Database Schema (Prisma)

- **PostGIS extension** for geographic queries (`geoLocation` stored as WKT/WKB strings)
- Key models: `Hazard`, `HazardCategory` (hierarchical with parent/subcategories), `User`, `LocationSubscription`, `AIPrompt`, `Configuration`, `WebhookApiKey`
- Complex indexes on hazard queries: lat/lng + severity, expiry + review status, category + severity band
- Migration workflow: `yarn prisma:migrate:dev` (dev) or `yarn prisma:migrate:deploy` (prod)

## Critical Developer Workflows

### Environment Setup

- Environment files: `.env.dev` (development), `.env.prod` (production)
- Config loaded dynamically via `NODE_ENV` in [config.ts](../src/utils/config.ts) - uses `.env.${NODE_ENV}` pattern
- Copy `.env.default` to `.env.dev` and populate required vars (42 config values including API keys for NSW Transport, WAQI, Google Maps, OpenAI, AWS S3)

### Running the Application

```bash
# Development (watches for changes)
yarn dev

# Production mode locally
yarn dev:prod

# Production build
yarn build && yarn start
```

### Database Operations

```bash
# Create migration after schema changes
yarn prisma:migrate:dev

# Check migration status
yarn prisma:migrate:status

# Deploy migrations (production)
yarn prisma:migrate:deploy

# Regenerate Prisma client
yarn prisma:generate
```

### Admin & Utilities

```bash
# Create super admin account
yarn super-admin:create

# Manage admin accounts (interactive CLI)
yarn admin

# Generate webhook API keys
yarn webhook-key
```

### Docker Deployment

- Blue-green deployment setup in [docker-compose.yml](../docker-compose.yml)
- Two containers (`app_blue`, `app_green`) on ports 3001/3002 behind reverse proxy
- Migrations run automatically on container start: `npx prisma migrate deploy && yarn start`

## Project-Specific Conventions

### File Naming & Organization

- **Services**: `<domain>.service.ts` - Business logic layer (e.g., [hazard.service.ts](../src/services/hazard.service.ts))
- **Controllers**: `<domain>.controller.ts` - Request handlers, minimal logic
- **Validators**: `<domain>.validator.ts` - Zod schemas exported with TypeScript type inference
- **Utils**: `<name>.util.ts` - Pure functions, helpers (e.g., [jwt.util.ts](../src/utils/jwt.util.ts))
- **Middleware**: `<name>.middleware.ts` - Express middleware functions
- **Routes**: `<domain>.route.ts` - Express router definitions

### Imports & Module System

- **ES modules** with `.js` extensions in imports (TypeScript requires this for NodeNext)
- Example: `import prisma from "../utils/prisma_client.util.js"`
- Prisma client singleton: Always import from [prisma_client.util.ts](../src/utils/prisma_client.util.ts), never instantiate directly

### Error Handling Pattern

- Throw `HttpError(statusCode, message)` for API errors ([http_error.ts](../src/models/http_error.ts))
- Controllers wrap logic in try-catch, pass errors to `next(error)`
- Centralized error handler in [error_handler.middleware.ts](../src/middlewares/error_handler.middleware.ts) converts to JSON response
- Never return raw errors to clients - always use HttpError with appropriate status codes

### Validation Strategy

- **Zod schemas** for all request validation ([validators/](../src/validators/))
- Export schema + inferred TypeScript type: `export const loginSchema = z.object({...}); export type LoginInput = z.infer<typeof loginSchema>;`
- Validation happens in route middleware or controller entry point
- Use `.parse()` (throws on error) or `.safeParse()` (returns result object)

### Authentication & Authorization

- **Dual JWT system**: separate secrets for user tokens vs admin tokens
- User auth: [auth.middleware.ts](../src/middlewares/auth.middleware.ts) - `requireAuth` adds `userId` to `req`
- Admin auth: [auth.admin.middleware.ts](../src/middlewares/auth.admin.middleware.ts) - role-based guards (`requireSuperAdmin`, `requireAdminOrAbove`)
- Socket.IO auth: `requireSocketAuth` middleware validates JWT before connection

### Database Query Patterns

- Use Prisma client for type-safe queries
- Raw SQL for complex spatial queries: `prisma.$queryRawUnsafe()` (see geographic filtering in [hazard.service.ts](../src/services/hazard.service.ts))
- Always include performance indexes when adding new queries (see schema comments)
- Batch operations: prefer `createMany`, `updateMany`, `deleteMany` over loops

### AI Integration Points

- OpenAI client singleton: [open_ai_client.util.ts](../src/utils/open_ai_client.util.ts)
- Rate-limited batch processing: `processBatchWithRateLimit()` in [open-ai.service.ts](../src/services/open-ai.service.ts)
- Prompt execution: `executePrompt({ content, variables })` handles variable substitution and API calls
- Configuration: AI prompts stored in database, managed via admin panel, cached in [configuration.service.ts](../src/services/configuration.service.ts)

## Key Integration Points

### External APIs

- **NSW Transport**: Road incidents, traffic hazards (requires API key)
- **WAQI**: Air quality data (token-based auth)
- **Google Maps**: Geocoding for address ↔ lat/lng conversion
- **OpenAI**: GPT-4o-mini for hazard summarization and classification
- **Sightengine**: Image/video moderation for user-uploaded media
- **Firebase Admin**: Push notifications via FCM

### S3 File Management

- User profile pictures and hazard media stored in S3
- CloudFront CDN for media delivery
- Pre-signed URLs for uploads: [s3.service.ts](../src/services/s3.service.ts)
- S3 keys stored in `HazardMedia` table for cleanup

### Webhook System

- External clients can POST hazards via `/api/webhook/hazards`
- API key authentication (`X-Webhook-Api-Key` header)
- Rate limiting: 10/min burst, 100/15min window, 1000/day quota
- Bcrypt-hashed keys in `WebhookApiKey` table, usage tracked in `WebhookLog`
- See [WEBHOOK_CLIENT_DOCUMENTATION.md](../WEBHOOK_CLIENT_DOCUMENTATION.md)

## Common Gotchas

- **PostGIS queries**: Use `ST_GeomFromText()` for WKT strings, distance calculations require `ST_DWithin()` with geography casts
- **Migration conflicts**: Always pull latest before running `prisma:migrate:dev`, resolve via `prisma:migrate:resolve`
- **Scheduled tasks**: Disabled by default in dev (`runScheduledTasksInDev = false` in [index.ts](../src/index.ts)), avoid running multiple instances
- **Environment variables**: Config validation throws on missing required vars at startup - check `.env.${NODE_ENV}` file exists
- **Hazard expiry**: Auto-calculated based on severity band (1-168 hours), expired hazards filtered in queries
- **Confidence scoring**: Recalculated on vote changes, factors in upvotes, downvotes, source reliability, and time decay
- **Query parser**: Express uses `qs` library with `allowDots: true` for nested query params (e.g., `?filters.severity=emergency`)

## Testing & Debugging

- No automated tests currently - manual testing via REST client and admin panel
- Use `/api/test` endpoint to verify server is running
- Check migration status: `yarn prisma:migrate:status`
- View database in browser: `yarn prisma:studio`
- Docker logs: `docker logs app_blue` or `docker logs app_green`
- Socket events: Monitor via client connection or debug logs in [socket.service.ts](../src/services/socket.service.ts)
