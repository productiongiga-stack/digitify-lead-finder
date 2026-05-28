import type { PrismaClient, ScoringWeight } from "@digitify/db";

/** Shared default scoring factors (seed). Workspace rows override by factorKey. */
export const GLOBAL_SCORING_WORKSPACE = "_global";

export function mergeScoringWeights(
  globalRows: ScoringWeight[],
  workspaceRows: ScoringWeight[],
): ScoringWeight[] {
  const byKey = new Map<string, ScoringWeight>();
  for (const row of globalRows) byKey.set(row.factorKey, row);
  for (const row of workspaceRows) byKey.set(row.factorKey, row);
  return Array.from(byKey.values()).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function loadMergedScoringWeights(db: PrismaClient, workspaceId: string) {
  const rows = await db.scoringWeight.findMany({
    where: { createdById: { in: [GLOBAL_SCORING_WORKSPACE, workspaceId] } },
    orderBy: { sortOrder: "asc" },
  });
  return mergeScoringWeights(
    rows.filter((r) => r.createdById === GLOBAL_SCORING_WORKSPACE),
    rows.filter((r) => r.createdById === workspaceId),
  );
}

export async function resolveWorkspaceScoringWeightForUpdate(
  db: PrismaClient,
  workspaceId: string,
  weightId: string,
) {
  const existing = await db.scoringWeight.findUnique({ where: { id: weightId } });
  if (!existing) return null;
  if (existing.createdById === workspaceId) return existing;
  if (existing.createdById !== GLOBAL_SCORING_WORKSPACE) return null;

  const workspaceCopy = await db.scoringWeight.findUnique({
    where: {
      createdById_factorKey: {
        createdById: workspaceId,
        factorKey: existing.factorKey,
      },
    },
  });
  if (workspaceCopy) return workspaceCopy;

  return db.scoringWeight.create({
    data: {
      createdById: workspaceId,
      factorKey: existing.factorKey,
      label: existing.label,
      description: existing.description,
      weight: existing.weight,
      maxPoints: existing.maxPoints,
      enabled: existing.enabled,
      category: existing.category,
      sortOrder: existing.sortOrder,
    },
  });
}
