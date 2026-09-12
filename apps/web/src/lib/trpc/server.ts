import "server-only";
import type { ReactNode } from "react";
import { createElement } from "react";
import { cache } from "react";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { createServerSideHelpers } from "@trpc/react-query/server";
import { prisma } from "@digitify/db";
import { appRouter, type AppRouter } from "@digitify/api";
import { getCurrentUser } from "@/lib/auth/session";
import type { Context } from "@digitify/api/src/trpc";
import superjson from "superjson";

async function buildTrpcContext(): Promise<Context> {
  return { db: prisma, user: await getCurrentUser(), requestId: "ssr", clientIp: "ssr" };
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
