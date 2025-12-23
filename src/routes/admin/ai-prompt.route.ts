import { Router } from "express";
import {
  getAllAIPrompts,
  getAIPromptById,
  createAIPrompt,
  updateAIPrompt,
  deleteAIPrompt,
  getGroupedAIPrompts,
} from "../../controllers/admin/ai-prompt.controller.js";
import { requireAdminAuth } from "../../middlewares/auth.admin.middleware.js";

const adminAIPromptRouter = Router();

adminAIPromptRouter.use(requireAdminAuth);

adminAIPromptRouter.get("/", getAllAIPrompts);
adminAIPromptRouter.get("/grouped", getGroupedAIPrompts);
adminAIPromptRouter.get("/:id", getAIPromptById);
adminAIPromptRouter.post("/", createAIPrompt);
adminAIPromptRouter.put("/:id", updateAIPrompt);
adminAIPromptRouter.delete("/:id", deleteAIPrompt);

export default adminAIPromptRouter;
