import type { PrismaClient } from "@digitify/db";
import { z } from "zod";
import { emailTemplateDataFromInput } from "./email-templates";
import {
  readWorkspaceJsonSetting,
  writeWorkspaceJsonSetting,
} from "./user-json-setting";
import type { WorkspaceScope } from "./workspace-settings";

export const TEMPLATE_LIBRARY_KEY = "templates.library_json";

const legacyLibrarySchema = z.object({
  id: z.string(),
  type: z.enum(["EMAIL", "QUOTE", "REPORT", "CHATBOT", "FOLLOW_UP", "ADS"]),
  name: z.string(),
  subject: z.string().nullable().default(null),
  content: z.string(),
});

export function mapLegacyTemplateType(type: string): "OUTREACH" | "FOLLOW_UP" | "PROPOSAL" | "REPORT" | "CUSTOM" {
  if (type === "FOLLOW_UP") return "FOLLOW_UP";
  if (type === "QUOTE") return "PROPOSAL";
  if (type === "REPORT") return "REPORT";
  return "CUSTOM";
}

export function countLegacyLibraryEntries(raw: unknown): number {
  if (!Array.isArray(raw)) return 0;
  return raw.filter((entry) => legacyLibrarySchema.safeParse(entry).success).length;
}

export async function readLegacyTemplateLibrary(
  db: PrismaClient,
  scope: WorkspaceScope,
): Promise<unknown[]> {
  return readWorkspaceJsonSetting<unknown[]>(db, scope, TEMPLATE_LIBRARY_KEY, []);
}

export async function migrateLegacyTemplateLibrary(
  db: PrismaClient,
  scope: WorkspaceScope,
): Promise<{ migrated: number; remaining: number }> {
  const raw = await readLegacyTemplateLibrary(db, scope);
  const validCount = countLegacyLibraryEntries(raw);
  if (validCount === 0) {
    return { migrated: 0, remaining: 0 };
  }

  const existing = await db.emailTemplate.findMany({
    where: { createdById: scope.workspaceId },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((item) => item.name));
  let migrated = 0;

  for (const entry of raw) {
    const parsed = legacyLibrarySchema.safeParse(entry);
    if (!parsed.success) continue;
    const item = parsed.data;
    const name = `[Legacy] ${item.name}`.slice(0, 160);
    if (existingNames.has(name)) continue;

    await db.emailTemplate.create({
      data: {
        createdById: scope.workspaceId,
        name,
        subject: item.subject || "Onderwerp",
        isGlobal: false,
        ...emailTemplateDataFromInput({
          body: item.content,
          type: mapLegacyTemplateType(item.type),
          layout: "modern",
          description: `Gemigreerd uit oude library (${item.type})`,
        }),
      },
    });
    existingNames.add(name);
    migrated += 1;
  }

  if (migrated > 0) {
    await writeWorkspaceJsonSetting(db, scope, TEMPLATE_LIBRARY_KEY, []);
  }

  const remainingRaw = await readLegacyTemplateLibrary(db, scope);
  return { migrated, remaining: countLegacyLibraryEntries(remainingRaw) };
}
