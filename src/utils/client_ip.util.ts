import type { Request } from "express";
import net from "node:net";

/**
 * Collapse IPv4-mapped IPv6 (::ffff:x.x.x.x) to x.x.x.x so rate-limit keys match
 * the same client whether the stack reports mapped or native IPv4 (CVE-2026-30827 / dual-stack).
 */
export function normalizeClientIpForRateLimitKey(raw: string): string {
  const ip = raw.trim();
  if (!ip || ip === "unknown") return ip;
  const prefix = "::ffff:";
  if (ip.length > prefix.length && ip.toLowerCase().startsWith(prefix)) {
    const v4 = ip.slice(prefix.length);
    if (net.isIPv4(v4)) return v4;
  }
  return ip;
}

/**
 * Client IP for logging / rate limiting. Prefer X-Forwarded-For when present (first hop).
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    const firstIp = forwarded.split(",")[0];
    return firstIp ? firstIp.trim() : "unknown";
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}
