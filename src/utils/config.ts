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
    user: getRequiredEnv("POSTGRES_USER"),
    password: getRequiredEnv("POSTGRES_PASSWORD"),
    host: getRequiredEnv("POSTGRES_HOST"),
    port: parseInt(getRequiredEnv("POSTGRES_PORT"), 10),
    name: getRequiredEnv("POSTGRES_DATABASE"),
  },

  // JWT
  jwt: {
    accessSecret: getRequiredEnv("JWT_ACCESS_SECRET"),
    accessExpirationMinutes: parseInt(getRequiredEnv("JWT_ACCESS_EXP_M"), 10),
    refreshSecret: getRequiredEnv("JWT_REFRESH_SECRET"),
    refreshExpirationDays: parseInt(getRequiredEnv("JWT_REFRESH_EXP_D"), 10),
  },

  // Google OAuth
  googleOAuth: {
    clientIdWeb: getRequiredEnv("GOOGLE_OAUTH_CLIENT_ID_WEB"),
    clientIdIos: getRequiredEnv("GOOGLE_OAUTH_CLIENT_ID_IOS"),
    clientIdAndroid: getRequiredEnv("GOOGLE_OAUTH_CLIENT_ID_ANDROID"),
  },

  // OpenAI
  openAI: {
    apiKey: getRequiredEnv("OPENAI_API_KEY"),
  },
};
