import jwt from "jsonwebtoken";
import { config } from "./config.js";

export const signAccessToken = (payload: any) => {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: `${config.jwt.accessExpirationMinutes}m`,
  });
};

export const signRefreshToken = (payload: any) => {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: `${config.jwt.refreshExpirationDays}d`,
  });
};

export const verifyAccessToken = (payload: any) => {
  return jwt.verify(payload, config.jwt.accessSecret);
};

export const verifyRefreshToken = (payload: any) => {
  return jwt.verify(payload, config.jwt.refreshSecret);
};

export const decodeToken = (payload: any) => {
  return jwt.decode(payload);
};

export const getTokenExpirationDate = (payload: any) => {
  const decoded = jwt.decode(payload) as { exp: number } | null;
  if (!decoded || !decoded.exp) {
    return null;
  }

  const exp = new Date(0);
  exp.setUTCSeconds(decoded.exp);
  return exp;
};

export const isTokenExpired = (payload: any) => {
  const expirationDate = getTokenExpirationDate(payload);
  if (!expirationDate) {
    return null;
  }
  return expirationDate < new Date();
};
