import type { NextFunction, Response } from "express";
import type { AdminRequest } from "../../middlewares/auth.admin.middleware.js";
import { HttpError } from "../../models/http_error.js";
import {
  cancelAppUserDeletion,
  getAppUser,
  listAdmins,
  listAppUsers,
  requestAppUserDeletion,
  setAdminActive,
  updateAppUser,
} from "../../services/app_user.admin.service.js";

const parseIntOrUndefined = (value: unknown): number | undefined => {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const listAppUsersController = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await listAppUsers({
      search:
        typeof req.query.search === "string" ? req.query.search : undefined,
      page: parseIntOrUndefined(req.query.page),
      pageSize: parseIntOrUndefined(req.query.pageSize),
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getAppUserController = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = await getAppUser(req.params.userId as string);
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

export const updateAppUserController = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { name, locationName, ownLocationSubscriptionRadiusKm } = req.body as {
      name?: string | null;
      locationName?: string | null;
      ownLocationSubscriptionRadiusKm?: number;
    };

    if (
      ownLocationSubscriptionRadiusKm !== undefined &&
      (!Number.isFinite(ownLocationSubscriptionRadiusKm) ||
        ownLocationSubscriptionRadiusKm < 1 ||
        ownLocationSubscriptionRadiusKm > 500)
    ) {
      throw new HttpError(400, "Radius must be between 1 and 500 km");
    }

    const user = await updateAppUser(req.params.userId as string, {
      name,
      locationName,
      ownLocationSubscriptionRadiusKm,
    });

    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

export const deleteAppUserController = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = await requestAppUserDeletion(req.params.userId as string);
    res.status(200).json({
      success: true,
      message: "User scheduled for deletion",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const restoreAppUserController = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = await cancelAppUserDeletion(req.params.userId as string);
    res.status(200).json({
      success: true,
      message: "Scheduled deletion cancelled",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const listAdminsController = async (
  _req: AdminRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const admins = await listAdmins();
    res.status(200).json(admins);
  } catch (error) {
    next(error);
  }
};

export const setAdminActiveController = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.params.adminId as string;
    const { isActive } = req.body as { isActive?: boolean };

    if (typeof isActive !== "boolean") {
      throw new HttpError(400, "isActive must be a boolean");
    }

    // Guard against an admin locking themselves out of the console.
    if (req.admin?.id === adminId && isActive === false) {
      throw new HttpError(400, "You cannot deactivate your own account");
    }

    const admin = await setAdminActive(adminId, isActive);
    res.status(200).json({ success: true, data: admin });
  } catch (error) {
    next(error);
  }
};
