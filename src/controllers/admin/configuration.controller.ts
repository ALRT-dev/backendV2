import type { NextFunction, Request, Response } from "express";
import {
  createConfiguration as createConfigService,
  updateConfiguration as updateConfigService,
  getAllConfigurations as getAllConfigsService,
  getConfigurationById as getConfigByIdService,
  deleteConfiguration as deleteConfigService,
  validateConfigurationValue,
  type CreateConfigurationData,
  type UpdateConfigurationData,
} from "../../services/configuration.service.js";
import { HttpError } from "../../models/http_error.js";
import type { AdminRequest } from "../../middlewares/auth.admin.middleware.js";

/**
 * Get all configurations with pagination
 */
export const getAllConfigurations = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await getAllConfigsService();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get a specific configuration by ID
 */
export const getConfigurationById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new HttpError(400, "Configuration ID is required");
    }

    const configuration = await getConfigByIdService(id);

    if (!configuration) {
      throw new HttpError(404, "Configuration not found");
    }

    res.status(200).json(configuration);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new configuration
 */
export const createConfiguration = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.admin) {
      throw new HttpError(401, "Admin authentication required");
    }

    const { key, value, title, description } = req.body;

    // Validate JSON value
    const isValidValue = await validateConfigurationValue(value);
    if (!isValidValue) {
      throw new HttpError(400, "Invalid JSON value provided");
    }

    const configurationData: CreateConfigurationData = {
      key,
      value,
      title,
      description,
    };

    const newConfiguration = await createConfigService(
      configurationData,
      req.admin.id
    );

    res.status(201).json(newConfiguration);
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing configuration
 */
export const updateConfiguration = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.admin) {
      throw new HttpError(401, "Admin authentication required");
    }
    const adminId = req.admin.id;

    const { id } = req.params;
    const { value, title, description } = req.body;

    if (!id) {
      throw new HttpError(400, "Configuration ID is required");
    }

    // Validate JSON value if provided
    if (value !== undefined) {
      const isValidValue = await validateConfigurationValue(value);
      if (!isValidValue) {
        throw new HttpError(400, "Invalid JSON value provided");
      }
    }

    const updateData: UpdateConfigurationData = {
      ...(value !== undefined && { value }),
      ...(title && { title }),
      ...(description !== undefined && { description }),
    };

    const updatedConfiguration = await updateConfigService(
      id,
      updateData,
      adminId
    );

    res.status(200).json(updatedConfiguration);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a configuration
 */
export const deleteConfiguration = async (
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
      throw new HttpError(400, "Configuration ID is required");
    }

    await deleteConfigService(id);

    res.status(200).json({ message: "Configuration deleted successfully" });
  } catch (error) {
    next(error);
  }
};
