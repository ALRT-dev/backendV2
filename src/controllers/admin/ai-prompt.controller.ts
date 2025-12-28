import type { NextFunction, Request, Response } from "express";
import {
  createPrompt,
  updatePrompt,
  getAllPrompts,
  getPromptById,
  deletePrompt,
  validatePromptContent,
  getGroupedPrompts,
  createPromptGroup,
  updatePromptGroup,
  deletePromptGroup,
  type CreatePromptData,
  type UpdatePromptData,
} from "../../services/ai-prompt.service.js";
import { HttpError } from "../../models/http_error.js";
import type { AdminRequest } from "../../middlewares/auth.admin.middleware.js";
import type {
  CreateAIPromptBody,
  UpdateAIPromptBody,
} from "../../validators/admin/ai-prompt.validator.js";

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
 * Get all AI prompts grouped by their groups
 */
export const getGroupedAIPrompts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await getGroupedPrompts();
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

    const {
      name,
      description,
      content,
      variables,
      model,
      groupId,
    }: CreateAIPromptBody = req.body;

    // Validate prompt content
    const validation = validatePromptContent(content, variables);
    if (!validation.isValid) {
      throw new HttpError(400, "Invalid prompt content");
    }

    const createData: CreatePromptData = {
      name,
      ...(description && { description }),
      content,
      variables,
      model,
      groupId,
    };

    const prompt = await createPrompt(createData, adminId);

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

    const { id } = req.params as { id: string };
    const {
      name,
      description,
      content,
      variables,
      model,
      groupId,
    }: UpdateAIPromptBody = req.body;

    // Check if nothing to update
    if (!description && !content && !variables && !model && !groupId) {
      throw new HttpError(400, "Nothing to update");
    }

    // Validate prompt content if being updated
    if (content && variables) {
      const validation = validatePromptContent(content, variables);
      if (!validation.isValid) {
        throw new HttpError(400, "Invalid prompt content");
      }
    }

    const updateData: UpdatePromptData = {
      ...(name && { name }),
      ...(description && { description }),
      ...(content && { content }),
      ...(variables && { variables }),
      ...(model && { model }),
      ...(groupId && { groupId }),
    };

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

    const { id } = req.params as { id: string };

    await deletePrompt(id);

    res.status(200).json({ message: "Prompt deleted successfully" });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new AI prompt group
 */
export const createAIPromptGroup = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.admin) {
      throw new HttpError(401, "Admin authentication required");
    }

    const { name, description } = req.body;

    if (!name) {
      throw new HttpError(400, "Group name is required");
    }

    const group = await createPromptGroup({ name, description });

    res.status(201).json(group);
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing AI prompt group
 */
export const updateAIPromptGroup = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.admin) {
      throw new HttpError(401, "Admin authentication required");
    }

    const { id } = req.params;
    const { name, description } = req.body;

    if (!id) {
      throw new HttpError(400, "Group ID is required");
    }

    const group = await updatePromptGroup(id, { name, description });

    res.status(200).json(group);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete an AI prompt group
 * Only allows deletion if the group has no prompts
 */
export const deleteAIPromptGroup = async (
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
      throw new HttpError(400, "Group ID is required");
    }

    await deletePromptGroup(id);

    res.status(200).json({ message: "Prompt group deleted successfully" });
  } catch (error) {
    next(error);
  }
};
