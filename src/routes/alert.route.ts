import { Router } from "express";
import { getAlertsGeo } from "../controllers/alert.controller.js";
import { requireUserOrExportKeyAuth } from "../middlewares/export_auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import { getAlertsGeoQuerySchema } from "../validators/alert.validator.js";

const alertRouter = Router();

alertRouter.get(
  "/geo",
  requireUserOrExportKeyAuth,
  validate(getAlertsGeoQuerySchema, "query"),
  getAlertsGeo,
);

export default alertRouter;
