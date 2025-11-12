#!/usr/bin/env tsx

import { AdminRole } from "@prisma/client";
import { validatePasswordStrength } from "../services/admin_security.service.js";
import { createAdminAccount } from "../services/user.admin.service.js";
import { config } from "../utils/config.js";

const createSuperAdmin = async () => {
  try {
    const email = config.adminCredentials.superAdminEmail;
    const password = config.adminCredentials.superAdminPassword;
    const name = config.adminCredentials.superAdminName;

    if (!validatePasswordStrength(password)) {
      console.error("❌ Password does not meet security requirements:");
      console.error("   - At least 12 characters");
      console.error("   - At least one uppercase letter");
      console.error("   - At least one lowercase letter");
      console.error("   - At least one number");
      console.error(
        '   - At least one special character (!@#$%^&*(),.?":{}|<>)'
      );
      process.exit(1);
    }

    const adminData = {
      email,
      password,
      name,
      role: AdminRole.SUPER_ADMIN,
    };

    console.log("🚀 Creating super admin account...");
    const admin = await createAdminAccount(adminData);

    console.log("✅ Super admin account created successfully!");
    console.log("📧 Email:", admin.email);
    console.log("👤 Name:", admin.name);
    console.log("🛡️  Role:", admin.role);
    console.log("📅 Created:", admin.createdAt.toISOString());

    console.log("\n🔐 You can now login with these credentials:");
    console.log(`Email: ${admin.email}`);
    console.log("Password: [REDACTED]");
  } catch (error) {
    console.error("❌ Failed to create super admin account:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
};

createSuperAdmin();
