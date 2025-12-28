import { Router } from "express";
import {
  getAllAIPrompts,
  getAIPromptById,
  createAIPrompt,
  updateAIPrompt,
  deleteAIPrompt,
  getGroupedAIPrompts,
  createAIPromptGroup,
  updateAIPromptGroup,
  deleteAIPromptGroup,
} from "../../controllers/admin/ai-prompt.controller.js";
import { requireAdminAuth } from "../../middlewares/auth.admin.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import {
  createAIPromptGroupForAdminBodySchema,
  updateAIPromptGroupForAdminBodySchema,
  deleteAIPromptGroupForAdminParamsSchema,
} from "../../validators/admin/ai-prompt-group.validator.js";
import {
  getAIPromptByIdParamsSchema,
  createAIPromptBodySchema,
  updateAIPromptParamsSchema,
  updateAIPromptBodySchema,
  deleteAIPromptParamsSchema,
} from "../../validators/admin/ai-prompt.validator.js";

const adminAIPromptRouter = Router();

adminAIPromptRouter.use(requireAdminAuth);

// Prompt routes
adminAIPromptRouter.get("/", getAllAIPrompts);
adminAIPromptRouter.get("/grouped", getGroupedAIPrompts);
adminAIPromptRouter.get(
  "/:id",
  validate(getAIPromptByIdParamsSchema, "params"),
  getAIPromptById
);
adminAIPromptRouter.post(
  "/",
  validate(createAIPromptBodySchema),
  createAIPrompt
);
adminAIPromptRouter.put(
  "/:id",
  validate(updateAIPromptParamsSchema, "params"),
  validate(updateAIPromptBodySchema),
  updateAIPrompt
);
adminAIPromptRouter.delete(
  "/:id",
  validate(deleteAIPromptParamsSchema, "params"),
  deleteAIPrompt
);

// Prompt group routes
adminAIPromptRouter.post(
  "/groups",
  validate(createAIPromptGroupForAdminBodySchema),
  createAIPromptGroup
);
adminAIPromptRouter.put(
  "/groups/:id",
  validate(updateAIPromptGroupForAdminBodySchema),
  updateAIPromptGroup
);
adminAIPromptRouter.delete(
  "/groups/:id",
  validate(deleteAIPromptGroupForAdminParamsSchema, "params"),
  deleteAIPromptGroup
);

export default adminAIPromptRouter;
