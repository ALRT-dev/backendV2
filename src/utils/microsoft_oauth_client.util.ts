import crypto from "crypto";
import axios from "axios";
import jwt from "jsonwebtoken";
import { config } from "./config.js";
import { HttpError } from "../models/http_error.js";

/**
 * Microsoft identity platform id-token verification.
 *
 * Mirrors the Google/Apple verifiers in `auth.service.ts` but Microsoft has no
 * first-party Node SDK in this project, so we validate the token ourselves:
 *  - fetch Microsoft's published JWKS (cached, refreshed on key rotation),
 *  - verify the RS256 signature with the matching signing key,
 *  - enforce the audience (our client id) and a Microsoft-issued issuer.
 *
 * No extra dependency is needed — Node's `crypto.createPublicKey` consumes the
 * JWK directly.
 */

interface MicrosoftJwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
  use?: string;
}

const MULTI_TENANT_ALIASES = ["common", "organizations", "consumers"];
const JWKS_TTL_MS = 24 * 60 * 60 * 1000;

const getTenant = () => config.microsoftOAuth.tenantId || "common";

const getJwksUri = () =>
  `https://login.microsoftonline.com/${getTenant()}/discovery/v2.0/keys`;

let cachedKeys: MicrosoftJwk[] = [];
let cachedAt = 0;

/// Fetches Microsoft's JWKS, using a short-lived in-memory cache. Microsoft
/// rotates signing keys, so callers force a refresh when they hit an unknown kid.
const fetchJwks = async (forceRefresh = false): Promise<MicrosoftJwk[]> => {
  const isStale = Date.now() - cachedAt > JWKS_TTL_MS;
  if (forceRefresh || isStale || cachedKeys.length === 0) {
    const { data } = await axios.get<{ keys?: MicrosoftJwk[] }>(getJwksUri());
    cachedKeys = data.keys ?? [];
    cachedAt = Date.now();
  }
  return cachedKeys;
};

/// Resolves the PEM signing key for a given key id, refreshing the JWKS once if
/// the key id isn't in the cache (keys may have rotated).
const getSigningKeyPem = async (kid: string): Promise<string> => {
  let key = (await fetchJwks()).find((k) => k.kid === kid);
  if (!key) {
    key = (await fetchJwks(true)).find((k) => k.kid === kid);
  }
  if (!key) {
    throw new HttpError(401, "Unknown Microsoft signing key");
  }

  const publicKey = crypto.createPublicKey({
    key: key as unknown as crypto.JsonWebKey,
    format: "jwk",
  });
  return publicKey.export({ type: "spki", format: "pem" }).toString();
};

/**
 * Verifies a Microsoft (Azure AD / MSAL) id token and returns its claims.
 *
 * @param idToken - The id token issued by the Microsoft identity platform.
 * @returns The decoded and verified token payload.
 */
export const verifyMicrosoftIdToken = async (
  idToken: string
): Promise<jwt.JwtPayload> => {
  if (!config.microsoftOAuth.clientId) {
    throw new HttpError(501, "Microsoft sign-in is not configured");
  }

  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || typeof decoded === "string" || !decoded.header.kid) {
    throw new HttpError(401, "Invalid Microsoft identity token");
  }

  const signingKeyPem = await getSigningKeyPem(decoded.header.kid);

  let payload: jwt.JwtPayload;
  try {
    // jwt.verify enforces signature, expiry (exp) and audience.
    payload = jwt.verify(idToken, signingKeyPem, {
      algorithms: ["RS256"],
      audience: config.microsoftOAuth.clientId,
    }) as jwt.JwtPayload;
  } catch {
    throw new HttpError(401, "Invalid Microsoft identity token");
  }

  // Issuer must be the Microsoft identity platform. For multi-tenant apps the
  // issuer contains the caller's home-tenant GUID (not "common"), so validate
  // the shape and, when a specific tenant is configured, that it matches.
  const issuer = typeof payload.iss === "string" ? payload.iss : "";
  const issuerShapeOk =
    /^https:\/\/login\.microsoftonline\.com\/[^/]+\/v2\.0$/.test(issuer);
  if (!issuerShapeOk) {
    throw new HttpError(401, "Untrusted Microsoft token issuer");
  }

  const tenant = getTenant();
  if (!MULTI_TENANT_ALIASES.includes(tenant) && !issuer.includes(tenant)) {
    throw new HttpError(401, "Microsoft token from an unexpected tenant");
  }

  return payload;
};
