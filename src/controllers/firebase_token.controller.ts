import type { NextFunction, Request, Response } from "express";

import { HttpError } from "../models/http_error.js";
import { firebaseAdmin } from "../utils/firebase_admin_client.util.js";

const requireUserId = (res: Response): string => {
  const userId = res.userId;
  if (!userId) throw new HttpError(401, "Not authenticated");
  return userId;
};

/**
 * POST /api/user/firebase-token
 *
 * Mints a Firebase custom token for the signed-in ALRT user.
 *
 * Ask ALRT is a Firebase callable that requires `request.auth.uid`. The
 * app authenticates against THIS backend, not against Firebase, so every
 * call arrived with no auth context and was rejected as unauthenticated
 * before it ever reached the assistant. Handing the app a custom token
 * lets it sign in to Firebase as the same person, so the callable sees a
 * uid it can trust, log and rate-limit against.
 *
 * The uid IS the ALRT user id, so quotas and logs on the Firebase side
 * line up with the user record here.
 */
export const getFirebaseCustomTokenController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const token = await firebaseAdmin.auth().createCustomToken(userId);
    res.status(200).json({ token });
  } catch (error) {
    next(error);
  }
};
