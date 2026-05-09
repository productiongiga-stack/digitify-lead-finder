import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@digitify/api";
import { prisma } from "@digitify/db";
import { runWithRequestContext } from "@digitify/db";
import { ensureTenantSchemaCompatibility } from "@digitify/api/src/lib/tenant-schema-compat";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { randomUUID } from "crypto";
import { log } from "@digitify/api/src/lib/logger";
import { assertServerEnv } from "@/lib/env";

const handler = async (req: Request) => {
  assertServerEnv();
  await ensureTenantSchemaCompatibility(prisma);
  const requestId = randomUUID();
  const session = await getServerSession(authOptions);
  const sessionUserId = typeof (session?.user as any)?.id === "string" ? (session?.user as any).id : "";
  const userRecord = sessionUserId
    ? await prisma.user.findUnique({
        where: { id: sessionUserId },
        select: { id: true, email: true, name: true, role: true },
      })
    : null;
  const user = userRecord
    ? {
        id: userRecord.id,
        email: userRecord.email,
        name: userRecord.name ?? null,
        role: userRecord.role,
      }
    : null;

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
        }),
      })
  );
};

export { handler as GET, handler as POST };
