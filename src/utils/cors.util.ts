import { config } from "./config.js";

/** Allowed CORS origins: config list; localhost/127.0.0.1 only in non-prod. */
export const isAllowedOrigin = (origin: string | undefined): boolean => {
  if (!origin) return true;
  if (config.cors.allowedOrigins.includes(origin)) return true;
  if (config.env === "prod") return false;
  try {
    const url = new URL(origin);
    return (
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      (url.protocol === "http:" || url.protocol === "https:")
    );
  } catch {
    return false;
  }
};
