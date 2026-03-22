#!/usr/bin/env tsx

import bcrypt from "bcrypt";
import crypto from "crypto";
import prisma from "../utils/prisma_client.util.js";
import { emitCliSecret, maskEmail } from "../utils/log_sanitize.util.js";

/**
 * Script to manage webhook API keys
 *
 * Usage:
 *   # Create a new API key
 *   yarn webhook-key create "Client Name" --description "Optional description" --expire-days 365
 *
 *   # Disable an API key
 *   yarn webhook-key disable <key-id>
 *
 *   # Enable an API key
 *   yarn webhook-key enable <key-id>
 *
 *   # List all API keys
 *   yarn webhook-key list
 *
 *   # Delete an API key
 *   yarn webhook-key delete <key-id>
 *
 *   # Show API key details
 *   yarn webhook-key show <key-id>
 *
 *   # Update rate limits
 *   yarn webhook-key update <key-id> --max-per-minute 20 --max-per-hour 200 --max-per-day 2000
 *
 * Secrets: set WEBHOOK_KEY_OUTPUT_FILE=/secure/path when creating a key in CI/non-TTY
 * so the raw key is not written to captured stdout (log aggregators).
 */

interface CreateOptions {
  description?: string;
  maxRequestsPerMinute?: number;
  maxRequestsPerHour?: number;
  maxRequestsPerDay?: number;
  expireDays?: number;
}

interface UpdateOptions {
  maxRequestsPerMinute?: number;
  maxRequestsPerHour?: number;
  maxRequestsPerDay?: number;
}

async function createApiKey(name: string, options: CreateOptions = {}) {
  try {
    console.log("🔑 Creating new webhook API key...");

    // Generate a secure random API key
    const apiKey = `whk_${crypto.randomBytes(32).toString("base64url")}`;

    // Hash the API key for storage
    const keyHash = await bcrypt.hash(apiKey, 10);

    // Calculate expiration date if specified
    let expiresAt: Date | undefined;
    if (options.expireDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + options.expireDays);
    }

    // Create in database
    const createdKey = await prisma.webhookApiKey.create({
      data: {
        name,
        ...(options.description && { description: options.description }),
        keyHash,
        maxRequestsPerMinute: options.maxRequestsPerMinute || 10,
        maxRequestsPerHour: options.maxRequestsPerHour || 100,
        maxRequestsPerDay: options.maxRequestsPerDay || 1000,
        ...(expiresAt && { expiresAt }),
      },
    });

    console.log("✅ API key created successfully!");
    console.log("\n📋 Details:");
    console.log(`   ID: ${createdKey.id}`);
    console.log(`   Name: ${createdKey.name}`);
    if (createdKey.description) {
      console.log(`   Description: ${createdKey.description}`);
    }
    console.log(
      `   Status: ${createdKey.isActive ? "🟢 Active" : "🔴 Disabled"}`,
    );
    console.log(`   Created: ${createdKey.createdAt.toISOString()}`);
    if (createdKey.expiresAt) {
      console.log(`   Expires: ${createdKey.expiresAt.toISOString()}`);
    }
    console.log("\n🔢 Rate Limits:");
    console.log(`   Per Minute: ${createdKey.maxRequestsPerMinute}`);
    console.log(`   Per Hour: ${createdKey.maxRequestsPerHour}`);
    console.log(`   Per Day: ${createdKey.maxRequestsPerDay}`);
    console.log(
      "\n🔐 API key (one-time): use file or interactive terminal — not logged in full.",
    );
    if (emitCliSecret(apiKey, "WEBHOOK_KEY_OUTPUT_FILE") === "exit") {
      process.exit(1);
    }
    console.log(
      "\n⚠️  Store this key in a vault. It cannot be retrieved from the API later.",
    );
  } catch (error) {
    console.error("❌ Failed to create API key:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function disableApiKey(keyId: string) {
  try {
    console.log(`🔒 Disabling API key ${keyId}...`);

    const key = await prisma.webhookApiKey.findUnique({
      where: { id: keyId },
    });

    if (!key) {
      console.error(`❌ API key not found: ${keyId}`);
      process.exit(1);
    }

    if (!key.isActive) {
      console.log("⚠️  API key is already disabled");
      return;
    }

    await prisma.webhookApiKey.update({
      where: { id: keyId },
      data: { isActive: false },
    });

    console.log("✅ API key disabled successfully!");
    console.log(`   Name: ${key.name}`);
    console.log("   Status: 🔴 Disabled");
  } catch (error) {
    console.error("❌ Failed to disable API key:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function enableApiKey(keyId: string) {
  try {
    console.log(`🔓 Enabling API key ${keyId}...`);

    const key = await prisma.webhookApiKey.findUnique({
      where: { id: keyId },
    });

    if (!key) {
      console.error(`❌ API key not found: ${keyId}`);
      process.exit(1);
    }

    if (key.isActive) {
      console.log("⚠️  API key is already enabled");
      return;
    }

    await prisma.webhookApiKey.update({
      where: { id: keyId },
      data: { isActive: true },
    });

    console.log("✅ API key enabled successfully!");
    console.log(`   Name: ${key.name}`);
    console.log("   Status: 🟢 Active");
  } catch (error) {
    console.error("❌ Failed to enable API key:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function listApiKeys() {
  try {
    console.log("📋 Listing all webhook API keys...\n");

    const keys = await prisma.webhookApiKey.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (keys.length === 0) {
      console.log("   No API keys found");
      return;
    }

    keys.forEach((key, index) => {
      console.log(`${index + 1}. ${key.name}`);
      console.log(`   ID: ${key.id}`);
      if (key.description) {
        console.log(`   Description: ${key.description}`);
      }
      console.log(`   Status: ${key.isActive ? "🟢 Active" : "🔴 Disabled"}`);
      console.log(`   Requests: ${key.totalRequests.toLocaleString()}`);
      if (key.lastUsedAt) {
        console.log(`   Last Used: ${key.lastUsedAt.toISOString()}`);
        if (key.lastUsedIp) {
          console.log(`   Last IP: ${key.lastUsedIp}`);
        }
      } else {
        console.log("   Last Used: Never");
      }
      console.log(
        `   Rate Limits: ${key.maxRequestsPerMinute}/min, ${key.maxRequestsPerHour}/hr, ${key.maxRequestsPerDay}/day`,
      );
      console.log(`   Created: ${key.createdAt.toISOString()}`);
      if (key.createdBy) {
        console.log(
          `   Created By: ${key.createdBy.name} (${maskEmail(key.createdBy.email)})`,
        );
      }
      if (key.expiresAt) {
        const isExpired = key.expiresAt < new Date();
        console.log(
          `   Expires: ${key.expiresAt.toISOString()} ${
            isExpired ? "⚠️ EXPIRED" : ""
          }`,
        );
      }
      console.log("");
    });

    console.log(`Total: ${keys.length} API key${keys.length !== 1 ? "s" : ""}`);
  } catch (error) {
    console.error("❌ Failed to list API keys:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function deleteApiKey(keyId: string) {
  try {
    console.log(`🗑️  Deleting API key ${keyId}...`);

    const key = await prisma.webhookApiKey.findUnique({
      where: { id: keyId },
    });

    if (!key) {
      console.error(`❌ API key not found: ${keyId}`);
      process.exit(1);
    }

    // Confirm deletion
    console.log(`\n⚠️  You are about to delete:`);
    console.log(`   Name: ${key.name}`);
    console.log(`   Total Requests: ${key.totalRequests.toLocaleString()}`);
    console.log(`\n   This action CANNOT be undone!`);
    console.log(`   Logs will be preserved but orphaned.`);

    await prisma.webhookApiKey.delete({
      where: { id: keyId },
    });

    console.log("\n✅ API key deleted successfully!");
  } catch (error) {
    console.error("❌ Failed to delete API key:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function updateRateLimits(keyId: string, options: UpdateOptions) {
  try {
    console.log(`⚙️  Updating rate limits for API key ${keyId}...`);

    const key = await prisma.webhookApiKey.findUnique({
      where: { id: keyId },
    });

    if (!key) {
      console.error(`❌ API key not found: ${keyId}`);
      process.exit(1);
    }

    // Check if any options were provided
    if (
      options.maxRequestsPerMinute === undefined &&
      options.maxRequestsPerHour === undefined &&
      options.maxRequestsPerDay === undefined
    ) {
      console.error("❌ No rate limit parameters provided to update");
      console.log("   Use --max-per-minute, --max-per-hour, or --max-per-day");
      process.exit(1);
    }

    // Build update data object with only provided values
    const updateData: any = {};
    if (options.maxRequestsPerMinute !== undefined) {
      updateData.maxRequestsPerMinute = options.maxRequestsPerMinute;
    }
    if (options.maxRequestsPerHour !== undefined) {
      updateData.maxRequestsPerHour = options.maxRequestsPerHour;
    }
    if (options.maxRequestsPerDay !== undefined) {
      updateData.maxRequestsPerDay = options.maxRequestsPerDay;
    }

    const updatedKey = await prisma.webhookApiKey.update({
      where: { id: keyId },
      data: updateData,
    });

    console.log("✅ Rate limits updated successfully!");
    console.log(`   Name: ${updatedKey.name}`);
    console.log("\n🔢 New Rate Limits:");
    console.log(`   Per Minute: ${updatedKey.maxRequestsPerMinute}`);
    console.log(`   Per Hour: ${updatedKey.maxRequestsPerHour}`);
    console.log(`   Per Day: ${updatedKey.maxRequestsPerDay}`);
  } catch (error) {
    console.error("❌ Failed to update rate limits:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function showApiKey(keyId: string) {
  try {
    console.log(`🔍 Fetching API key details...\n`);

    const key = await prisma.webhookApiKey.findUnique({
      where: { id: keyId },
      include: {
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!key) {
      console.error(`❌ API key not found: ${keyId}`);
      process.exit(1);
    }

    // Get recent stats
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentRequests = await prisma.webhookLog.count({
      where: {
        apiKeyId: keyId,
        createdAt: { gte: last24Hours },
      },
    });

    const recentFailures = await prisma.webhookLog.count({
      where: {
        apiKeyId: keyId,
        success: false,
        createdAt: { gte: last24Hours },
      },
    });

    const successRate =
      recentRequests > 0
        ? (((recentRequests - recentFailures) / recentRequests) * 100).toFixed(
            2,
          )
        : "N/A";

    console.log("📋 API Key Details:");
    console.log(`   ID: ${key.id}`);
    console.log(`   Name: ${key.name}`);
    if (key.description) {
      console.log(`   Description: ${key.description}`);
    }
    console.log(`   Status: ${key.isActive ? "🟢 Active" : "🔴 Disabled"}`);
    console.log(`   Created: ${key.createdAt.toISOString()}`);
    if (key.createdBy) {
      console.log(
        `   Created By: ${key.createdBy.name} (${maskEmail(key.createdBy.email)})`,
      );
    }
    if (key.expiresAt) {
      const isExpired = key.expiresAt < new Date();
      console.log(
        `   Expires: ${key.expiresAt.toISOString()} ${
          isExpired ? "⚠️ EXPIRED" : ""
        }`,
      );
    }

    console.log("\n🔢 Rate Limits:");
    console.log(`   Per Minute: ${key.maxRequestsPerMinute}`);
    console.log(`   Per Hour: ${key.maxRequestsPerHour}`);
    console.log(`   Per Day: ${key.maxRequestsPerDay}`);

    console.log("\n📊 Usage Statistics:");
    console.log(`   Total Requests: ${key.totalRequests.toLocaleString()}`);
    console.log(
      `   Last 24 Hours: ${recentRequests.toLocaleString()} requests`,
    );
    console.log(`   Last 24h Failures: ${recentFailures.toLocaleString()}`);
    console.log(`   Last 24h Success Rate: ${successRate}%`);

    if (key.lastUsedAt) {
      console.log(`   Last Used: ${key.lastUsedAt.toISOString()}`);
      if (key.lastUsedIp) {
        console.log(`   Last IP: ${key.lastUsedIp}`);
      }
    } else {
      console.log("   Last Used: Never");
    }

    // Get recent logs
    const recentLogs = await prisma.webhookLog.findMany({
      where: { apiKeyId: keyId },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    if (recentLogs.length > 0) {
      console.log("\n📝 Recent Activity (last 5):");
      recentLogs.forEach((log, index) => {
        const statusIcon = log.success ? "✅" : "❌";
        console.log(
          `   ${index + 1}. ${statusIcon} ${
            log.statusCode
          } - ${log.createdAt.toISOString()}`,
        );
        console.log(`      IP: ${log.clientIp}`);
        if (log.reason) {
          console.log(`      Reason: ${log.reason}`);
        }
        if (log.responseTime) {
          console.log(`      Response Time: ${log.responseTime}ms`);
        }
      });
    }
  } catch (error) {
    console.error("❌ Failed to fetch API key details:");
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
      '  yarn tsx src/scripts/webhook-api-key.ts create "Client Name" [options]',
    );
    console.log("  yarn tsx src/scripts/webhook-api-key.ts disable <key-id>");
    console.log("  yarn tsx src/scripts/webhook-api-key.ts enable <key-id>");
    console.log("  yarn tsx src/scripts/webhook-api-key.ts list");
    console.log("  yarn tsx src/scripts/webhook-api-key.ts delete <key-id>");
    console.log("  yarn tsx src/scripts/webhook-api-key.ts show <key-id>");
    console.log(
      "  yarn tsx src/scripts/webhook-api-key.ts update <key-id> [options]",
    );
    console.log("\nOptions for create:");
    console.log("  --description <text>           Description of the API key");
    console.log(
      "  --max-per-minute <number>      Max requests per minute (default: 10)",
    );
    console.log(
      "  --max-per-hour <number>        Max requests per hour (default: 100)",
    );
    console.log(
      "  --max-per-day <number>         Max requests per day (default: 1000)",
    );
    console.log("  --expire-days <number>         Expire after N days");
    console.log("\nOptions for update:");
    console.log("  --max-per-minute <number>      New max requests per minute");
    console.log("  --max-per-hour <number>        New max requests per hour");
    console.log("  --max-per-day <number>         New max requests per day");
    console.log("\nExamples:");
    console.log(
      '  yarn tsx src/scripts/webhook-api-key.ts create "Client A" --description "N8N automation" --expire-days 365',
    );
    console.log(
      '  yarn tsx src/scripts/webhook-api-key.ts create "Premium Client" --max-per-day 5000',
    );
    console.log(
      "  yarn tsx src/scripts/webhook-api-key.ts disable abc-123-def",
    );
    console.log("  yarn tsx src/scripts/webhook-api-key.ts list");
    console.log(
      "  yarn tsx src/scripts/webhook-api-key.ts update abc-123-def --max-per-day 5000",
    );
    process.exit(0);
  }

  switch (command.toLowerCase()) {
    case "create": {
      const name = args[1];
      if (!name) {
        console.error("❌ Name is required for create command");
        console.log(
          'Usage: yarn tsx src/scripts/webhook-api-key.ts create "Client Name" [options]',
        );
        process.exit(1);
      }

      const options: CreateOptions = {};

      for (let i = 2; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--description" && args[i + 1]) {
          const value = args[++i];
          if (value !== undefined) {
            options.description = value;
          }
        } else if (arg === "--max-per-minute" && args[i + 1]) {
          const value = args[++i];
          if (value !== undefined) {
            options.maxRequestsPerMinute = parseInt(value, 10);
          }
        } else if (arg === "--max-per-hour" && args[i + 1]) {
          const value = args[++i];
          if (value !== undefined) {
            options.maxRequestsPerHour = parseInt(value, 10);
          }
        } else if (arg === "--max-per-day" && args[i + 1]) {
          const value = args[++i];
          if (value !== undefined) {
            options.maxRequestsPerDay = parseInt(value, 10);
          }
        } else if (arg === "--expire-days" && args[i + 1]) {
          const value = args[++i];
          if (value !== undefined) {
            options.expireDays = parseInt(value, 10);
          }
        }
      }

      await createApiKey(name, options);
      break;
    }

    case "disable": {
      const keyId = args[1];
      if (!keyId) {
        console.error("❌ Key ID is required for disable command");
        console.log(
          "Usage: yarn tsx src/scripts/webhook-api-key.ts disable <key-id>",
        );
        process.exit(1);
      }
      await disableApiKey(keyId);
      break;
    }

    case "enable": {
      const keyId = args[1];
      if (!keyId) {
        console.error("❌ Key ID is required for enable command");
        console.log(
          "Usage: yarn tsx src/scripts/webhook-api-key.ts enable <key-id>",
        );
        process.exit(1);
      }
      await enableApiKey(keyId);
      break;
    }

    case "list": {
      await listApiKeys();
      break;
    }

    case "delete": {
      const keyId = args[1];
      if (!keyId) {
        console.error("❌ Key ID is required for delete command");
        console.log(
          "Usage: yarn tsx src/scripts/webhook-api-key.ts delete <key-id>",
        );
        process.exit(1);
      }
      await deleteApiKey(keyId);
      break;
    }

    case "show": {
      const keyId = args[1];
      if (!keyId) {
        console.error("❌ Key ID is required for show command");
        console.log(
          "Usage: yarn tsx src/scripts/webhook-api-key.ts show <key-id>",
        );
        process.exit(1);
      }
      await showApiKey(keyId);
      break;
    }

    case "update": {
      const keyId = args[1];
      if (!keyId) {
        console.error("❌ Key ID is required for update command");
        console.log(
          "Usage: yarn tsx src/scripts/webhook-api-key.ts update <key-id> [options]",
        );
        process.exit(1);
      }

      const options: UpdateOptions = {};

      for (let i = 2; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--max-per-minute" && args[i + 1]) {
          const value = args[++i];
          if (value !== undefined) {
            options.maxRequestsPerMinute = parseInt(value, 10);
          }
        } else if (arg === "--max-per-hour" && args[i + 1]) {
          const value = args[++i];
          if (value !== undefined) {
            options.maxRequestsPerHour = parseInt(value, 10);
          }
        } else if (arg === "--max-per-day" && args[i + 1]) {
          const value = args[++i];
          if (value !== undefined) {
            options.maxRequestsPerDay = parseInt(value, 10);
          }
        }
      }

      await updateRateLimits(keyId, options);
      break;
    }

    default:
      console.error(`❌ Unknown command: ${command}`);
      console.log(
        "Available commands: create, disable, enable, list, delete, show, update",
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
