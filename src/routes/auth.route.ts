import router from "express";
import {
  loginWithEmailAndPassword,
  refreshToken,
  registerWithEmailAndPassword,
  verifyGoogleOAuth,
} from "../controllers/auth.controller.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  registerSchema,
  loginSchema,
  googleOAuthSchema,
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
authRouter.post("/refresh-token", validate(refreshTokenSchema), refreshToken);

export default authRouter;
