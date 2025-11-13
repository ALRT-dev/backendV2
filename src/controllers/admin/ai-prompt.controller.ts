import type { NextFunction, Request, Response } from "express";
import {
  createPrompt,
  updatePrompt,
  getAllPrompts,
  getPromptById,
  deletePrompt,
  validatePromptContent,
  type CreatePromptData,
  type UpdatePromptData,
} from "../../services/ai-prompt.service.js";
import { HttpError } from "../../models/http_error.js";
import type { AdminRequest } from "../../middlewares/auth.admin.middleware.js";

/**
 * Get all AI prompts with pagination
 */
export const getAllAIPrompts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await getAllPrompts();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get a specific AI prompt by ID
 */
export const getAIPromptById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new HttpError(400, "Prompt ID is required");
    }

    const prompt = await getPromptById(id);

    res.status(200).json(prompt);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new AI prompt
 */
export const createAIPrompt = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.admin) {
      throw new HttpError(401, "Unauthorized");
    }
    const adminId = req.admin.id;

    const { name, description, content, variables }: CreatePromptData =
      req.body;

    // Validate prompt content
    const validation = validatePromptContent(content, variables);
    if (!validation.isValid) {
      throw new HttpError(400, "Invalid prompt content");
    }

    const prompt = await createPrompt(
      {
        name,
        ...(description && { description }),
        content,
        variables,
      },
      adminId
    );

    res.status(201).json(prompt);
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing AI prompt
 */
export const updateAIPrompt = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.admin) {
      throw new HttpError(401, "Unauthorized");
    }
    const adminId = req.admin.id;

    const { id } = req.params;
    const updateData: UpdatePromptData = req.body;

    if (!id) {
      throw new HttpError(400, "Prompt ID is required");
    }

    // Validate prompt content if being updated
    if (updateData.content && updateData.variables) {
      const validation = validatePromptContent(
        updateData.content,
        updateData.variables
      );
      if (!validation.isValid) {
        throw new HttpError(400, "Invalid prompt content");
      }
    }

    const prompt = await updatePrompt(id, updateData, adminId);

    res.status(200).json(prompt);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete an AI prompt (hard delete)
 */
export const deleteAIPrompt = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.admin) {
      throw new HttpError(401, "Admin authentication required");
    }

    const { id } = req.params;

    if (!id) {
      throw new HttpError(400, "Prompt ID is required");
    }

    await deletePrompt(id);

    res.status(200).json({ message: "Prompt deleted successfully" });
  } catch (error) {
    next(error);
  }
};
