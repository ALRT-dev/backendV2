import { Router } from "express";
import { getUserProfile } from "../controllers/user.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const userRouter = Router();

userRouter.get("/", requireAuth, getUserProfile);

export default userRouter;
