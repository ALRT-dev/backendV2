import router from "express";
import {
  loginWithEmailAndPassword,
  refreshToken,
  registerWithEmailAndPassword,
  verifyAppleOAuth,
  verifyGoogleOAuth,
  verifyMicrosoftOAuth,
} from "../controllers/auth.controller.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  registerSchema,
  loginSchema,
  googleOAuthSchema,
  appleOAuthSchema,
  microsoftOAuthSchema,
  refreshTokenSchema,
} from "../validators/auth.validator.js";

const authRouter = router();

authRouter.post(
  "/email-password/register",
  validate(registerSchema),
  registerWithEmailAndPassword
);
authRouter.post(
  "/email-password/login",
  validate(loginSchema),
  loginWithEmailAndPassword
);
authRouter.post(
  "/oauth/google",
  validate(googleOAuthSchema),
  verifyGoogleOAuth
);
authRouter.post("/oauth/apple", validate(appleOAuthSchema), verifyAppleOAuth);
authRouter.post(
  "/oauth/microsoft",
  validate(microsoftOAuthSchema),
  verifyMicrosoftOAuth
);
authRouter.post("/refresh-token", validate(refreshTokenSchema), refreshToken);

export default authRouter;
