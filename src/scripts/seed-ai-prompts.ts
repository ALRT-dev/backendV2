/**
 * Seeds the repo-versioned alert prompts into the AIPrompt table and wires
 * the aiPrompts Configuration to point at them.
 *
 * Usage: npm run seed:prompts   (needs DATABASE_URL, like any prisma script)
 *
 * Safe to re-run: prompts are upserted by their unique name, so edits made
 * in the repo replace what is in the database, and the Configuration is
 * MERGED - category- and source-specific prompt groups added through the
 * admin panel (e.g. airQualityAlertCategoryPromptId) are preserved, only
 * the three core groups are (re)pointed at the seeded prompts.
 */
import crypto from "crypto";

import prisma from "../utils/prisma_client.util.js";
import {
  CONFIG_GROUPS,
  SEED_PROMPTS,
} from "../prompts/alert_summarization_prompts.js";

const SEED_ADMIN_EMAIL = "system+prompts@safetyalrt.com";

const findOrCreateSeedAdmin = async (): Promise<string> => {
  const existing = await prisma.admin.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (existing) return existing.id;

  // Fresh database: create a disabled system admin to own the rows. The
  // random hash can never be logged in with; a real admin is still made
  // through create-super-admin.
  const system = await prisma.admin.create({
    data: {
      email: SEED_ADMIN_EMAIL,
      passwordHash: crypto.randomBytes(32).toString("hex"),
      name: "System (prompt seeder)",
      isActive: false,
    },
    select: { id: true },
  });
  return system.id;
};

const main = async () => {
  const adminId = await findOrCreateSeedAdmin();

  const idsByName = new Map<string, string>();
  for (const prompt of SEED_PROMPTS) {
    const row = await prisma.aIPrompt.upsert({
      where: { name: prompt.name },
      create: {
        name: prompt.name,
        description: prompt.description,
        content: prompt.content,
        variables: [],
        model: prompt.model,
        createdById: adminId,
      },
      update: {
        description: prompt.description,
        content: prompt.content,
        model: prompt.model,
        updatedById: adminId,
      },
      select: { id: true, name: true },
    });
    idsByName.set(row.name, row.id);
    console.log(`upserted prompt ${row.name}`);
  }

  // Build the three core groups: {<group>: {<band>PromptId: id}}
  const groups: Record<string, Record<string, string>> = {};
  for (const [groupKey, prefix] of Object.entries(CONFIG_GROUPS)) {
    groups[groupKey] = {};
    for (const band of ["info", "monitor", "action", "critical"]) {
      const id = idsByName.get(`${prefix}_${band}`);
      if (!id) throw new Error(`missing seeded prompt ${prefix}_${band}`);
      groups[groupKey][`${band}PromptId`] = id;
    }
  }

  const existing = await prisma.configuration.findUnique({
    where: { key: "aiPrompts" },
  });
  const merged = {
    ...((existing?.value as object | null) ?? {}),
    ...groups,
  };

  await prisma.configuration.upsert({
    where: { key: "aiPrompts" },
    create: {
      key: "aiPrompts",
      value: merged,
      title: "AI prompt wiring",
      description:
        "Which AIPrompt row each summarisation path uses, per severity band. Core groups are seeded from the repo (src/prompts).",
      createdById: adminId,
    },
    update: { value: merged, updatedById: adminId },
  });

  console.log(
    `configuration aiPrompts ${existing ? "merged" : "created"} with ${Object.keys(groups).length} core groups`,
  );
};

main()
  .catch((error) => {
    console.error("seed-ai-prompts failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
