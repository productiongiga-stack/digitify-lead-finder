import { createHash } from "node:crypto";
import { prisma, setWorkspaceRlsContext, type Prisma } from "@digitify/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, mutationProcedure, protectedProcedure } from "../trpc";
import {
  centralCreativeEnabled,
  creativePriceKey,
  quoteCreative,
  settleTerminalCreativeJobs,
} from "../lib/creative-credits";
import { creativeStripe } from "../lib/creative-stripe";
import { loadCreativeBrandContextForKit } from "../lib/social-brand-kits";
import { prepareGoogleCreativeAsset } from "../lib/creative-google-asset";
import { importRemoteMediaToBlob } from "../lib/import-media-to-blob";

const goal = z.enum(["social", "ads", "images", "video", "lipsync"]);

function activeWorkspaceId(user: { id: string; workspaceId?: string | null }) {
  return user.workspaceId ?? user.id;
}
const settings = z.object({
  resolution: z.string().max(30).optional(),
  quality: z.string().max(30).optional(),
  duration: z.number().int().min(1).max(120).optional(),
  aspectRatio: z.string().max(20).optional(),
});
function requireOperator(userId: string) {
  if (
    !process.env.CREATIVE_OPERATOR_USER_IDS?.split(",")
      .map((id) => id.trim())
      .includes(userId)
  )
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Alleen Digitify-beheerders mogen creditprijzen wijzigen.",
    });
}
export const creativeStudioProcedures = {
  getCreativeBrand: protectedProcedure
    .input(z.object({ brandKitId: z.string().max(80).optional() }))
    .query(({ ctx, input }) =>
      loadCreativeBrandContextForKit(
        ctx.db,
        activeWorkspaceId(ctx.user),
        input.brandKitId,
      ),
    ),
  listCreativeDrafts: protectedProcedure.query(({ ctx }) =>
    prisma.creativeDraft.findMany({
      where: { userId: ctx.user.id, workspaceId: activeWorkspaceId(ctx.user) },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  ),
  getCreativeDraft: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const draft = await prisma.creativeDraft.findFirst({
        where: {
          id: input.id,
          userId: ctx.user.id,
          workspaceId: activeWorkspaceId(ctx.user),
        },
      });
      if (!draft)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Concept niet gevonden.",
        });
      return draft;
    }),
  saveCreativeDraft: mutationProcedure
    .input(
      z.object({
        id: z.string().optional(),
        revision: z.number().int().min(0).optional(),
        goal,
        step: z.number().int().min(0).max(4),
        state: z.record(z.unknown()),
        jobId: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (JSON.stringify(input.state).length > 60000)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Concept te groot. Sla bestanden eerst op in je bibliotheek.",
        });
      if (
        input.jobId &&
        !(await ctx.db.mediaGeneration.findFirst({
          where: { id: input.jobId, workspaceId: activeWorkspaceId(ctx.user) },
        }))
      )
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Generatie niet gevonden.",
        });
      const data = {
        goal: input.goal,
        step: input.step,
        state: input.state as Prisma.InputJsonObject,
        jobId: input.jobId,
      };
      if (!input.id)
        return prisma.creativeDraft.create({
          data: {
            ...data,
            userId: ctx.user.id,
            workspaceId: activeWorkspaceId(ctx.user),
          },
        });
      return prisma.$transaction(async (tx) => {
        await setWorkspaceRlsContext(tx, activeWorkspaceId(ctx.user), ctx.user.id);
        await tx.$queryRaw`SELECT id FROM creative_drafts WHERE id = ${input.id!} FOR UPDATE`;
        const existing = await tx.creativeDraft.findFirst({
          where: {
            id: input.id!,
            userId: ctx.user.id,
            workspaceId: activeWorkspaceId(ctx.user),
          },
        });
        if (!existing)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Concept niet gevonden.",
          });
        if (!input.jobId && existing.jobId) {
          const active = await tx.mediaGeneration.findUnique({
            where: { id: existing.jobId },
            select: { status: true },
          });
          const oldState = existing.state as Record<string, unknown>;
          if (
            (active?.status === "PENDING" || active?.status === "PROCESSING") &&
            oldState.generatorType === input.state.generatorType
          ) {
            data.jobId = existing.jobId;
            const fields =
              input.state.fields && typeof input.state.fields === "object"
                ? (input.state.fields as Record<string, unknown>)
                : {};
            data.state = {
              ...input.state,
              fields: {
                ...fields,
                [`${String(oldState.generatorType || "images")}:jobId`]:
                  existing.jobId,
              },
            } as Prisma.InputJsonObject;
          }
        }
        const changed = await tx.creativeDraft.updateMany({
          where: {
            id: input.id!,
            userId: ctx.user.id,
            workspaceId: activeWorkspaceId(ctx.user),
            revision: input.revision ?? 0,
          },
          data: { ...data, revision: { increment: 1 } },
        });
        if (!changed.count)
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Dit concept is elders gewijzigd. Herlaad voordat je verdergaat.",
          });
        return tx.creativeDraft.findUniqueOrThrow({ where: { id: input.id! } });
      });
    }),
  getCreativeCredits: protectedProcedure.query(async ({ ctx }) => {
    await settleTerminalCreativeJobs(ctx.user.id);
    const [wallet, ledger, bundles, subscription] = await Promise.all([
      prisma.creativeWallet.findUnique({ where: { userId: ctx.user.id } }),
      prisma.creativeLedger.findMany({
        where: { userId: ctx.user.id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.creativeBundle.findMany({
        where: { enabled: true },
        orderBy: { priceCents: "asc" },
      }),
      prisma.creativeSubscription.findFirst({ where: { userId: ctx.user.id, workspaceId: activeWorkspaceId(ctx.user), status: { in: ["ACTIVE", "TRIALING"] } }, orderBy: { createdAt: "desc" } }),
    ]);
    return {
      available: wallet?.available ?? 0,
      reserved: wallet?.reserved ?? 0,
      ledger,
      bundles,
      enabled: centralCreativeEnabled(),
      providerReady: Boolean(process.env.CREATIVE_MUAPI_KEY),
      checkoutReady: Boolean(process.env.CREATIVE_STRIPE_TEST_SECRET_KEY?.startsWith("sk_test_") && process.env.CREATIVE_STRIPE_WEBHOOK_SECRET),
      subscriptionReady: Boolean(process.env.CREATIVE_STRIPE_TEST_SECRET_KEY?.startsWith("sk_test_") && process.env.CREATIVE_STRIPE_WEBHOOK_SECRET && process.env.CREATIVE_STRIPE_SUBSCRIPTION_PRICE_ID),
      subscription: subscription ? { status: subscription.status, currentPeriodEnd: subscription.currentPeriodEnd, cancelAtPeriodEnd: subscription.cancelAtPeriodEnd } : null,
      testMode: true as const,
    };
  }),
  quoteCreative: protectedProcedure
    .input(z.object({ model: z.string(), settings }))
    .query(async ({ input }) => ({
      credits: await quoteCreative(input.model, input.settings),
    })),
  getCreativePricing: adminProcedure.query(async ({ ctx }) => {
    requireOperator(ctx.user.id);
    return {
      prices: await prisma.creativePrice.findMany(),
      bundles: await prisma.creativeBundle.findMany(),
    };
  }),
  saveCreativePrice: adminProcedure
    .input(
      z.object({
        model: z.string().min(1),
        settings,
        credits: z.number().int().min(1).max(1000000),
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireOperator(ctx.user.id);
      const key = creativePriceKey(input.model, input.settings);
      const data = {
        ...input,
        settings: input.settings as Prisma.InputJsonObject,
      };
      return prisma.creativePrice.upsert({
        where: { key },
        create: { key, ...data },
        update: data,
      });
    }),
  saveCreativeBundle: adminProcedure
    .input(
      z.object({
        id: z.string().optional(),
        name: z.string().trim().min(1).max(100),
        credits: z.number().int().min(1).max(1000000),
        priceCents: z.number().int().min(50).max(1000000),
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireOperator(ctx.user.id);
      const { id, ...data } = input;
      return id
        ? prisma.creativeBundle.update({ where: { id }, data })
        : prisma.creativeBundle.create({ data });
    }),
  createCreativeCheckout: mutationProcedure
    .input(z.object({ bundleId: z.string(), requestKey: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const stripe = creativeStripe();
      if (
        !process.env.CREATIVE_MUAPI_KEY ||
        !centralCreativeEnabled() ||
        !process.env.CREATIVE_STRIPE_WEBHOOK_SECRET
      )
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Creditbetalingen zijn nog niet geactiveerd.",
        });
      const bundle = await prisma.creativeBundle.findFirst({
        where: { id: input.bundleId, enabled: true },
      });
      if (!bundle)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bundel niet beschikbaar.",
        });
      const id = createHash("sha256")
        .update(`${ctx.user.id}:${input.requestKey}`)
        .digest("hex");
      const purchase = await prisma.creativePurchase.upsert({
        where: { id },
        create: {
          id,
          userId: ctx.user.id,
          workspaceId: activeWorkspaceId(ctx.user),
          bundleId: bundle.id,
          credits: bundle.credits,
          priceCents: bundle.priceCents,
        },
        update: {},
      });
      if (purchase.bundleId !== bundle.id || purchase.status !== "PENDING")
        throw new TRPCError({
          code: "CONFLICT",
          message: "Deze bestelling is al verwerkt.",
        });
      const base = process.env.NEXTAUTH_URL?.replace(/\/$/, "");
      if (!base)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "App-URL ontbreekt.",
        });
      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "eur",
                unit_amount: purchase.priceCents,
                product_data: {
                  name: `${bundle.name} — ${purchase.credits} credits (test)`,
                },
              },
            },
          ],
          metadata: { creativePurchaseId: purchase.id },
          success_url: `${base}/creative-studio?tab=credits&payment=success`,
          cancel_url: `${base}/creative-studio?tab=credits&payment=cancelled`,
        },
        { idempotencyKey: purchase.id },
      );
      await prisma.creativePurchase.update({
        where: { id },
        data: { sessionId: session.id },
      });
      return { url: session.url };
  }),
  createCreativeSubscriptionCheckout: mutationProcedure
    .input(z.object({ requestKey: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const priceId = process.env.CREATIVE_STRIPE_SUBSCRIPTION_PRICE_ID?.trim();
      if (!priceId || !process.env.CREATIVE_STRIPE_TEST_SECRET_KEY?.startsWith("sk_test_") || !process.env.CREATIVE_STRIPE_WEBHOOK_SECRET) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Abonnementen zijn nog niet geconfigureerd." });
      }
      const stripe = creativeStripe();
      const base = process.env.NEXTAUTH_URL?.replace(/\/$/, "");
      if (!base) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "App-URL ontbreekt." });
      const session = await stripe.checkout.sessions.create({ mode: "subscription", line_items: [{ price: priceId, quantity: 1 }], metadata: { userId: ctx.user.id, workspaceId: activeWorkspaceId(ctx.user), requestKey: input.requestKey }, success_url: `${base}/creative-studio?tab=credits&subscription=success`, cancel_url: `${base}/creative-studio?tab=credits&subscription=cancelled` }, { idempotencyKey: `subscription:${ctx.user.id}:${input.requestKey}` });
      return { url: session.url };
    }),
  prepareCreativeHandoff: mutationProcedure
    .input(
      z.object({
        jobId: z.string(),
        destination: z.enum(["social", "meta", "google"]),
        brandKitId: z.string().max(80).optional(),
        draftId: z.string().optional(),
        targetPlanId: z.string().optional(),
        slot: z.enum(["landscape", "square"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const destinationModule =
        input.destination === "meta"
          ? "metaAds"
          : input.destination === "google"
            ? "googleAds"
            : "social";
      if (ctx.user.disabledModules?.includes(destinationModule))
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Je hebt geen toegang tot deze module.",
        });
      if (input.targetPlanId) {
        const where = {
          id: input.targetPlanId,
          createdById: ctx.user.ownerUserId!,
        };
        const target =
          input.destination === "meta"
            ? await ctx.db.metaAdPlan.findFirst({ where, select: { id: true } })
            : input.destination === "google"
              ? await ctx.db.googleAdPlan.findFirst({
                  where,
                  select: { id: true },
                })
              : null;
        if (!target)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Advertentieconcept niet gevonden in deze workspace.",
          });
      }
      const job = await ctx.db.mediaGeneration.findFirst({
        where: {
          id: input.jobId,
          workspaceId: activeWorkspaceId(ctx.user),
          status: "COMPLETED",
        },
      });
      if (!job || (!job.outputUrl && !job.blobUrl))
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Geen voltooid resultaat gevonden.",
        });
      if (input.destination === "google" && job.type !== "IMAGE")
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Google Ads ondersteunt hier alleen afbeeldingen.",
        });
      if (input.brandKitId)
        await loadCreativeBrandContextForKit(
          ctx.db,
          activeWorkspaceId(ctx.user),
          input.brandKitId,
        );
      if (
        input.draftId &&
        !(await prisma.creativeDraft.findFirst({
          where: {
            id: input.draftId,
            userId: ctx.user.id,
            workspaceId: activeWorkspaceId(ctx.user),
          },
        }))
      )
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Concept niet gevonden.",
        });
      let assetUrl = job.blobUrl;
      let googleAssetUrl: string | undefined;
      if (input.destination === "google") {
        googleAssetUrl = (
          await prepareGoogleCreativeAsset({
            sourceUrl: job.blobUrl || job.outputUrl!,
            workspaceId: activeWorkspaceId(ctx.user),
            userId: ctx.user.id,
            slot: input.slot || "landscape",
            jobId: job.id,
          })
        ).url;
      }
      if (!assetUrl) {
        const stored = await importRemoteMediaToBlob({
          sourceUrl: job.outputUrl!,
          workspaceId: activeWorkspaceId(ctx.user),
          userId: ctx.user.id,
          filename: `creative-${job.id}`,
        });
        assetUrl = stored.url;
        await ctx.db.mediaGeneration.update({
          where: { id: job.id },
          data: { blobUrl: assetUrl },
        });
      }
      const params = new URLSearchParams();
      params.set(
        input.destination === "social"
          ? job.type === "IMAGE"
            ? "imageJob"
            : "videoJob"
          : input.destination === "meta"
            ? "adJob"
            : "creativeJob",
        job.id,
      );
      const metadata = job.metadata as Record<string, unknown> | null;
      const brand = input.brandKitId || String(metadata?.brandKitId || "");
      if (brand) params.set("brandKitId", brand);
      if (input.draftId) params.set("creativeDraft", input.draftId);
      if (input.targetPlanId) params.set("planId", input.targetPlanId);
      if (job.socialPostId && input.destination === "social")
        params.set("socialPostId", job.socialPostId);
      if (input.slot) params.set("creativeSlot", input.slot);
      if (googleAssetUrl) params.set("creativeAssetUrl", googleAssetUrl);
      return {
        assetUrl,
        href: `${input.destination === "social" ? "/social" : input.destination === "meta" ? "/meta-ads" : "/google-ads"}?${params}`,
      };
    }),
};
