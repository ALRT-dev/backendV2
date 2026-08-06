import bycrypt from "bcrypt";
import { config } from "../utils/config.js";
import appleSigninAuth from "apple-signin-auth";
import googleOAuthClient from "../utils/google_oauth_client.util.js";
import { verifyMicrosoftIdToken } from "../utils/microsoft_oauth_client.util.js";

/**
 * Verify Google ID token and return the decoded payload
 * @param idToken - The ID token from Google OAuth
 * @returns Decoded token payload with email and other user info
 */
export const verifyGoogleToken = async (idToken: string) => {
  const ticket = await googleOAuthClient.verifyIdToken({
    idToken,
    audience: [
      config.googleOAuth.clientIdWeb,
      config.googleOAuth.clientIdIos,
      config.googleOAuth.clientIdAndroid,
    ],
  });

  return ticket.getPayload();
};

/**
 * Verify Apple identity token and return the decoded payload
 * @param identityToken - The identity token from Apple Sign-In
 * @returns Decoded token payload with email and other user info
 */
export const verifyAppleToken = async (identityToken: string) => {
  const appleIdTokenClaims = await appleSigninAuth.verifyIdToken(
    identityToken,
    {
      audience: config.appleOAuth.audience,
      ignoreExpiration: false,
    }
  );

  return appleIdTokenClaims;
};

/**
 * Verify a Microsoft (Azure AD / MSAL) id token and return the decoded payload
 * @param idToken - The id token from Microsoft OAuth
 * @returns Decoded token payload with email and other user info
 */
export const verifyMicrosoftToken = async (idToken: string) => {
  return await verifyMicrosoftIdToken(idToken);
};

export const hashPassword = (password: string) => {
  const hashed = bycrypt.hashSync(password, 10);
  return hashed;
};

export const comparePassword = (password: string, hashedPassword: string) => {
  return bycrypt.compareSync(password, hashedPassword);
};
