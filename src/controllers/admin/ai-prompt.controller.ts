import type { NextFunction, Request, Response } from "express";
import {
  createPrompt,
  updatePrompt,
  getAllPrompts,
  getPromptById,
  deletePrompt,
  activatePrompt,
  deactivatePrompt,
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
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const includeInactive = req.query.includeInactive === "true";

    const result = await getAllPrompts(page, pageSize, includeInactive);

    res.status(200).json(result);
  } catch (error) {
    console.error("Error in getAllAIPrompts:", error);
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
    console.error("Error in getAIPromptById:", error);
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

    const {
      name,
      description,
      content,
      variables,
      version,
      isActive,
    }: CreatePromptData = req.body;

    // Validate required fields
    if (!name || !content || !variables) {
      throw new HttpError(400, "Name, content, and variables are required");
    }

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
        ...(version && { version }),
        ...(isActive !== undefined && { isActive }),
      },
      adminId
    );

    res.status(201).json(prompt);
  } catch (error) {
    console.error("Error in createAIPrompt:", error);
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
    console.error("Error in updateAIPrompt:", error);
    next(error);
  }
};

/**
 * Delete an AI prompt (hard delete)
 */
export const deleteAIPrompt = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new HttpError(400, "Prompt ID is required");
    }

    await deletePrompt(id);

    res.status(200).json({
      message: "Prompt deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteAIPrompt:", error);
    next(error);
  }
};

/**
 * Activate an AI prompt
 */
export const activateAIPrompt = async (
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
    if (!id) {
      throw new HttpError(400, "Prompt ID is required");
    }

    const prompt = await activatePrompt(id, adminId);

    res.status(200).json(prompt);
  } catch (error) {
    console.error("Error in activateAIPrompt:", error);
    next(error);
  }
};

/**
 * Deactivate an AI prompt
 */
export const deactivateAIPrompt = async (
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
    if (!id) {
      throw new HttpError(400, "Prompt ID is required");
    }

    const prompt = await deactivatePrompt(id, adminId);

    res.status(200).json(prompt);
  } catch (error) {
    console.error("Error in deactivateAIPrompt:", error);
    next(error);
  }
};

/**
 * Validate prompt content
 */
export const validateAIPromptContent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { content, variables } = req.body;

    if (!content || !variables) {
      throw new HttpError(400, "Content and variables are required");
    }

    const validation = validatePromptContent(content, variables);

    res.status(200).json(validation);
  } catch (error) {
    console.error("Error in validateAIPromptContent:", error);
    next(error);
  }
};
