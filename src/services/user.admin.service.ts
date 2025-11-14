import { AdminRole } from "@prisma/client";
import { HttpError } from "../models/http_error.js";
import prisma from "../utils/prisma_client.util.js";
import type { CreateAdminBody } from "../validators/admin/user.validator.js";
import { hashAdminPassword } from "./admin_security.service.js";
import { config } from "../utils/config.js";

export const getAdminProfile = async (adminId: string) => {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!admin) {
      throw new HttpError(404, "Admin not found");
    }

    return admin;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(500, "Failed to fetch admin profile");
  }
};

export const createAdminAccount = async (data: CreateAdminBody) => {
  try {
    // Check if admin already exists
    const existingAdmin = await prisma.admin.findUnique({
      where: { email: data.email },
      select: { id: true },
    });

    if (existingAdmin) {
      throw new HttpError(400, "Admin account with this email already exists");
    }

    // Hash password
    const passwordHash = await hashAdminPassword(data.password);

    // Create admin
    const admin = await prisma.admin.create({
      data: {
        email: data.email,
        passwordHash,
        ...(data.name && { name: data.name }),
        role: data.role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return admin;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(500, "Failed to create admin account");
  }
};

export const deactivateAdmin = async (adminId: string) => {
  try {
    await prisma.admin.update({
      where: { id: adminId },
      data: { isActive: false },
    });

    return { success: true };
  } catch (error) {
    throw new HttpError(500, "Failed to deactivate admin");
  }
};

/**
 * Activates the super admin account if none exists.
 */
export const activateSuperAdmin = async () => {
  try {
    const isAnySuperAdminActive = await prisma.admin.count({
      where: { role: AdminRole.superAdmin, isActive: true },
    });
    if (isAnySuperAdminActive > 0) {
      return;
    }

    const admin = await createAdminAccount({
      email: config.adminCredentials.superAdminEmail,
      password: config.adminCredentials.superAdminPassword,
      name: config.adminCredentials.superAdminName,
      role: AdminRole.superAdmin,
    });

    console.log("✅ Super admin account activated successfully!");
    console.log("📧 Email:", admin.email);
    console.log("👤 Name:", admin.name);
    console.log("🛡️  Role:", admin.role);
    console.log("📅 Created:", admin.createdAt.toISOString());
  } catch (error) {
    throw new HttpError(500, "Failed to activate super admin");
  }
};
