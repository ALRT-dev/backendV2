import { createHash } from "crypto";
import { getCacheClient } from "../utils/cache_client.util.js";

const HAZARD_LIST_TTL = 60;
const HAZARD_SINGLE_TTL = 300;
const VERSION_KEY = "hazards:version";
const COORD_PRECISION = 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const roundCoord = (value: number | undefined | null): string => {
  if (value === undefined || value === null || isNaN(value as number))
    return "_";
  return (value as number).toFixed(COORD_PRECISION);
};

const stableHash = (params: Record<string, unknown>): string => {
  const sorted = Object.keys(params)
    .sort()
    .reduce(
      (acc, key) => {
        const val = params[key];
        if (val !== undefined && val !== null && val !== "") {
          acc[key] = val;
        }
        return acc;
      },
      {} as Record<string, unknown>,
    );

  return createHash("sha256")
    .update(JSON.stringify(sorted))
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
): Promise<string> => {
  const version = await getVersion();

  const normalized: Record<string, unknown> = {
    ...params,
    northeastLat: roundCoord(params.northeastLat as number | undefined),
    northeastLng: roundCoord(params.northeastLng as number | undefined),
    southwestLat: roundCoord(params.southwestLat as number | undefined),
    southwestLng: roundCoord(params.southwestLng as number | undefined),
  };

  return `hazards:list:v${version}:${stableHash(normalized)}`;
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
    await redis.setEx(hazardKey(hazardId), HAZARD_SINGLE_TTL, JSON.stringify(data));
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
