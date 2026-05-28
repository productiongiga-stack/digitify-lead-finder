import type { PrismaClient } from "@digitify/db";
import { readWorkspaceJsonSetting } from "./user-json-setting";
import type { WorkspaceScope } from "./workspace-settings";

const LEGACY_TASKS_KEY = "tasks.items_json";

type LegacyTask = {
  id: string;
  title: string;
  description: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueAt: string | null;
  relatedType: "LEAD" | "QUOTE" | "BOOKING" | "CLIENT" | null;
  relatedId: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * One-time import from workspace JSON into workspace_tasks (idempotent per workspace).
 */
export async function migrateLegacyWorkspaceTasks(
  db: PrismaClient,
  scope: WorkspaceScope,
): Promise<{ imported: number }> {
  const existing = await db.workspaceTask.count({
    where: { createdById: scope.workspaceId },
  });
  if (existing > 0) return { imported: 0 };

  const raw = await readWorkspaceJsonSetting<unknown[]>(db, scope, LEGACY_TASKS_KEY, []);
  if (!Array.isArray(raw) || raw.length === 0) return { imported: 0 };

  const rows = raw
    .filter((item): item is LegacyTask => {
      if (!item || typeof item !== "object") return false;
      const t = item as LegacyTask;
      return typeof t.id === "string" && typeof t.title === "string" && t.title.trim().length > 0;
    })
    .slice(0, 3000)
    .map((task) => ({
      id: task.id,
      createdById: scope.workspaceId,
      title: task.title.trim(),
      description: task.description?.trim() || "",
      status: task.status,
      priority: task.priority,
      dueAt: task.dueAt ? new Date(task.dueAt) : null,
      relatedType: task.relatedType,
      relatedId: task.relatedId,
      createdAt: new Date(task.createdAt),
      updatedAt: new Date(task.updatedAt),
    }));

  if (rows.length === 0) return { imported: 0 };

  await db.workspaceTask.createMany({ data: rows, skipDuplicates: true });
  return { imported: rows.length };
}
