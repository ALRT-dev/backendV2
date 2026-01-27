#!/usr/bin/env tsx

import { AdminRole } from "@prisma/client";
import prisma from "../utils/prisma_client.util.js";
import {
  hashAdminPassword,
  validatePasswordStrength,
} from "../services/admin_security.service.js";

/**
 * Script to manage admin accounts
 *
 * Usage:
 *   # Create a new admin
 *   yarn admin create "admin@example.com" "Name" --role admin --password "SecurePass123!" --must-change-password
 *
 *   # Generate random password for new admin
 *   yarn admin create "admin@example.com" "Name" --role admin --generate-password --must-change-password
 *
 *   # List all admins
 *   yarn admin list
 *
 *   # Show admin details
 *   yarn admin show <admin-id-or-email>
 *
 *   # Activate an admin
 *   yarn admin activate <admin-id-or-email>
 *
 *   # Deactivate an admin
 *   yarn admin deactivate <admin-id-or-email>
 *
 *   # Reset password
 *   yarn admin reset-password <admin-id-or-email> --password "NewPass123!" --must-change-password
 *
 *   # Promote admin role
 *   yarn admin promote <admin-id-or-email> --role superAdmin
 *
 *   # Delete an admin (use with caution)
 *   yarn admin delete <admin-id-or-email>
 */

interface CreateOptions {
  role?: AdminRole;
  password?: string;
  generatePassword?: boolean;
  mustChangePassword?: boolean;
}

interface ResetPasswordOptions {
  password?: string;
  generatePassword?: boolean;
  mustChangePassword?: boolean;
}

interface PromoteOptions {
  role: AdminRole;
}

function generateSecurePassword(): string {
  const length = 16;
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const special = "!@#$%^&*";

  // Ensure at least one of each type
  let password = "";
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill the rest randomly
  const allChars = uppercase + lowercase + numbers + special;
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

async function findAdmin(idOrEmail: string) {
  // Try to find by ID first
  let admin = await prisma.admin.findUnique({
    where: { id: idOrEmail },
  });

  // If not found, try by email
  if (!admin) {
    admin = await prisma.admin.findUnique({
      where: { email: idOrEmail },
    });
  }

  return admin;
}

async function createAdmin(
  email: string,
  name: string,
  options: CreateOptions = {}
) {
  try {
    console.log("👤 Creating new admin account...");

    // Check if admin already exists
    const existingAdmin = await prisma.admin.findUnique({
      where: { email },
    });

    if (existingAdmin) {
      console.error(`❌ Admin with email ${email} already exists`);
      process.exit(1);
    }

    // Generate or use provided password
    let password: string;
    if (options.generatePassword) {
      password = generateSecurePassword();
    } else if (options.password) {
      password = options.password;
    } else {
      console.error(
        "❌ Password is required. Use --password or --generate-password"
      );
      process.exit(1);
    }

    // Validate password strength
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

    // Hash password
    const passwordHash = await hashAdminPassword(password);

    // Create admin
    const admin = await prisma.admin.create({
      data: {
        email,
        name,
        passwordHash,
        role: options.role || AdminRole.admin,
        mustChangePassword: options.mustChangePassword || false,
      },
    });

    console.log("✅ Admin account created successfully!");
    console.log("\n📋 Details:");
    console.log(`   ID: ${admin.id}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Name: ${admin.name}`);
    console.log(`   Role: ${admin.role}`);
    console.log(`   Status: ${admin.isActive ? "🟢 Active" : "🔴 Disabled"}`);
    console.log(
      `   Must Change Password: ${admin.mustChangePassword ? "Yes" : "No"}`
    );
    console.log(`   Created: ${admin.createdAt.toISOString()}`);

    if (options.generatePassword) {
      console.log(
        "\n🔐 Generated Password (SAVE THIS - IT WON'T BE SHOWN AGAIN!):"
      );
      console.log(`   ${password}`);
      console.log(
        "\n⚠️  WARNING: Store this password securely and share it with the admin!"
      );
    }

    if (admin.mustChangePassword) {
      console.log(
        "\n📝 Note: Admin will be required to change password on first login"
      );
    }
  } catch (error) {
    console.error("❌ Failed to create admin account:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function listAdmins() {
  try {
    console.log("📋 Listing all admin accounts...\n");

    const admins = await prisma.admin.findMany({
      orderBy: [{ role: "asc" }, { createdAt: "desc" }],
    });

    if (admins.length === 0) {
      console.log("   No admin accounts found");
      return;
    }

    const roleOrder = { superAdmin: 1, admin: 2, moderator: 3 };

    // Group by role
    const groupedAdmins = admins.reduce((acc, admin) => {
      if (!acc[admin.role]) acc[admin.role] = [];
      acc[admin.role]!.push(admin);
      return acc;
    }, {} as Record<string, typeof admins>);

    // Display by role groups
    Object.entries(groupedAdmins)
      .sort(
        ([roleA], [roleB]) =>
          roleOrder[roleA as AdminRole] - roleOrder[roleB as AdminRole]
      )
      .forEach(([role, roleAdmins]) => {
        console.log(`\n🛡️  ${role.toUpperCase()}S (${roleAdmins.length})`);
        console.log("─".repeat(60));

        roleAdmins.forEach((admin, index) => {
          console.log(
            `${index + 1}. ${admin.name || "(No name)"} <${admin.email}>`
          );
          console.log(`   ID: ${admin.id}`);
          console.log(
            `   Status: ${admin.isActive ? "🟢 Active" : "🔴 Disabled"}`
          );
          console.log(
            `   Must Change Password: ${
              admin.mustChangePassword ? "⚠️  Yes" : "No"
            }`
          );
          if (admin.lastLoginAt) {
            console.log(`   Last Login: ${admin.lastLoginAt.toISOString()}`);
          } else {
            console.log("   Last Login: Never");
          }
          console.log(`   Failed Attempts: ${admin.failedLoginAttempts}`);
          if (admin.lockedUntil && admin.lockedUntil > new Date()) {
            console.log(
              `   🔒 Locked Until: ${admin.lockedUntil.toISOString()}`
            );
          }
          console.log(`   Created: ${admin.createdAt.toISOString()}`);
          console.log("");
        });
      });

    const activeCount = admins.filter((a) => a.isActive).length;
    const inactiveCount = admins.filter((a) => !a.isActive).length;
    console.log(
      `\nTotal: ${admins.length} admin${
        admins.length !== 1 ? "s" : ""
      } (${activeCount} active, ${inactiveCount} inactive)`
    );
  } catch (error) {
    console.error("❌ Failed to list admin accounts:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function showAdmin(idOrEmail: string) {
  try {
    console.log("🔍 Fetching admin details...\n");

    const admin = await findAdmin(idOrEmail);

    if (!admin) {
      console.error(`❌ Admin not found: ${idOrEmail}`);
      process.exit(1);
    }

    // Get statistics
    const promptsCreated = await prisma.aIPrompt.count({
      where: { createdById: admin.id },
    });

    const configurationsCreated = await prisma.configuration.count({
      where: { createdById: admin.id },
    });

    const webhookKeysCreated = await prisma.webhookApiKey.count({
      where: { createdById: admin.id },
    });

    console.log("📋 Admin Account Details:");
    console.log(`   ID: ${admin.id}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Name: ${admin.name || "(No name)"}`);
    console.log(`   Role: ${admin.role}`);
    console.log(`   Status: ${admin.isActive ? "🟢 Active" : "🔴 Disabled"}`);

    console.log("\n🔐 Security:");
    console.log(
      `   Must Change Password: ${admin.mustChangePassword ? "⚠️  Yes" : "No"}`
    );
    console.log(`   Failed Login Attempts: ${admin.failedLoginAttempts}`);
    if (admin.lockedUntil && admin.lockedUntil > new Date()) {
      const lockMinutes = Math.ceil(
        (admin.lockedUntil.getTime() - Date.now()) / 60000
      );
      console.log(`   🔒 Account Locked: ${lockMinutes} minutes remaining`);
    } else if (admin.lockedUntil) {
      console.log("   Lock Status: Unlocked");
    }
    console.log(
      `   Password Changed: ${admin.passwordChangedAt.toISOString()}`
    );

    console.log("\n📊 Activity:");
    if (admin.lastLoginAt) {
      console.log(`   Last Login: ${admin.lastLoginAt.toISOString()}`);
    } else {
      console.log("   Last Login: Never");
    }
    console.log(`   Created: ${admin.createdAt.toISOString()}`);
    console.log(`   Updated: ${admin.updatedAt.toISOString()}`);

    console.log("\n📈 Statistics:");
    console.log(`   AI Prompts Created: ${promptsCreated}`);
    console.log(`   Configurations Created: ${configurationsCreated}`);
    console.log(`   Webhook Keys Created: ${webhookKeysCreated}`);
  } catch (error) {
    console.error("❌ Failed to fetch admin details:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function activateAdmin(idOrEmail: string) {
  try {
    console.log(`🔓 Activating admin account...`);

    const admin = await findAdmin(idOrEmail);

    if (!admin) {
      console.error(`❌ Admin not found: ${idOrEmail}`);
      process.exit(1);
    }

    if (admin.isActive) {
      console.log("⚠️  Admin account is already active");
      return;
    }

    await prisma.admin.update({
      where: { id: admin.id },
      data: { isActive: true },
    });

    console.log("✅ Admin account activated successfully!");
    console.log(`   Email: ${admin.email}`);
    console.log(`   Name: ${admin.name}`);
    console.log("   Status: 🟢 Active");
  } catch (error) {
    console.error("❌ Failed to activate admin account:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function deactivateAdmin(idOrEmail: string) {
  try {
    console.log(`🔒 Deactivating admin account...`);

    const admin = await findAdmin(idOrEmail);

    if (!admin) {
      console.error(`❌ Admin not found: ${idOrEmail}`);
      process.exit(1);
    }

    if (!admin.isActive) {
      console.log("⚠️  Admin account is already deactivated");
      return;
    }

    // Prevent deactivating the last super admin
    if (admin.role === AdminRole.superAdmin) {
      const activeSuperAdminCount = await prisma.admin.count({
        where: {
          role: AdminRole.superAdmin,
          isActive: true,
        },
      });

      if (activeSuperAdminCount === 1) {
        console.error("❌ Cannot deactivate the last active super admin");
        process.exit(1);
      }
    }

    await prisma.admin.update({
      where: { id: admin.id },
      data: { isActive: false },
    });

    console.log("✅ Admin account deactivated successfully!");
    console.log(`   Email: ${admin.email}`);
    console.log(`   Name: ${admin.name}`);
    console.log("   Status: 🔴 Disabled");
  } catch (error) {
    console.error("❌ Failed to deactivate admin account:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function resetPassword(
  idOrEmail: string,
  options: ResetPasswordOptions = {}
) {
  try {
    console.log("🔑 Resetting admin password...");

    const admin = await findAdmin(idOrEmail);

    if (!admin) {
      console.error(`❌ Admin not found: ${idOrEmail}`);
      process.exit(1);
    }

    // Generate or use provided password
    let password: string;
    if (options.generatePassword) {
      password = generateSecurePassword();
    } else if (options.password) {
      password = options.password;
    } else {
      console.error(
        "❌ Password is required. Use --password or --generate-password"
      );
      process.exit(1);
    }

    // Validate password strength
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

    // Hash password
    const passwordHash = await hashAdminPassword(password);

    // Update password
    await prisma.admin.update({
      where: { id: admin.id },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
        mustChangePassword: options.mustChangePassword || false,
      },
    });

    console.log("✅ Password reset successfully!");
    console.log(`   Email: ${admin.email}`);
    console.log(`   Name: ${admin.name}`);
    console.log(
      `   Must Change Password: ${options.mustChangePassword ? "Yes" : "No"}`
    );

    if (options.generatePassword) {
      console.log(
        "\n🔐 Generated Password (SAVE THIS - IT WON'T BE SHOWN AGAIN!):"
      );
      console.log(`   ${password}`);
      console.log(
        "\n⚠️  WARNING: Store this password securely and share it with the admin!"
      );
    }
  } catch (error) {
    console.error("❌ Failed to reset password:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function promoteAdmin(idOrEmail: string, options: PromoteOptions) {
  try {
    console.log("⬆️  Promoting admin...");

    const admin = await findAdmin(idOrEmail);

    if (!admin) {
      console.error(`❌ Admin not found: ${idOrEmail}`);
      process.exit(1);
    }

    if (admin.role === options.role) {
      console.log(`⚠️  Admin already has role: ${options.role}`);
      return;
    }

    // Warn about demotion from superAdmin
    if (admin.role === AdminRole.superAdmin) {
      const activeSuperAdminCount = await prisma.admin.count({
        where: {
          role: AdminRole.superAdmin,
          isActive: true,
        },
      });

      if (activeSuperAdminCount === 1) {
        console.error("❌ Cannot demote the last active super admin");
        process.exit(1);
      }
    }

    await prisma.admin.update({
      where: { id: admin.id },
      data: { role: options.role },
    });

    console.log("✅ Admin role updated successfully!");
    console.log(`   Email: ${admin.email}`);
    console.log(`   Name: ${admin.name}`);
    console.log(`   Old Role: ${admin.role}`);
    console.log(`   New Role: ${options.role}`);
  } catch (error) {
    console.error("❌ Failed to update admin role:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function deleteAdmin(idOrEmail: string) {
  try {
    console.log("🗑️  Deleting admin account...");

    const admin = await findAdmin(idOrEmail);

    if (!admin) {
      console.error(`❌ Admin not found: ${idOrEmail}`);
      process.exit(1);
    }

    // Prevent deleting the last super admin
    if (admin.role === AdminRole.superAdmin) {
      const superAdminCount = await prisma.admin.count({
        where: { role: AdminRole.superAdmin },
      });

      if (superAdminCount === 1) {
        console.error("❌ Cannot delete the last super admin");
        process.exit(1);
      }
    }

    console.log("\n⚠️  You are about to DELETE:");
    console.log(`   Email: ${admin.email}`);
    console.log(`   Name: ${admin.name}`);
    console.log(`   Role: ${admin.role}`);
    console.log("\n   This action CANNOT be undone!");
    console.log(
      "   All related data (prompts, configs) will have createdBy/updatedBy orphaned."
    );

    await prisma.admin.delete({
      where: { id: admin.id },
    });

    console.log("\n✅ Admin account deleted successfully!");
  } catch (error) {
    console.error("❌ Failed to delete admin account:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function unlockAdmin(idOrEmail: string) {
  try {
    console.log("🔓 Unlocking admin account...");

    const admin = await findAdmin(idOrEmail);

    if (!admin) {
      console.error(`❌ Admin not found: ${idOrEmail}`);
      process.exit(1);
    }

    if (!admin.lockedUntil || admin.lockedUntil < new Date()) {
      console.log("⚠️  Admin account is not locked");
      return;
    }

    await prisma.admin.update({
      where: { id: admin.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    console.log("✅ Admin account unlocked successfully!");
    console.log(`   Email: ${admin.email}`);
    console.log(`   Name: ${admin.name}`);
  } catch (error) {
    console.error("❌ Failed to unlock admin account:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log("Usage:");
    console.log(
      "  yarn admin create <email> <name> --role <role> --password <pass> OR --generate-password [--must-change-password]"
    );
    console.log("  yarn admin list");
    console.log("  yarn admin show <admin-id-or-email>");
    console.log("  yarn admin activate <admin-id-or-email>");
    console.log("  yarn admin deactivate <admin-id-or-email>");
    console.log(
      "  yarn admin reset-password <admin-id-or-email> --password <pass> OR --generate-password [--must-change-password]"
    );
    console.log("  yarn admin promote <admin-id-or-email> --role <role>");
    console.log("  yarn admin delete <admin-id-or-email>");
    console.log("  yarn admin unlock <admin-id-or-email>");
    console.log("\nRoles:");
    console.log("  superAdmin, admin, moderator");
    console.log("\nExamples:");
    console.log(
      '  yarn admin create "admin@example.com" "John Doe" --role admin --generate-password --must-change-password'
    );
    console.log(
      '  yarn admin create "mod@example.com" "Jane" --role moderator --password "SecurePass123!"'
    );
    console.log(
      '  yarn admin reset-password "admin@example.com" --generate-password --must-change-password'
    );
    console.log('  yarn admin promote "admin@example.com" --role superAdmin');
    console.log("  yarn admin list");
    process.exit(0);
  }

  switch (command.toLowerCase()) {
    case "create": {
      const email = args[1];
      const name = args[2];

      if (!email || !name) {
        console.error("❌ Email and name are required for create command");
        console.log(
          "Usage: yarn admin create <email> <name> --role <role> --password <pass> OR --generate-password"
        );
        process.exit(1);
      }

      const options: CreateOptions = {};

      for (let i = 3; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--role" && args[i + 1]) {
          const roleValue = args[++i] as AdminRole;
          if (!["superAdmin", "admin", "moderator"].includes(roleValue)) {
            console.error(`❌ Invalid role: ${roleValue}`);
            process.exit(1);
          }
          options.role = roleValue;
        } else if (arg === "--password" && args[i + 1]) {
          const passwordValue = args[++i];
          if (passwordValue) options.password = passwordValue;
        } else if (arg === "--generate-password") {
          options.generatePassword = true;
        } else if (arg === "--must-change-password") {
          options.mustChangePassword = true;
        }
      }

      await createAdmin(email, name, options);
      break;
    }

    case "list": {
      await listAdmins();
      break;
    }

    case "show": {
      const idOrEmail = args[1];
      if (!idOrEmail) {
        console.error("❌ Admin ID or email is required for show command");
        console.log("Usage: yarn admin show <admin-id-or-email>");
        process.exit(1);
      }
      await showAdmin(idOrEmail);
      break;
    }

    case "activate": {
      const idOrEmail = args[1];
      if (!idOrEmail) {
        console.error("❌ Admin ID or email is required for activate command");
        console.log("Usage: yarn admin activate <admin-id-or-email>");
        process.exit(1);
      }
      await activateAdmin(idOrEmail);
      break;
    }

    case "deactivate": {
      const idOrEmail = args[1];
      if (!idOrEmail) {
        console.error(
          "❌ Admin ID or email is required for deactivate command"
        );
        console.log("Usage: yarn admin deactivate <admin-id-or-email>");
        process.exit(1);
      }
      await deactivateAdmin(idOrEmail);
      break;
    }

    case "reset-password": {
      const idOrEmail = args[1];
      if (!idOrEmail) {
        console.error(
          "❌ Admin ID or email is required for reset-password command"
        );
        console.log(
          "Usage: yarn admin reset-password <admin-id-or-email> --password <pass> OR --generate-password"
        );
        process.exit(1);
      }

      const options: ResetPasswordOptions = {};

      for (let i = 2; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--password" && args[i + 1]) {
          const passwordValue = args[++i];
          if (passwordValue) options.password = passwordValue;
        } else if (arg === "--generate-password") {
          options.generatePassword = true;
        } else if (arg === "--must-change-password") {
          options.mustChangePassword = true;
        }
      }

      await resetPassword(idOrEmail, options);
      break;
    }

    case "promote": {
      const idOrEmail = args[1];
      if (!idOrEmail) {
        console.error("❌ Admin ID or email is required for promote command");
        console.log(
          "Usage: yarn admin promote <admin-id-or-email> --role <role>"
        );
        process.exit(1);
      }

      let role: AdminRole | undefined;

      for (let i = 2; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--role" && args[i + 1]) {
          const roleValue = args[++i] as AdminRole;
          if (!["superAdmin", "admin", "moderator"].includes(roleValue)) {
            console.error(`❌ Invalid role: ${roleValue}`);
            process.exit(1);
          }
          role = roleValue;
        }
      }

      if (!role) {
        console.error("❌ Role is required for promote command");
        console.log(
          "Usage: yarn admin promote <admin-id-or-email> --role <role>"
        );
        process.exit(1);
      }

      await promoteAdmin(idOrEmail, { role });
      break;
    }

    case "delete": {
      const idOrEmail = args[1];
      if (!idOrEmail) {
        console.error("❌ Admin ID or email is required for delete command");
        console.log("Usage: yarn admin delete <admin-id-or-email>");
        process.exit(1);
      }
      await deleteAdmin(idOrEmail);
      break;
    }

    case "unlock": {
      const idOrEmail = args[1];
      if (!idOrEmail) {
        console.error("❌ Admin ID or email is required for unlock command");
        console.log("Usage: yarn admin unlock <admin-id-or-email>");
        process.exit(1);
      }
      await unlockAdmin(idOrEmail);
      break;
    }

    default:
      console.error(`❌ Unknown command: ${command}`);
      console.log(
        "Available commands: create, list, show, activate, deactivate, reset-password, promote, delete, unlock"
      );
      process.exit(1);
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("❌ Unexpected error:");
  console.error(error);
  process.exit(1);
});
