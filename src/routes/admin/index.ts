import { Router } from "express";
import adminAuthRouter from "./auth.route.js";
import adminHazardCategoryRouter from "./hazard_category.route.js";
import adminHazardRouter from "./hazard.route.js";
import adminUserRouter from "./user.route.js";

const adminRouter = Router();

adminRouter.use("/auth", adminAuthRouter);
adminRouter.use("/users", adminUserRouter);
adminRouter.use("/categories", adminHazardCategoryRouter);
adminRouter.use("/hazards", adminHazardRouter);

export default adminRouter;
