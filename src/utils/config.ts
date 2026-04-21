import dotenv from "dotenv";
import path from "path";

// Load environment file dynamically
const envFile = `.env.${process.env.NODE_ENV || "dev"}`;
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

// Helper function to get required environment variable
const getRequiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
};

// Helper function to get optional environment variable with default
const getOptionalEnv = (key: string, defaultValue: string): string => {
  return process.env[key] || defaultValue;
};

export const config = {
  // General
  env: getOptionalEnv("NODE_ENV", "dev"),
  port: parseInt(getOptionalEnv("PORT", "3000"), 10),

  // CORS / Socket.IO — comma-separated origins; localhost/127.0.0.1 still allowed in non-prod when list does not match
  cors: {
    allowedOrigins: getOptionalEnv(
      "CORS_ALLOWED_ORIGINS",
      "https://admin.safetyalrt.com",
    )
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  },

  // Database
  database: {
    url: getRequiredEnv("DATABASE_URL"),
  },

  // JWT
  jwt: {
    accessSecret: getRequiredEnv("JWT_ACCESS_SECRET"),
    accessExpirationMinutes: parseInt(getRequiredEnv("JWT_ACCESS_EXP_M"), 10),
    refreshSecret: getRequiredEnv("JWT_REFRESH_SECRET"),
    refreshExpirationDays: parseInt(getRequiredEnv("JWT_REFRESH_EXP_D"), 10),
  },

  // Admin JWT - Separate secrets for better security isolation
  adminJwt: {
    accessSecret: getRequiredEnv("ADMIN_JWT_ACCESS_SECRET"),
    accessExpirationMinutes: parseInt(
      getRequiredEnv("ADMIN_JWT_ACCESS_EXP_M"),
      10,
    ),
    refreshSecret: getRequiredEnv("ADMIN_JWT_REFRESH_SECRET"),
    refreshExpirationDays: parseInt(
      getRequiredEnv("ADMIN_JWT_REFRESH_EXP_D"),
      10,
    ),
  },

  // Admin Credentials
  adminCredentials: {
    superAdminEmail: getRequiredEnv("SUPER_ADMIN_EMAIL"),
    superAdminPassword: getRequiredEnv("SUPER_ADMIN_PASSWORD"),
    superAdminName: getRequiredEnv("SUPER_ADMIN_NAME"),
  },

  // Google OAuth
  googleOAuth: {
    clientIdWeb: getRequiredEnv("GOOGLE_OAUTH_CLIENT_ID_WEB"),
    clientIdIos: getRequiredEnv("GOOGLE_OAUTH_CLIENT_ID_IOS"),
    clientIdAndroid: getRequiredEnv("GOOGLE_OAUTH_CLIENT_ID_ANDROID"),
  },

  // Apple OAuth
  appleOAuth: {
    audience: getRequiredEnv("APPLE_OAUTH_AUDIENCE"),
  },

  // OpenAI
  openAI: {
    apiKey: getRequiredEnv("OPENAI_API_KEY"),
  },

  // AWS
  aws: {
    s3: {
      region: getRequiredEnv("AWS_S3_REGION"),
      accessKeyId: getRequiredEnv("AWS_S3_ACCESS_KEY_ID"),
      secretAccessKey: getRequiredEnv("AWS_S3_SECRET_ACCESS_KEY"),
      bucketName: getRequiredEnv("AWS_S3_BUCKET_NAME"),
      cloudfrontDomain: getOptionalEnv("AWS_CLOUDFRONT_DOMAIN", ""),
    },
    bedrock: {
      region: getRequiredEnv("AWS_BEDROCK_REGION"),
      accessKeyId: getOptionalEnv("AWS_BEDROCK_ACCESS_KEY_ID", ""),
      secretAccessKey: getOptionalEnv("AWS_BEDROCK_SECRET_ACCESS_KEY", ""),
      // Must be a cross-region inference profile ID (global./us./eu. prefix).
      // Bare model IDs don't support on-demand throughput for newer Claude models.
      // global. prefix works from any region including ap-southeast-2.
      fallbackModelId: getOptionalEnv(
        "AWS_BEDROCK_FALLBACK_MODEL_ID",
        "global.anthropic.claude-haiku-4-5-20251001-v1:0",
      ),
    },
  },

  // AI provider selection (bedrock or openai)
  ai: {
    provider: getOptionalEnv("AI_PROVIDER", "bedrock"),
  },

  // NSW Transport API
  nswTransportApi: {
    apiKey: getRequiredEnv("NSW_TRANSPORT_API_KEY"),
  },

  // WAQI API
  waqiApi: {
    apiToken: getRequiredEnv("WAQI_API_TOKEN"),
  },

  // Google Maps API
  googleMapsApi: {
    apiKey: getRequiredEnv("GOOGLE_MAPS_API_KEY"),
  },

  // Sightengine API
  sightengineApi: {
    apiUser: getRequiredEnv("SIGHTENGINE_API_USER"),
    apiSecret: getRequiredEnv("SIGHTENGINE_API_SECRET"),
    workflowId: getRequiredEnv("SIGHTENGINE_WORKFLOW_ID"),
  },

  // Webhook API Key
  WEBHOOK_API_KEY: getOptionalEnv("WEBHOOK_API_KEY", ""),

  // Cache (ElastiCache / Valkey)
  cache: {
    url: getOptionalEnv("CACHE_URL", ""),
    tls: getOptionalEnv("CACHE_TLS", "false") === "true",
  },

  // HTTP API rate limiting (express-rate-limit). Webhook routes use separate per-key limits.
  rateLimit: {
    // Set true when behind a reverse proxy so req.ip / rate-limit keys use X-Forwarded-For safely
    // Recommended in prod environment for rate-limiting client IPs accurately.
    trustProxy: getOptionalEnv("TRUST_PROXY", "false") === "true",
    generalWindowMs: parseInt(
      getOptionalEnv("API_RATE_LIMIT_WINDOW_MS", String(15 * 60 * 1000)),
      10,
    ),
    generalMax: parseInt(getOptionalEnv("API_RATE_LIMIT_MAX", "600"), 10),
    authWindowMs: parseInt(
      getOptionalEnv("AUTH_RATE_LIMIT_WINDOW_MS", String(15 * 60 * 1000)),
      10,
    ),
    authMax: parseInt(getOptionalEnv("AUTH_RATE_LIMIT_MAX", "40"), 10),
    /** Per-IP for all GET /api/hazards* (before auth) — map polling + abuse guard */
    hazardGetIpWindowMs: parseInt(
      getOptionalEnv("HAZARD_GET_IP_RATE_LIMIT_WINDOW_MS", "60000"),
      10,
    ),
    hazardGetIpMax: parseInt(
      getOptionalEnv("HAZARD_GET_IP_RATE_LIMIT_MAX", "600"),
      10,
    ),
    /** Per authenticated user for hazard reads (list/detail/subscription GETs) */
    hazardReadWindowMs: parseInt(
      getOptionalEnv(
        "HAZARD_READ_RATE_LIMIT_WINDOW_MS",
        String(15 * 60 * 1000),
      ),
      10,
    ),
    hazardReadMax: parseInt(
      getOptionalEnv("HAZARD_READ_RATE_LIMIT_MAX", "15000"),
      10,
    ),
  },

  // Email configuration
  email: {
    smtpHost: getRequiredEnv("SMTP_HOST"),
    smtpPort: parseInt(getRequiredEnv("SMTP_PORT"), 10),
    smtpSecure: getOptionalEnv("SMTP_SECURE", "true") === "true",
    smtpUser: getRequiredEnv("SMTP_USER"),
    smtpPassword: getRequiredEnv("SMTP_PASSWORD"),
    fromAddress: getRequiredEnv("EMAIL_FROM_ADDRESS"),
    supportAddress: getRequiredEnv("EMAIL_SUPPORT_ADDRESS"),
    supportCcAddresses: getOptionalEnv("EMAIL_SUPPORT_CC_ADDRESSES", "")
      .split(",")
      .map((email) => email.trim()),
  },
};
