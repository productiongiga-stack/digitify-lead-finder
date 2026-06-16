import "server-only";
import type { ReactNode } from "react";
import { createElement } from "react";
import { cache } from "react";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { createServerSideHelpers } from "@trpc/react-query/server";
import { getServerSession } from "next-auth";
import { prisma } from "@digitify/db";
import { appRouter, type AppRouter } from "@digitify/api";
import { resolveWorkspaceOwnerIdSync } from "@digitify/api/src/lib/workspace";
import { authOptions } from "@/lib/auth/options";
import type { Context } from "@digitify/api/src/trpc";
import superjson from "superjson";

async function buildTrpcContext(): Promise<Context> {
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

  let user: Context["user"] = null;

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
      const workspaceId = resolveWorkspaceOwnerIdSync(userRecord);
      user = {
        id: userRecord.id,
        email: userRecord.email,
        name: userRecord.name ?? null,
        role: userRecord.role,
        workspaceId,
        workspaceRole: userRecord.role,
        isPersonalWorkspace: workspaceId === userRecord.id,
      };
    }
  }

  return {
    db: prisma,
    user,
    requestId: "ssr",
    clientIp: "ssr",
  };
}

export const getQueryClient = cache(
  () =>
    new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 2 * 60 * 1000,
        },
        dehydrate: {
          serializeData: superjson.serialize,
        },
        hydrate: {
          deserializeData: superjson.deserialize,
        },
      },
    }),
);

export const getServerHelpers = cache(async (): Promise<ReturnType<typeof createServerSideHelpers<AppRouter>>> =>
  createServerSideHelpers<AppRouter>({
    router: appRouter,
    ctx: await buildTrpcContext(),
    transformer: superjson,
    queryClient: getQueryClient(),
  }),
);

export async function HydrateClient({ children }: { children: ReactNode }) {
  const helpers = await getServerHelpers();
  return createElement(HydrationBoundary, { state: dehydrate(helpers.queryClient) }, children);
}
