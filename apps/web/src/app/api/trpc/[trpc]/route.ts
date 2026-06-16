import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@digitify/api";
import { prisma } from "@digitify/db";
import { runWithRequestContext } from "@digitify/db";
import {
  ensureTenantSchemaCompatibility,
  isTenantSchemaEnsureEnabled,
} from "@digitify/api/src/lib/tenant-schema-compat";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { randomUUID } from "crypto";
import { log } from "@digitify/api/src/lib/logger";
import { resolveWorkspaceOwnerIdSync } from "@digitify/api/src/lib/workspace";
import { assertServerEnv } from "@/lib/env";

function resolveClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

const handler = async (req: Request) => {
  assertServerEnv();
  if (isTenantSchemaEnsureEnabled()) {
    await ensureTenantSchemaCompatibility(prisma);
  }
  const requestId = randomUUID();
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as
    | {
        id?: string;
        email?: string;
        name?: string | null;
        role?: string;
        workspaceId?: string;
        workspaceRole?: string;
        isPersonalWorkspace?: boolean;
      }
    | undefined;
  const sessionUserId = typeof sessionUser?.id === "string" ? sessionUser.id : "";

  let user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    workspaceId?: string;
    workspaceRole?: string;
    isPersonalWorkspace?: boolean;
  } | null = null;

  if (
    sessionUserId &&
    typeof sessionUser?.email === "string" &&
    typeof sessionUser?.role === "string" &&
    typeof sessionUser?.workspaceId === "string"
  ) {
    user = {
      id: sessionUserId,
      email: sessionUser.email,
      name: sessionUser.name ?? null,
      role: sessionUser.role,
      workspaceId: sessionUser.workspaceId,
      workspaceRole:
        typeof sessionUser.workspaceRole === "string" ? sessionUser.workspaceRole : sessionUser.role,
      isPersonalWorkspace:
        typeof sessionUser.isPersonalWorkspace === "boolean"
          ? sessionUser.isPersonalWorkspace
          : sessionUser.workspaceId === sessionUserId,
    };
  } else if (sessionUserId) {
    const userRecord = await prisma.user.findUnique({
      where: { id: sessionUserId },
      select: { id: true, email: true, name: true, role: true, workspaceOwnerId: true },
    });
    if (userRecord) {
      user = {
        id: userRecord.id,
        email: userRecord.email,
        name: userRecord.name ?? null,
        role: userRecord.role,
        workspaceId: resolveWorkspaceOwnerIdSync(userRecord),
        workspaceRole: userRecord.role,
        isPersonalWorkspace: true,
      };
    }
  }

  if (session && !user) {
    log.security.warn("Dropping stale/invalid tRPC session", {
      requestId,
      sessionUserId,
      sessionEmail: session.user?.email || null,
    });
  }

  return runWithRequestContext(
    {
      requestId,
      userId: user?.id,
    },
    () =>
      fetchRequestHandler({
        endpoint: "/api/trpc",
        req,
        router: appRouter,
        createContext: async () => ({
          db: prisma,
          requestId,
          user,
          clientIp: resolveClientIp(req),
        }),
      })
  );
};

export { handler as GET, handler as POST };
