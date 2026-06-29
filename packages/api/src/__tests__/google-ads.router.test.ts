import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/google-ads", async (importActual) => {
  const actual = await importActual<typeof import("../lib/google-ads")>();
  return {
    ...actual,
    pushPausedGoogleAdPlan: vi.fn(),
    listGoogleAdCustomers: vi.fn(),
    listGoogleCampaigns: vi.fn(),
    getGoogleAdsInsights: vi.fn(),
    updateGoogleCampaignStatus: vi.fn(),
    removeGoogleCampaign: vi.fn(),
    updateGoogleCampaignName: vi.fn(),
    getGoogleCampaignDetails: vi.fn(),
    updateGoogleCampaignFromPlan: vi.fn(),
    loadGoogleAdsWorkspaceConfig: vi.fn(),
  };
});

import * as googleAdsLib from "../lib/google-ads";
import { defaultSearchTargeting, formatGoogleAdsError } from "../lib/google-ads";
import { googleAdsRouter } from "../routers/google-ads.router";

const TEST_USER_ID = "ws_1";

function planDb(delegate: Record<string, unknown>) {
  const findUnique = delegate.findUnique as ReturnType<typeof vi.fn> | undefined;
  return { ...delegate, findFirst: delegate.findFirst ?? findUnique };
}

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
      id: "user_1",
      email: "owner@example.com",
      name: "Owner",
      role,
      workspaceId: TEST_USER_ID,
    },
    requestId: "req_google_ads_test",
  };
}

const baseConfig = {
  clientId: "client",
  clientSecret: "secret",
  developerToken: "dev-token",
  refreshToken: "refresh",
  accessToken: "access",
  accountEmail: "test@example.com",
  customerId: "1234567890",
  loginCustomerId: "",
  autoadsEnabled: true,
  defaultCurrency: "EUR",
  maxDailyBudgetCents: 5000,
};

describe("googleAds router flow", () => {
  beforeEach(() => {
    vi.mocked(googleAdsLib.loadGoogleAdsWorkspaceConfig).mockResolvedValue(baseConfig as any);
    vi.mocked(googleAdsLib.pushPausedGoogleAdPlan).mockResolvedValue({
      campaignResourceName: "customers/123/campaigns/1",
      adGroupResourceName: "customers/123/adGroups/1",
      status: "PAUSED",
    });
  });

  it("runs approval and push flow", async () => {
    const row = {
      id: "plan_1",
      createdById: TEST_USER_ID,
      name: "Test",
      campaignType: "SEARCH",
      status: "DRAFT",
      dailyBudgetCents: 2500,
      currency: "EUR",
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
      .mockResolvedValueOnce({ ...row, status: "PUSHED_PAUSED", externalIds: { campaignResourceName: "customers/1/campaigns/1" } });

    const caller = googleAdsRouter.createCaller(
      makeCtx({
        googleAdPlan: planDb({ create, findUnique, update }),
        activity: { create: vi.fn().mockResolvedValue({ id: "act_1" }) },
      }),
    );

    const draft = await caller.createDraft({
      name: "Digitify Search",
      campaignType: "SEARCH",
      dailyBudgetCents: 2500,
      creatives: { finalUrl: "https://example.com", headlines: ["H1", "H2", "H3"], descriptions: ["D1", "D2"] },
      targeting: { keywords: ["leads belgie"] },
    });
    expect(draft.id).toBe("plan_1");

    const submitted = await caller.submitForApproval({ id: "plan_1" });
    expect(submitted.status).toBe("PENDING_APPROVAL");

    const approved = await caller.approveDraft({ id: "plan_1" });
    expect(approved.status).toBe("APPROVED");

    const pushed = await caller.pushPausedToGoogle({ id: "plan_1" });
    expect(pushed.status).toBe("PUSHED_PAUSED");
    expect(googleAdsLib.pushPausedGoogleAdPlan).toHaveBeenCalled();
  });

  it("reports missing operational requirements in connection status", async () => {
    vi.mocked(googleAdsLib.loadGoogleAdsWorkspaceConfig).mockResolvedValue({
      ...baseConfig,
      refreshToken: "",
      customerId: "",
      autoadsEnabled: false,
    } as any);

    const caller = googleAdsRouter.createCaller(
      makeCtx({
        googleAdAccount: { findFirst: vi.fn().mockResolvedValue(null) },
      }),
    );

    const status = await caller.connectionStatus();
    expect(status.missingOperationalRequirements).toContain("GOOGLE_OAUTH_MISSING");
    expect(status.missingOperationalRequirements).toContain("GOOGLE_CUSTOMER_NOT_SELECTED");
    expect(status.missingOperationalRequirements).toContain("GOOGLE_AUTOMATION_DISABLED");
  });

  it("explains deprecated Google Ads API version errors", () => {
    const message = formatGoogleAdsError(
      new Error("Version v20 is deprecated. Requests to this version will be blocked. — request_error: 38"),
    );

    expect(message).toContain("Google Ads API client library is verouderd");
    expect(message).toContain("google-ads-api v24+");
  });

  it("fails listCampaigns clearly when no customer is selected", async () => {
    vi.mocked(googleAdsLib.loadGoogleAdsWorkspaceConfig).mockResolvedValue({
      ...baseConfig,
      customerId: "",
    } as any);

    const caller = googleAdsRouter.createCaller(makeCtx({}));

    await expect(caller.listCampaigns()).rejects.toThrow("Selecteer eerst een Google Ads customer");
  });

  it("pauses and resumes a live Google campaign", async () => {
    vi.mocked(googleAdsLib.updateGoogleCampaignStatus)
      .mockResolvedValueOnce({ campaignId: "123", status: "PAUSED" })
      .mockResolvedValueOnce({ campaignId: "123", status: "ENABLED" });

    const caller = googleAdsRouter.createCaller(makeCtx({}));

    await expect(caller.pauseInGoogle({ campaignId: "123" })).resolves.toEqual({
      campaignId: "123",
      status: "PAUSED",
    });
    await expect(caller.resumeInGoogle({ campaignId: "123" })).resolves.toEqual({
      campaignId: "123",
      status: "ENABLED",
    });
  });

  it("loads and saves live campaign details", async () => {
    vi.mocked(googleAdsLib.getGoogleCampaignDetails).mockResolvedValue({
      campaignId: "123",
      name: "Live campagne",
      status: "PAUSED",
      campaignType: "SEARCH",
      dailyBudgetCents: 2500,
      currency: "EUR",
      targeting: defaultSearchTargeting(undefined),
      creatives: {
        finalUrl: "https://example.com",
        headlines: ["H1", "H2", "H3"],
        descriptions: ["D1", "D2"],
      },
      resources: {
        campaignResourceName: "customers/123/campaigns/1",
        campaignBudgetResourceName: "customers/123/campaignBudgets/1",
        keywordCriteria: [],
        campaignCriteria: [],
        textAssets: [],
      },
    } as any);
    vi.mocked(googleAdsLib.updateGoogleCampaignFromPlan).mockResolvedValue({
      campaignId: "123",
      status: "ENABLED",
    });

    const caller = googleAdsRouter.createCaller(
      makeCtx({
        activity: { create: vi.fn().mockResolvedValue({ id: "act_1" }) },
      }),
    );

    const details = await caller.getCampaignDetails({ campaignId: "123" });
    expect(details.name).toBe("Live campagne");

    const saved = await caller.saveCampaignToGoogle({
      campaignId: "123",
      name: "Live campagne",
      campaignType: "SEARCH",
      dailyBudgetCents: 2500,
      publishStatus: "ENABLED",
      creatives: { finalUrl: "https://example.com", headlines: ["H1", "H2", "H3"], descriptions: ["D1", "D2"] },
      targeting: { keywords: ["leads belgie"] },
    });
    expect(saved.status).toBe("ENABLED");
    expect(googleAdsLib.updateGoogleCampaignFromPlan).toHaveBeenCalled();
  });
});
