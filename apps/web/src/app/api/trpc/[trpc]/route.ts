import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@digitify/api";
import { prisma, runWithRequestContext } from "@digitify/db";
import { getCurrentUser } from "@/lib/auth/session";
import { randomUUID } from "crypto";
import { validateServerEnv } from "@/lib/env";
import { getClientIp } from "@/lib/http-security";

const handler = async (req: Request) => {
  validateServerEnv();
  const requestId = randomUUID();
  const user = await getCurrentUser();
  const clientIp = getClientIp(req);
  return runWithRequestContext({ requestId, userId: user?.id }, () =>
    fetchRequestHandler({
      endpoint: "/api/trpc", req, router: appRouter,
      createContext: async () => ({ db: prisma, requestId, user, clientIp }),
    }),
  );
};

export { handler as GET, handler as POST };
