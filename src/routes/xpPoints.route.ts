import { Router } from "express";
import {
  getUserXpBreakdown,
  getXpLeaderboard,
  getXpSummaryController,
} from "../controllers/xpPoints.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const xpPointsRouter = Router();

xpPointsRouter.get("/summary", requireAuth, getXpSummaryController);
xpPointsRouter.get("/breakdown", requireAuth, getUserXpBreakdown);
xpPointsRouter.get("/leaderboard", requireAuth, getXpLeaderboard);

export default xpPointsRouter;
