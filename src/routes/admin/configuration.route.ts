import { Router } from "express";
import {
  getAllConfigurations,
  getConfigurationById,
  createConfiguration,
  updateConfiguration,
  deleteConfiguration,
} from "../../controllers/admin/configuration.controller.js";
import { requireAdminAuth } from "../../middlewares/auth.admin.middleware.js";

const adminConfigurationRouter = Router();

adminConfigurationRouter.use(requireAdminAuth);

adminConfigurationRouter.get("/", getAllConfigurations);
adminConfigurationRouter.get("/:id", getConfigurationById);
adminConfigurationRouter.post("/", createConfiguration);
adminConfigurationRouter.put("/:id", updateConfiguration);
adminConfigurationRouter.delete("/:id", deleteConfiguration);

export default adminConfigurationRouter;
