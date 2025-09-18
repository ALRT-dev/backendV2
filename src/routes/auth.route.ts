import router from "express";
import {
  loginWithEmailAndPassword,
  registerWithEmailAndPassword,
} from "../controllers/auth.controller.js";

const authRouter = router();

authRouter.post("/email-password/register", registerWithEmailAndPassword);

authRouter.post("/email-password/login", loginWithEmailAndPassword);

export default authRouter;
