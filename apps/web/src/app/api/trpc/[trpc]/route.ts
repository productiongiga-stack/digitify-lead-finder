import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@digitify/api";
import { prisma } from "@digitify/db";
import { runWithRequestContext } from "@digitify/db";
import { ensureTenantSchemaCompatibility } from "@digitify/api/src/lib/tenant-schema-compat";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { randomUUID } from "crypto";
import "@/lib/env";

let compatScheduled = false;

function scheduleSchemaCompat() {
  if (compatScheduled) return;
  compatScheduled = true;
  // Fire-and-forget, only once per runtime instance.
  void ensureTenantSchemaCompatibility(prisma).catch(() => {});
}

const handler = async (req: Request) => {
  scheduleSchemaCompat();
  const requestId = randomUUID();
  const session = await getServerSession(authOptions);
  const user = session?.user
    ? {
        id: (session.user as any).id,
        email: session.user.email!,
        name: session.user.name ?? null,
        role: (session.user as any).role ?? "MEMBER",
      }
    : null;

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
