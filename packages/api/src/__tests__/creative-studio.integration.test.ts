import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { prisma } from "@digitify/db";
import {
  creativePriceKey,
  reserveCreativeJob,
  settleCreativeJob,
} from "../lib/creative-credits";
import { fulfillCreativeCheckout } from "../lib/creative-stripe";
import { mediaRouter } from "../routers/media.router";

const run = process.env.RUN_CREATIVE_INTEGRATION === "1";
const user = `creative_test_${randomUUID()}`;
const other = `creative_test_${randomUUID()}`;
const model = `test-${randomUUID()}`;
const priceKey = creativePriceKey(model, {});
function caller(id = user, workspaceId = user) {
  return mediaRouter.createCaller({
    db: prisma,
    user: {
      id,
      workspaceId,
      email: "test@example.com",
      role: "OWNER",
      name: "Test",
    },
    requestId: randomUUID(),
  });
}
function data() {
  return {
    workspaceId: user,
    userId: user,
    type: "IMAGE" as const,
    model,
    prompt: "Integration test",
    metadata: { expectedCredits: 6 },
  };
}

describe.skipIf(!run)(
  "Creative Studio persistence and financial concurrency",
  () => {
    beforeAll(async () => {
      for (const key of ["DATABASE_URL", "DIRECT_URL"])
        if (
          process.env[key] &&
          !["localhost", "127.0.0.1", "::1"].includes(
            new URL(process.env[key]!).hostname,
          )
        )
          throw new Error("Local database required");
      vi.stubEnv("CREATIVE_MUAPI_KEY", "integration-only-no-provider-call");
      for (const id of [user, other])
        await prisma.user.create({
          data: {
            id,
            email: `${id}@test.invalid`,
            name: "Creative test",
            passwordHash: "not-a-login",
            role: "OWNER",
          },
        });
      await prisma.creativePrice.create({
        data: { key: priceKey, model, settings: {}, credits: 6, enabled: true },
      });
      await prisma.creativeWallet.create({
        data: { userId: user, available: 10 },
      });
    });
    afterAll(async () => {
      const ids = { in: [user, other] };
      await prisma.creativeReservation.deleteMany({ where: { userId: ids } });
      await prisma.creativeLedger.deleteMany({ where: { userId: ids } });
      await prisma.creativeWallet.deleteMany({ where: { userId: ids } });
      await prisma.creativePurchase.deleteMany({ where: { userId: ids } });
      await prisma.creativeDraft.deleteMany({ where: { userId: ids } });
      await prisma.mediaGeneration.deleteMany({ where: { userId: ids } });
      await prisma.creativePrice.deleteMany({ where: { key: priceKey } });
      await prisma.metaAdPlan.deleteMany({ where: { createdById: ids } });
      await prisma.googleAdPlan.deleteMany({ where: { createdById: ids } });
      await prisma.user.deleteMany({ where: { id: ids } });
      vi.unstubAllEnvs();
    });
    it("allows only one of two simultaneous reservations when funds are insufficient", async () => {
      const results = await Promise.allSettled([
        reserveCreativeJob(data(), randomUUID()),
        reserveCreativeJob(data(), randomUUID()),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const job = (
        results.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<
          Awaited<ReturnType<typeof reserveCreativeJob>>
        >
      ).value;
      expect(
        await prisma.creativeWallet.findUnique({ where: { userId: user } }),
      ).toMatchObject({ available: 4, reserved: 6 });
      await Promise.all([
        settleCreativeJob(job.id, false),
        settleCreativeJob(job.id, false),
      ]);
      expect(
        await prisma.creativeWallet.findUnique({ where: { userId: user } }),
      ).toMatchObject({ available: 10, reserved: 0 });
      expect(
        await prisma.creativeLedger.count({
          where: { reference: `settle:${job.id}` },
        }),
      ).toBe(1);
    });
    it("rejects a changed price before reserving credits", async () => {
      await expect(
        reserveCreativeJob(
          { ...data(), metadata: { expectedCredits: 5 } },
          randomUUID(),
        ),
      ).rejects.toThrow("prijs is gewijzigd");
      expect(
        await prisma.creativeWallet.findUnique({ where: { userId: user } }),
      ).toMatchObject({ available: 10, reserved: 0 });
    });
    it("links a pending job before returning to the browser and prevents duplicate draft submissions", async () => {
      const draft = await caller().saveCreativeDraft({
        goal: "images",
        step: 2,
        state: {
          generatorType: "images",
          fields: { "images:prompt": "Integration test" },
        },
      });
      const job = await reserveCreativeJob(data(), randomUUID(), draft.id);
      expect(await caller().getCreativeDraft({ id: draft.id })).toMatchObject({
        jobId: job.id,
        state: { fields: { "images:jobId": job.id } },
      });
      await expect(
        reserveCreativeJob(data(), randomUUID(), draft.id),
      ).rejects.toThrow("loopt al een generatie");
      const updated = await caller().saveCreativeDraft({
        id: draft.id,
        revision: 0,
        goal: "images",
        step: 2,
        state: {
          generatorType: "images",
          fields: { "images:prompt": "Integration test" },
        },
        jobId: null,
      });
      expect(updated.jobId).toBe(job.id);
      const foreign = await caller(other, other).saveCreativeDraft({
        goal: "images",
        step: 0,
        state: {},
      });
      await expect(
        reserveCreativeJob(data(), randomUUID(), foreign.id),
      ).rejects.toThrow("Concept niet gevonden");
      await settleCreativeJob(job.id, false);
    });
    it("charges once and rejects a repeated submission key", async () => {
      const key = randomUUID();
      const job = await reserveCreativeJob(data(), key);
      await expect(reserveCreativeJob(data(), key)).rejects.toThrow(
        "al gestart",
      );
      await Promise.all([
        settleCreativeJob(job.id, true),
        settleCreativeJob(job.id, true),
      ]);
      expect(
        await prisma.creativeWallet.findUnique({ where: { userId: user } }),
      ).toMatchObject({ available: 4, reserved: 0 });
    });
    it("isolates drafts and rejects stale revisions", async () => {
      const draft = await caller().saveCreativeDraft({
        goal: "video",
        step: 1,
        state: { brandKitId: "", fields: { "video:prompt": "A saved idea" } },
      });
      expect(await caller().getCreativeDraft({ id: draft.id })).toMatchObject({
        state: { fields: { "video:prompt": "A saved idea" } },
      });
      await expect(
        caller(other, user).getCreativeDraft({ id: draft.id }),
      ).rejects.toThrow("niet gevonden");
      await expect(
        caller(user, other).getCreativeDraft({ id: draft.id }),
      ).rejects.toThrow("niet gevonden");
      await caller().saveCreativeDraft({
        id: draft.id,
        revision: 0,
        goal: "video",
        step: 2,
        state: {},
      });
      await expect(
        caller().saveCreativeDraft({
          id: draft.id,
          revision: 0,
          goal: "video",
          step: 1,
          state: {},
        }),
      ).rejects.toThrow("elders gewijzigd");
    });
    it("checks destination permissions and media compatibility before handoff", async () => {
      const job = await prisma.mediaGeneration.create({
        data: {
          ...data(),
          type: "VIDEO",
          status: "COMPLETED",
          outputUrl: "https://cdn.muapi.ai/test.mp4",
          blobUrl: "https://test.public.blob.vercel-storage.com/test.mp4",
        },
      });
      await expect(
        caller(other, other).prepareCreativeHandoff({
          jobId: job.id,
          destination: "social",
        }),
      ).rejects.toThrow("Geen voltooid resultaat");
      await expect(
        caller().prepareCreativeHandoff({
          jobId: job.id,
          destination: "google",
        }),
      ).rejects.toThrow("alleen afbeeldingen");
      const restricted = mediaRouter.createCaller({
        db: prisma,
        user: {
          id: user,
          workspaceId: user,
          email: "test@example.com",
          role: "OWNER",
          name: "Test",
          disabledModules: ["social"],
        },
        requestId: randomUUID(),
      });
      await expect(
        restricted.prepareCreativeHandoff({
          jobId: job.id,
          destination: "social",
        }),
      ).rejects.toThrow("geen toegang");
      const privatePlan = await prisma.metaAdPlan.create({
        data: { createdById: other, name: "Private test plan" },
      });
      await expect(
        caller().prepareCreativeHandoff({
          jobId: job.id,
          destination: "meta",
          targetPlanId: privatePlan.id,
        }),
      ).rejects.toThrow("Advertentieconcept niet gevonden");
      const ownPlan = await prisma.metaAdPlan.create({
        data: {
          createdById: user,
          name: "Existing test plan",
          creatives: { message: "Keep this copy" },
        },
      });
      const adHandoff = await caller().prepareCreativeHandoff({
        jobId: job.id,
        destination: "meta",
        targetPlanId: ownPlan.id,
      });
      expect(adHandoff.href).toContain(`planId=${ownPlan.id}`);
      expect(
        (await prisma.metaAdPlan.findUnique({ where: { id: ownPlan.id } }))
          ?.creatives,
      ).toEqual({ message: "Keep this copy" });
      const handoff = await caller().prepareCreativeHandoff({
        jobId: job.id,
        destination: "social",
      });
      expect(handoff.href).toContain("videoJob=");
    });
    it("fulfills a paid test checkout once, ignoring live and unpaid sessions", async () => {
      const purchase = await prisma.creativePurchase.create({
        data: {
          userId: user,
          workspaceId: user,
          bundleId: "test",
          credits: 100,
          priceCents: 500,
          sessionId: `cs_test_${randomUUID()}`,
        },
      });
      const session = {
        id: purchase.sessionId,
        mode: "payment",
        livemode: false,
        payment_status: "paid",
        amount_total: 500,
        currency: "eur",
        metadata: { creativePurchaseId: purchase.id },
      } as Stripe.Checkout.Session;
      await fulfillCreativeCheckout({ ...session, payment_status: "unpaid" });
      await fulfillCreativeCheckout({ ...session, livemode: true });
      expect(
        await prisma.creativeWallet.findUnique({ where: { userId: user } }),
      ).toMatchObject({ available: 4 });
      await expect(
        fulfillCreativeCheckout({ ...session, amount_total: 600 }),
      ).rejects.toThrow("niet overeen");
      await Promise.all([
        fulfillCreativeCheckout(session),
        fulfillCreativeCheckout(session),
      ]);
      expect(
        await prisma.creativeWallet.findUnique({ where: { userId: user } }),
      ).toMatchObject({ available: 104 });
      expect(
        await prisma.creativeLedger.count({
          where: { reference: `purchase:${session.id}` },
        }),
      ).toBe(1);
    });
  },
);
