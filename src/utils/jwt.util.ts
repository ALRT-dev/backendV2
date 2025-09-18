import jwt from "jsonwebtoken";

export const signAccessToken = (payload: any) => {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET!!, {
    expiresIn: `${Number(process.env.JWT_ACCESS_EXP_M)}m`,
  });
};

export const signRefreshToken = (payload: any) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!!, {
    expiresIn: `${Number(process.env.JWT_REFRESH_EXP_D)}d`,
  });
};

export const verifyAccessToken = (payload: any) => {
  return jwt.verify(payload, process.env.JWT_ACCESS_SECRET!!);
};

export const verifyRefreshToken = (payload: any) => {
  return jwt.verify(payload, process.env.JWT_REFRESH_SECRET!!);
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
