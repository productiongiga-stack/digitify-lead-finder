import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@digitify/api";
import { prisma } from "@digitify/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { randomUUID } from "crypto";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => {
      const session = await getServerSession(authOptions);
      return {
        db: prisma,
        requestId: randomUUID(),
        user: session?.user
          ? {
              id: (session.user as any).id,
              email: session.user.email!,
              name: session.user.name ?? null,
              role: (session.user as any).role ?? "MEMBER",
            }
          : null,
      };
    },
  });

export { handler as GET, handler as POST };
