import { Router } from "express";
import { submitSupportRequestController } from "../controllers/support.controller.js";
import { validate } from "../middlewares/validation.middleware.js";
import { submitSupportRequestSchema } from "../validators/support.validator.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
  handleMulterError,
  uploadSupportAttachments,
} from "../middlewares/upload.middleware.js";

const supportRouter = Router();

supportRouter.post(
  "/",
  requireAuth,
  uploadSupportAttachments,
  handleMulterError,
  validate(submitSupportRequestSchema),
  submitSupportRequestController
);

export default supportRouter;
