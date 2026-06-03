import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/meta-ads", async (importActual) => {
  const actual = await importActual<typeof import("../lib/meta-ads")>();
  return {
    ...actual,
    loadMetaAdsWorkspaceConfig: vi.fn(),
    pushPausedMetaAdPlan: vi.fn(),
    listMetaAdAccounts: vi.fn(),
    listMetaCampaigns: vi.fn(),
    getMetaInsights: vi.fn(),
    getMetaCampaign: vi.fn(),
  };
});

import * as metaAdsLib from "../lib/meta-ads";
import { metaAdsRouter } from "../routers/meta-ads.router";

const TEST_USER_ID = "user_owner";

function makeCtx(db: Record<string, unknown>, role = "OWNER") {
  return {
    db: {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: TEST_USER_ID, role, workspaceOwnerId: null }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      setting: { findMany: vi.fn().mockResolvedValue([]), upsert: vi.fn() },
      ...db,
    } as any,
    user: {
      id: TEST_USER_ID,
      email: "owner@example.com",
      name: "Owner",
      role,
      workspaceId: TEST_USER_ID,
    },
    requestId: "req_meta_ads_test",
  };
}

const baseConfig = {
  appId: "app",
  appSecret: "secret",
  pageId: "page_1",
  instagramBusinessId: "ig_1",
  accessToken: "token",
  refreshMeta: "",
  pageAccessToken: "page-token",
  tokenExpiresAt: "",
  autopostEnabled: true,
  adAccountId: "act_123",
  businessId: "biz_1",
  autoadsEnabled: true,
  defaultCurrency: "EUR",
  maxDailyBudgetCents: 5000,
};

describe("metaAds router flow", () => {
  beforeEach(() => {
    vi.mocked(metaAdsLib.loadMetaAdsWorkspaceConfig).mockResolvedValue(baseConfig);
    vi.mocked(metaAdsLib.listMetaCampaigns).mockResolvedValue([]);
    vi.mocked(metaAdsLib.pushPausedMetaAdPlan).mockResolvedValue({
      campaignId: "cmp_1",
      adsetId: "adset_1",
      adsetIds: ["adset_1", "adset_2"],
      creativeId: "creative_1",
      adId: "ad_1",
      adIds: ["ad_1", "ad_2"],
      status: "PAUSED",
    });
  });

  it("creates draft, submits, approves and pushes paused", async () => {
    const row = {
      id: "plan_1",
      createdById: TEST_USER_ID,
      name: "Test campaign",
      objective: "OUTCOME_TRAFFIC",
      dailyBudgetCents: 2500,
      lifetimeBudgetCents: null,
      currency: "EUR",
      targeting: {},
      creatives: { linkUrl: "https://example.com" },
      status: "DRAFT",
      retryCount: 0,
    };

    const create = vi.fn().mockResolvedValue(row);
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce(row)
      .mockResolvedValueOnce({ ...row, status: "PENDING_APPROVAL" })
      .mockResolvedValueOnce({ ...row, status: "APPROVED" });
    const update = vi
      .fn()
      .mockResolvedValueOnce({ ...row, status: "PENDING_APPROVAL" })
      .mockResolvedValueOnce({ ...row, status: "APPROVED" })
      .mockResolvedValueOnce({ ...row, status: "PUSHING" })
      .mockResolvedValueOnce({ ...row, status: "PUSHED_PAUSED", externalIds: { campaignId: "cmp_1" } });

    const caller = metaAdsRouter.createCaller(
      makeCtx({
        metaAdPlan: { create, findUnique, findMany: vi.fn().mockResolvedValue([]), update },
        activity: { create: vi.fn().mockResolvedValue({ id: "act_1" }) },
      }),
    );

    const created = await caller.createDraft({
      name: "Test campaign",
      objective: "OUTCOME_TRAFFIC",
      dailyBudgetCents: 2500,
      currency: "EUR",
      targeting: {},
      creatives: { linkUrl: "https://example.com" },
    });
    expect(created.id).toBe("plan_1");

    const submitted = await caller.submitForApproval({ id: "plan_1" });
    expect(submitted.status).toBe("PENDING_APPROVAL");

    const approved = await caller.approveDraft({ id: "plan_1" });
    expect(approved.status).toBe("APPROVED");

    const pushed = await caller.pushPausedToMeta({ id: "plan_1" });
    expect(pushed.status).toBe("PUSHED_PAUSED");
    expect(metaAdsLib.pushPausedMetaAdPlan).toHaveBeenCalledWith(expect.objectContaining({ config: baseConfig }));
  });

  it("blocks approval when budget exceeds workspace guard", async () => {
    const row = {
      id: "plan_budget",
      createdById: TEST_USER_ID,
      name: "Too expensive",
      status: "PENDING_APPROVAL",
      dailyBudgetCents: 99_999,
      lifetimeBudgetCents: null,
      retryCount: 0,
    };

    const caller = metaAdsRouter.createCaller(
      makeCtx({
        metaAdPlan: { findUnique: vi.fn().mockResolvedValue(row), update: vi.fn() },
        activity: { create: vi.fn().mockResolvedValue({ id: "act_2" }) },
      }),
    );

    await expect(caller.approveDraft({ id: "plan_budget" })).rejects.toThrow(/Budget guard/i);
  });

  it("accepts expanded Meta outcome objectives from the wizard", async () => {
    const create = vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "plan_sales", ...data }));
    const caller = metaAdsRouter.createCaller(
      makeCtx({
        metaAdPlan: { create, findMany: vi.fn().mockResolvedValue([]) },
        activity: { create: vi.fn().mockResolvedValue({ id: "act_3" }) },
      }),
    );

    const created = await caller.createDraft({
      name: "Sales wizard campaign",
      objective: "OUTCOME_SALES",
      dailyBudgetCents: 2500,
      currency: "EUR",
      targeting: { campaignSettings: { optimizationGoal: "OFFSITE_CONVERSIONS" } },
      creatives: { linkUrl: "https://example.com" },
    });

    expect(created.objective).toBe("OUTCOME_SALES");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ objective: "OUTCOME_SALES" }) }));
  });

  it("blocks duplicate campaign names across drafts and live Meta", async () => {
    vi.mocked(metaAdsLib.listMetaCampaigns).mockResolvedValue([{ id: "cmp_live", name: "Live campagne" }] as any);

    const caller = metaAdsRouter.createCaller(
      makeCtx({
        metaAdPlan: {
          findMany: vi
            .fn()
            .mockResolvedValueOnce([{ id: "plan_2", name: "Existing draft", status: "APPROVED" }])
            .mockResolvedValueOnce([]),
          create: vi.fn(),
        },
        activity: { create: vi.fn().mockResolvedValue({ id: "act_4" }) },
      }),
    );

    await expect(
      caller.createDraft({
        name: "Existing draft",
        objective: "OUTCOME_TRAFFIC",
        dailyBudgetCents: 2500,
        currency: "EUR",
        targeting: {},
        creatives: {},
      }),
    ).rejects.toThrow(/bestaat al/i);

    await expect(
      caller.createDraft({
        name: "Live campagne",
        objective: "OUTCOME_TRAFFIC",
        dailyBudgetCents: 2500,
        currency: "EUR",
        targeting: {},
        creatives: {},
      }),
    ).rejects.toThrow(/live Meta/i);
  });
});

describe("meta ads helpers", () => {
  it("normalizes ad account IDs", () => {
    expect(metaAdsLib.normalizeAdAccountId("123")).toBe("act_123");
    expect(metaAdsLib.normalizeAdAccountId("act_456")).toBe("act_456");
  });

  it("requires a budget and enforces max", () => {
    expect(() => metaAdsLib.validateBudgetGuard({ dailyBudgetCents: 2500 }, 5000)).not.toThrow();
    expect(() => metaAdsLib.validateBudgetGuard({ dailyBudgetCents: 6000 }, 5000)).toThrow(/Budget guard/i);
  });
});
