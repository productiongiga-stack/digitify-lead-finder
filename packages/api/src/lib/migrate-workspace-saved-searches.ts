import type { PrismaClient } from "@digitify/db";
import { isMissingSchemaError } from "./prisma-schema";
import { readWorkspaceJsonSetting } from "./user-json-setting";
import type { WorkspaceScope } from "./workspace-settings";

const LEGACY_KEY = "search.saved_searches_json";

type LegacySavedSearch = {
  id: string;
  name: string;
  query: string;
  city: string;
  country: string;
  niche: string;
  pageSize: number;
  createdAt: string;
  updatedAt: string;
};

export async function migrateLegacyWorkspaceSavedSearches(
  db: PrismaClient,
  scope: WorkspaceScope,
): Promise<{ imported: number }> {
  let existing = 0;
  try {
    existing = await db.workspaceSavedSearch.count({
      where: { createdById: scope.workspaceId },
    });
  } catch (error) {
    if (isMissingSchemaError(error)) return { imported: 0 };
    throw error;
  }
  if (existing > 0) return { imported: 0 };

  const raw = await readWorkspaceJsonSetting<unknown[]>(db, scope, LEGACY_KEY, []);
  if (!Array.isArray(raw) || raw.length === 0) return { imported: 0 };

  const rows = raw
    .filter((item): item is LegacySavedSearch => {
      if (!item || typeof item !== "object") return false;
      const row = item as LegacySavedSearch;
      return typeof row.id === "string" && typeof row.name === "string" && row.name.trim().length > 0;
    })
    .slice(0, 100)
    .map((row) => ({
      id: row.id,
      createdById: scope.workspaceId,
      name: row.name.trim(),
      query: row.query || "",
      city: row.city || "",
      country: row.country || "België",
      niche: row.niche || "",
      pageSize: Math.min(80, Math.max(5, row.pageSize || 20)),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    }));

  if (rows.length === 0) return { imported: 0 };

  try {
    await db.workspaceSavedSearch.createMany({ data: rows, skipDuplicates: true });
    return { imported: rows.length };
  } catch (error) {
    if (isMissingSchemaError(error)) return { imported: 0 };
    throw error;
  }
}
