import router from "express";
import {
  loginWithEmailAndPassword,
  registerWithEmailAndPassword,
  verifyGoogleOAuth,
} from "../controllers/auth.controller.js";

const authRouter = router();

authRouter.post("/email-password/register", registerWithEmailAndPassword);

authRouter.post("/email-password/login", loginWithEmailAndPassword);

authRouter.post("/oauth/google", verifyGoogleOAuth);

export default authRouter;
