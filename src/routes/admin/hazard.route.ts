import { Router } from "express";
import {
  createHazardForAdmin,
  deleteHazardForAdmin,
  getHazardsForAdmin,
  getHazardSourcesForAdmin,
  syncHazardsFromExternalSourceForAdmin,
  updateHazardForAdmin,
} from "../../controllers/admin/hazard.controller.js";

const adminHazardRouter = Router();

adminHazardRouter.get("/", getHazardsForAdmin);
adminHazardRouter.post("/", createHazardForAdmin);
adminHazardRouter.put("/:hazardId", updateHazardForAdmin);
adminHazardRouter.delete("/:hazardId", deleteHazardForAdmin);
adminHazardRouter.get("/sources", getHazardSourcesForAdmin);
adminHazardRouter.post("/sync-external", syncHazardsFromExternalSourceForAdmin);

export default adminHazardRouter;
