import { TRPCError } from "@trpc/server";

type WorkspaceRecord = {
  createdById?: string | null;
  workspaceId?: string | null;
  generatedById?: string | null;
};

export function assertWorkspaceRecord<T extends WorkspaceRecord>(
  record: T | null | undefined,
  workspaceId: string,
  label = "Record",
): T {
  if (!record) {
    throw new TRPCError({ code: "NOT_FOUND", message: `${label} niet gevonden.` });
  }
  const tenantId = record.createdById ?? record.workspaceId ?? record.generatedById;
  if (tenantId && tenantId !== workspaceId) {
    throw new TRPCError({ code: "NOT_FOUND", message: `${label} niet gevonden.` });
  }
  return record;
}

export function assertWorkspaceRecordLoose<T>(
  record: T | null | undefined,
  workspaceId: string,
  label = "Record",
): T {
  return assertWorkspaceRecord(record as WorkspaceRecord | null | undefined, workspaceId, label) as T;
}

export function workspaceWhere(workspaceId: string) {
  return { createdById: workspaceId };
}

export function workspaceScopedWhere(workspaceId: string, id: string) {
  return { id, createdById: workspaceId };
}

type FindFirstDelegate<T> = {
  findFirst: (args: { where: { id: string; createdById: string } }) => Promise<T | null>;
};

export async function findWorkspaceRecord<T = Record<string, unknown>>(
  delegate: FindFirstDelegate<T>,
  workspaceId: string,
  id: string,
  label: string,
): Promise<T> {
  const record = await delegate.findFirst({
    where: workspaceScopedWhere(workspaceId, id),
  });
  return assertWorkspaceRecordLoose(record, workspaceId, label);
}
