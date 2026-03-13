import { createHash } from "crypto";
import { getCacheClient } from "../utils/cache_client.util.js";

const HAZARD_LIST_TTL = 60;
const HAZARD_SINGLE_TTL = 300;
const VERSION_KEY = "hazards:version";
const COORD_PRECISION = 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COORD_KEYS = new Set([
  "northeastLat",
  "northeastLng",
  "southwestLat",
  "southwestLng",
  "userLat",
  "userLng",
]);

const roundCoord = (
  value: number | undefined | null,
  precision: number = COORD_PRECISION,
): string => {
  if (value === undefined || value === null || isNaN(value as number))
    return "_";
  return (value as number).toFixed(precision);
};

/**
 * Normalize a value for deterministic hashing:
 * - Skip undefined, null, "" and empty arrays
 * - Round coordinate-like numbers to fixed precision
 * - Sort object keys and array elements so key/order doesn't change the hash
 */
const normalizeForHash = (value: unknown, coordPrecision: number): unknown => {
  if (value === undefined || value === null || value === "") return undefined;
  if (Array.isArray(value)) {
    if (value.length === 0) return undefined;
    const normalized = value
      .map((v) => normalizeForHash(v, coordPrecision))
      .filter((v) => v !== undefined);
    if (normalized.length === 0) return undefined;
    const sorted = normalized.every(
      (v) =>
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean",
    )
      ? [...normalized].sort((a, b) => String(a).localeCompare(String(b)))
      : [...normalized].sort((a, b) =>
          JSON.stringify(a).localeCompare(JSON.stringify(b)),
        );
    return sorted;
  }
  if (typeof value === "object" && value !== null && !(value instanceof Date)) {
    const obj = value as Record<string, unknown>;
    const entries: [string, unknown][] = [];
    for (const k of Object.keys(obj).sort()) {
      const v = normalizeForHash(obj[k], coordPrecision);
      if (v !== undefined) entries.push([k, v]);
    }
    if (entries.length === 0) return undefined;
    return Object.fromEntries(entries);
  }
  if (typeof value === "number" && !Number.isInteger(value)) {
    if (isNaN(value)) return undefined;
    return Number(value.toFixed(coordPrecision));
  }
  return value;
};

const stableHash = (
  params: Record<string, unknown>,
  coordPrecision: number = COORD_PRECISION,
): string => {
  const rounded: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(params)) {
    if (val === undefined || val === null || val === "") continue;
    if (Array.isArray(val) && val.length === 0) continue;
    if (COORD_KEYS.has(key) && typeof val === "number") {
      rounded[key] = roundCoord(val, coordPrecision);
      continue;
    }
    const normalized = normalizeForHash(val, coordPrecision);
    if (normalized !== undefined) rounded[key] = normalized;
  }
  return createHash("sha256")
    .update(JSON.stringify(rounded))
    .digest("hex")
    .slice(0, 16);
};

const getVersion = async (): Promise<number> => {
  const redis = getCacheClient();
  if (!redis) return 0;
  try {
    const v = await redis.get(VERSION_KEY);
    return v ? parseInt(v, 10) : 0;
  } catch {
    return 0;
  }
};

// ---------------------------------------------------------------------------
// List cache (version-gated so mutations auto-invalidate)
// ---------------------------------------------------------------------------

export const buildHazardListCacheKey = async (
  params: Record<string, unknown>,
  roundPrecision: number = COORD_PRECISION,
): Promise<string> => {
  const version = await getVersion();
  return `hazards:list:v${version}:${stableHash(params, roundPrecision)}`;
};

export const getCachedHazardList = async <T = unknown>(
  key: string,
): Promise<T[] | null> => {
  const redis = getCacheClient();
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T[]) : null;
  } catch {
    return null;
  }
};

export const cacheHazardList = async (
  key: string,
  data: unknown[],
): Promise<void> => {
  const redis = getCacheClient();
  if (!redis) return;
  try {
    await redis.setEx(key, HAZARD_LIST_TTL, JSON.stringify(data));
  } catch {
    /* cache writes are best-effort */
  }
};

// ---------------------------------------------------------------------------
// Single-hazard cache
// ---------------------------------------------------------------------------

const hazardKey = (id: string) => `hazard:${id}`;

export const getCachedHazard = async <T = unknown>(
  hazardId: string,
): Promise<T | null> => {
  const redis = getCacheClient();
  if (!redis) return null;
  try {
    const raw = await redis.get(hazardKey(hazardId));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

export const cacheHazard = async (
  hazardId: string,
  data: unknown,
): Promise<void> => {
  const redis = getCacheClient();
  if (!redis) return;
  try {
    await redis.setEx(
      hazardKey(hazardId),
      HAZARD_SINGLE_TTL,
      JSON.stringify(data),
    );
  } catch {
    /* best-effort */
  }
};

// ---------------------------------------------------------------------------
// Invalidation
// ---------------------------------------------------------------------------

export const invalidateHazardCache = async (
  hazardId: string,
): Promise<void> => {
  const redis = getCacheClient();
  if (!redis) return;
  try {
    await redis.del(hazardKey(hazardId));
  } catch {
    /* best-effort */
  }
};

/**
 * Bumps the list-cache version so every existing list key becomes stale.
 * Old entries expire naturally via TTL — no expensive SCAN/DEL needed.
 */
export const invalidateHazardListCaches = async (): Promise<void> => {
  const redis = getCacheClient();
  if (!redis) return;
  try {
    await redis.incr(VERSION_KEY);
  } catch {
    /* best-effort */
  }
};

/**
 * Convenience: invalidate both list caches and (optionally) a single hazard.
 * Call after any hazard mutation (create / update / delete / vote).
 */
export const invalidateHazardCaches = async (
  hazardId?: string,
): Promise<void> => {
  const promises: Promise<void>[] = [invalidateHazardListCaches()];
  if (hazardId) {
    promises.push(invalidateHazardCache(hazardId));
  }
  await Promise.all(promises);
};
