/**
 * Cross-tenant IDOR smoke — runs only when RUN_DB_INTEGRATION=1 and DATABASE_URL is set.
 */
import { describe, expect, it } from "vitest";
import { PrismaClient } from "@digitify/db";
import { leadRouter } from "../routers/lead.router";
import { googleAdsRouter } from "../routers/google-ads.router";
import { metaAdsRouter } from "../routers/meta-ads.router";

const runIntegration = process.env.RUN_DB_INTEGRATION === "1" && Boolean(process.env.DATABASE_URL);

function callerCtx(
  db: PrismaClient,
  user: { id: string; email: string; name: string; role: string; workspaceId: string },
) {
  return {
    db,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      workspaceId: user.workspaceId,
    },
    requestId: `req_idor_${user.id}`,
    clientIp: "127.0.0.1",
  };
}

describe.skipIf(!runIntegration)("idor smoke (integration)", () => {
  const prisma = new PrismaClient();
  const stamp = Date.now();

  it("workspace A cannot getById on workspace B lead", async () => {
    const ownerA = await prisma.user.create({
      data: {
        email: `idor-a-${stamp}@digitify.local`,
        name: "IDOR Owner A",
        role: "OWNER",
        passwordHash: "ci-no-login",
      },
    });
    const ownerB = await prisma.user.create({
      data: {
        email: `idor-b-${stamp}@digitify.local`,
        name: "IDOR Owner B",
        role: "OWNER",
        passwordHash: "ci-no-login",
      },
    });
    const leadB = await prisma.lead.create({
      data: {
        companyName: "Tenant B lead",
        createdById: ownerB.id,
        status: "NEW",
      },
    });

    const caller = leadRouter.createCaller(
      callerCtx(prisma, { ...ownerA, workspaceId: ownerA.id }),
    );

    await expect(caller.getById({ id: leadB.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("workspace A cannot updateDraft on workspace B Google Ads plan", async () => {
    const ownerA = await prisma.user.create({
      data: {
        email: `idor-ga-a-${stamp}@digitify.local`,
        name: "IDOR GA A",
        role: "OWNER",
        passwordHash: "ci-no-login",
      },
    });
    const ownerB = await prisma.user.create({
      data: {
        email: `idor-ga-b-${stamp}@digitify.local`,
        name: "IDOR GA B",
        role: "OWNER",
        passwordHash: "ci-no-login",
      },
    });
    const planB = await prisma.googleAdPlan.create({
      data: {
        createdById: ownerB.id,
        name: "Tenant B Google draft",
        status: "DRAFT",
      },
    });

    const caller = googleAdsRouter.createCaller(
      callerCtx(prisma, { ...ownerA, workspaceId: ownerA.id }),
    );

    await expect(caller.updateDraft({ id: planB.id, name: "Hacked" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("workspace A cannot updateDraft on workspace B Meta Ads plan", async () => {
    const ownerA = await prisma.user.create({
      data: {
        email: `idor-ma-a-${stamp}@digitify.local`,
        name: "IDOR Meta A",
        role: "OWNER",
        passwordHash: "ci-no-login",
      },
    });
    const ownerB = await prisma.user.create({
      data: {
        email: `idor-ma-b-${stamp}@digitify.local`,
        name: "IDOR Meta B",
        role: "OWNER",
        passwordHash: "ci-no-login",
      },
    });
    const planB = await prisma.metaAdPlan.create({
      data: {
        createdById: ownerB.id,
        name: "Tenant B Meta draft",
        status: "DRAFT",
      },
    });

    const caller = metaAdsRouter.createCaller(
      callerCtx(prisma, { ...ownerA, workspaceId: ownerA.id }),
    );

    await expect(caller.updateDraft({ id: planB.id, name: "Hacked" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
