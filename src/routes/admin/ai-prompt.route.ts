import { Router } from "express";
import {
  getAllAIPrompts,
  getAIPromptById,
  createAIPrompt,
  updateAIPrompt,
  deleteAIPrompt,
  activateAIPrompt,
  deactivateAIPrompt,
  validateAIPromptContent,
} from "../../controllers/admin/ai-prompt.controller.js";
import { requireAdminAuth } from "../../middlewares/auth.admin.middleware.js";

const adminAIPromptRouter = Router();

adminAIPromptRouter.use(requireAdminAuth);

adminAIPromptRouter.get("/", getAllAIPrompts);
adminAIPromptRouter.get("/:id", getAIPromptById);
adminAIPromptRouter.post("/", createAIPrompt);
adminAIPromptRouter.put("/:id", updateAIPrompt);
adminAIPromptRouter.delete("/:id", deleteAIPrompt);
adminAIPromptRouter.patch("/:id/activate", activateAIPrompt);
adminAIPromptRouter.patch("/:id/deactivate", deactivateAIPrompt);
adminAIPromptRouter.post("/validate", validateAIPromptContent);

export default adminAIPromptRouter;
