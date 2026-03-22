import { createClient, type RedisClientType } from "redis";
import { config } from "./config.js";

let client: RedisClientType | null = null;
let isConnected = false;

export const initCacheClient = async (): Promise<void> => {
  if (!config.cache.url) {
    console.warn("CACHE_URL not set — caching is disabled");
    return;
  }

  try {
    client = createClient({
      url: config.cache.url,
      ...(config.cache.tls && { socket: { tls: true } }),
      pingInterval: 30_000,
    });

    client.on("error", (err) => {
      console.error("Cache client error:", err.message);
      isConnected = false;
    });

    client.on("ready", () => {
      console.log("Cache client connected to ElastiCache (Valkey)");
      isConnected = true;
    });

    client.on("end", () => {
      isConnected = false;
    });

    await client.connect();
  } catch (err) {
    console.error("Failed to initialize cache client:", err);
    client = null;
    isConnected = false;
  }
};

export const getCacheClient = (): RedisClientType | null => {
  return isConnected ? client : null;
};

export const disconnectCacheClient = async (): Promise<void> => {
  if (client) {
    await client.quit();
    client = null;
    isConnected = false;
  }
};
