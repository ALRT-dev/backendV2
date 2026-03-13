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
      10
    ),
    refreshSecret: getRequiredEnv("ADMIN_JWT_REFRESH_SECRET"),
    refreshExpirationDays: parseInt(
      getRequiredEnv("ADMIN_JWT_REFRESH_EXP_D"),
      10
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

  // AWS S3
  aws: {
    region: getRequiredEnv("AWS_REGION"),
    accessKeyId: getRequiredEnv("AWS_ACCESS_KEY_ID"),
    secretAccessKey: getRequiredEnv("AWS_SECRET_ACCESS_KEY"),
    s3BucketName: getRequiredEnv("AWS_S3_BUCKET_NAME"),
    cloudfrontDomain: getOptionalEnv("AWS_CLOUDFRONT_DOMAIN", ""),
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
