import jwt from "jsonwebtoken";
import { config } from "./config.js";

export interface AdminTokenPayload {
  adminId: string;
  email: string;
  role: string;
  sessionId?: string | undefined;
}

export const signAdminAccessToken = (payload: AdminTokenPayload) => {
  return jwt.sign(payload, config.adminJwt.accessSecret, {
    expiresIn: `${config.adminJwt.accessExpirationMinutes}m`,
    issuer: "alrt-admin",
    audience: "alrt-admin-panel",
  });
};

export const signAdminRefreshToken = (payload: AdminTokenPayload) => {
  return jwt.sign(payload, config.adminJwt.refreshSecret, {
    expiresIn: `${config.adminJwt.refreshExpirationDays}d`,
    issuer: "alrt-admin",
    audience: "alrt-admin-panel",
  });
};

export const verifyAdminAccessToken = (token: string) => {
  return jwt.verify(token, config.adminJwt.accessSecret, {
    issuer: "alrt-admin",
    audience: "alrt-admin-panel",
  }) as AdminTokenPayload;
};

export const verifyAdminRefreshToken = (token: string) => {
  return jwt.verify(token, config.adminJwt.refreshSecret, {
    issuer: "alrt-admin",
    audience: "alrt-admin-panel",
  }) as AdminTokenPayload;
};

export const decodeAdminToken = (token: string) => {
  return jwt.decode(token) as AdminTokenPayload | null;
};

export const getAdminTokenExpirationDate = (token: string) => {
  const decoded = jwt.decode(token) as { exp: number } | null;
  if (!decoded || !decoded.exp) {
    return null;
  }

  const exp = new Date(0);
  exp.setUTCSeconds(decoded.exp);
  return exp;
};

export const isAdminTokenExpired = (token: string) => {
  const expirationDate = getAdminTokenExpirationDate(token);
  if (!expirationDate) {
    return true;
  }
  return expirationDate < new Date();
};
