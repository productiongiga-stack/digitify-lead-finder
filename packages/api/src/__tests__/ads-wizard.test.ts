import { describe, expect, it, vi } from "vitest";
import {
  adsWizardBriefSchema,
  adsWizardCreateInputSchema,
  buildAdsWizardSharedReview,
  createAdsWizardProject,
  normalizeAdsWizardBrief,
  reviewAdsWizardProject,
  saveAdsWizardProject,
  wizardIdempotencyKey,
} from "../lib/ads-wizard";
import { adsWizardRouter } from "../routers/ads-wizard.router";
import { buildNativeDraftReview, createAdsWizardNativeDraft, nativeDraftInputSchema, reviewAdsWizardNativeDraft, submitAdsWizardNativeDraftForApproval, syncAdsWizardNativeDraftStatus } from "../lib/ads-wizard-drafts";

const ctx = { user: { id: "member_1", ownerUserId: "owner_1" } };

describe("ads wizard contracts", () => {
  it("normalizes a short briefing without inventing campaign data", () => {
    expect(normalizeAdsWizardBrief({ product: "Dakrenovatie" })).toMatchObject({
      product: "Dakrenovatie",
      objective: "",
      website: "",
    });
  });

  it("rejects non-http landing pages", () => {
    expect(() => adsWizardBriefSchema.parse({ website: "javascript:alert(1)" })).toThrow();
  });

  it("requires an idempotency key for wizard creation", () => {
    expect(() => adsWizardCreateInputSchema.parse({ providerSelection: "META", brief: {} })).toThrow();
  });

  it("namespaces idempotency keys per workspace owner", () => {
    expect(wizardIdempotencyKey("owner_a", "same-key")).not.toBe(wizardIdempotencyKey("owner_b", "same-key"));
    expect(wizardIdempotencyKey("owner_a", "same-key")).toBe(wizardIdempotencyKey("owner_a", "same-key"));
  });
});

describe("ads wizard persistence", () => {
  it("reviews Meta and Google independently for a shared BOTH project", () => {
    const review = buildAdsWizardSharedReview({
      providerSelection: "BOTH",
      brief: { objective: "Leads", product: "Demo", website: "https://example.test" },
      metaPlan: { strategy: { meta: { angles: ["Demo"] } } },
      googlePlan: { strategy: { google: { keywordThemes: ["demo"] } } },
      selectedAssetIds: ["asset_shared"],
      readiness: {
        drafts: {
          META: { status: "READY", review: { status: "READY_WITH_WARNINGS", warnings: ["Pixel ontbreekt"] } },
          GOOGLE: { status: "PENDING_APPROVAL" },
        },
      },
    });
    expect(review.status).toBe("READY_WITH_WARNINGS");
    expect(review.platforms.META.status).toBe("READY_WITH_WARNINGS");
    expect(review.platforms.GOOGLE.status).toBe("READY_WITH_WARNINGS");
    expect(review.platforms.META.warnings).toContain("Pixel ontbreekt");
    expect(review.platforms.GOOGLE.warnings).toContain("De draft wacht op de bestaande approvalflow.");
  });

  it("persists shared review with optimistic locking and never calls a provider", async () => {
    const project = {
      id: "project_both", createdById: "owner_1", providerSelection: "BOTH", status: "DRAFT", revision: 5,
      brief: { objective: "Leads", product: "Demo", website: "https://example.test" },
      metaPlan: { strategy: { meta: { angles: ["Demo"] } } },
      googlePlan: { strategy: { google: { keywordThemes: ["demo"] } } },
      readiness: { drafts: { META: { status: "READY" }, GOOGLE: { status: "READY" } } }, selectedAssetIds: [],
    };
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const saved = { ...project, revision: 6 };
    const db = { adsWizardProject: { findFirst: vi.fn().mockResolvedValueOnce(project).mockResolvedValueOnce(saved), updateMany } } as any;
    const result = await reviewAdsWizardProject(db, ctx, { projectId: project.id, expectedRevision: 5 });
    expect(result.review.status).toBe("READY_WITH_WARNINGS");
    expect(result.project).toBe(saved);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ revision: 5 }), data: expect.objectContaining({ revision: { increment: 1 } }) }));
  });

  it("requires an explicit provider and optimistic revision for native drafts", () => {
    expect(() => nativeDraftInputSchema.parse({ projectId: "p", provider: "BOTH", expectedRevision: 0 })).toThrow();
    expect(nativeDraftInputSchema.parse({ projectId: "p", provider: "META", expectedRevision: 0 })).toMatchObject({ currency: "EUR" });
  });

  it("materialises a workspace-scoped Meta draft without publishing", async () => {
    const project = {
      id: "project_1", createdById: "owner_1", providerSelection: "META", status: "DRAFT", revision: 2,
      name: "Zomeractie", brief: { product: "Demo", objective: "meer leads", website: "https://example.test" },
      metaPlan: { profileHash: "profile_1", strategy: {
        summary: "Werk met een duidelijke invalshoek.", assumptions: [], unknowns: [], confidence: 72, evidenceRefs: ["briefing"],
        meta: { angles: ["Probleem"], audiences: ["Beslissers"], creativeDirections: ["Demo"], callsToAction: ["Plan gesprek"] },
      } }, readiness: {},
    };
    const created = { id: "meta_draft_1", createdById: "owner_1", status: "DRAFT" };
    const findFirst = vi.fn().mockResolvedValueOnce(project).mockResolvedValueOnce({ ...project, revision: 3 });
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const create = vi.fn().mockResolvedValue(created);
    const tx = {
      adsWizardProject: { findFirst, updateMany },
      metaAdPlan: { findFirst: vi.fn().mockResolvedValue(null), create },
      googleAdPlan: { findFirst: vi.fn() },
    };
    const db = { $transaction: (callback: (value: typeof tx) => unknown) => callback(tx) } as any;
    const result = await createAdsWizardNativeDraft(db, { user: { id: "member_1", ownerUserId: "owner_1" } }, {
      projectId: "project_1", provider: "META", expectedRevision: 2,
    });
    expect(result).toMatchObject({ provider: "META", reused: false, draft: created });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ createdById: "owner_1", status: "DRAFT" }) }));
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ revision: 2 }) }));
  });

  it("does not create a second native draft when the wizard already points to one", async () => {
    const project = { id: "project_1", createdById: "owner_1", providerSelection: "GOOGLE", status: "DRAFT", revision: 3, readiness: { drafts: { GOOGLE: { status: "READY", draftId: "google_draft_1", missing: ["Budget"] } } } };
    const existing = { id: "google_draft_1", createdById: "owner_1", status: "DRAFT" };
    const googleFind = vi.fn().mockResolvedValue(existing);
    const tx = { adsWizardProject: { findFirst: vi.fn().mockResolvedValue(project) }, metaAdPlan: { findFirst: vi.fn() }, googleAdPlan: { findFirst: googleFind, create: vi.fn() } };
    const db = { $transaction: (callback: (value: typeof tx) => unknown) => callback(tx) } as any;
    const result = await createAdsWizardNativeDraft(db, { user: { id: "member_1", ownerUserId: "owner_1" } }, { projectId: "project_1", provider: "GOOGLE", expectedRevision: 3 });
    expect(result).toMatchObject({ reused: true, draft: existing });
    expect(tx.googleAdPlan.create).not.toHaveBeenCalled();
  });

  it("materialises the bounded Google Search plan into the local draft", async () => {
    const project = {
      id: "project_search", createdById: "owner_1", providerSelection: "GOOGLE", status: "DRAFT", revision: 1,
      name: "Search concept", brief: { product: "Demo", objective: "meer leads", website: "https://example.test" },
      googlePlan: {
        profileHash: "profile_1",
        strategy: { summary: "Search", assumptions: [], unknowns: [], confidence: 70, evidenceRefs: [], google: { keywordThemes: ["fallback"], adGroups: ["Fallback"], headlineDirections: ["Heldere actie"], negativeKeywordThemes: [] } },
        searchPlan: {
          campaignType: "SEARCH", finalUrl: "https://example.test", sourceStatus: "AI_SUGGESTIONS", confidence: 70, summary: "Plan", assumptions: [], unknowns: [], evidenceRefs: [], generatedAt: new Date().toISOString(),
          adGroups: [{ id: "group-1", name: "Demo", theme: "Demo", keywords: [{ text: "demo aanvragen", matchType: "PHRASE", source: "AI_SUGGESTION", evidenceRefs: [] }], negativeKeywords: [], headlines: ["Meer demo's", "Plan gesprek", "Bekijk aanpak"], descriptions: ["Vraag een demo aan.", "Ontdek de mogelijkheden."], path1: "demo", path2: "start" }],
        },
      }, readiness: {},
    };
    const create = vi.fn().mockResolvedValue({ id: "google_draft_search", createdById: "owner_1", status: "DRAFT" });
    const tx = {
      adsWizardProject: { findFirst: vi.fn().mockResolvedValueOnce(project).mockResolvedValueOnce({ ...project, revision: 2 }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      metaAdPlan: { findFirst: vi.fn() },
      googleAdPlan: { findFirst: vi.fn().mockResolvedValue(null), create },
    };
    const db = { $transaction: (callback: (value: typeof tx) => unknown) => callback(tx) } as any;
    await createAdsWizardNativeDraft(db, ctx, { projectId: "project_search", provider: "GOOGLE", expectedRevision: 1 });
    const data = create.mock.calls[0]?.[0]?.data;
    expect(data.targeting.keywords).toEqual(["demo aanvragen"]);
    expect(data.targeting.adGroupName).toBe("Demo");
    expect(data.creatives.headlines).toEqual(["Meer demo's", "Plan gesprek", "Bekijk aanpak"]);
    expect(data.creatives.finalUrl).toBe("https://example.test");
  });

  it("materialises a PMax plan as a local paused-ready draft without a provider call", async () => {
    const pmax = {
      campaignType: "PERFORMANCE_MAX", campaignName: "PMax concept", assetGroupName: "Hoofdgroep", finalUrl: "https://example.test",
      conversionGoal: "Aanvraag", biddingStrategy: "MAXIMIZE_CONVERSIONS", businessName: "Workspace BV",
      headlines: ["Ontdek onze aanpak", "Plan een gesprek", "Start vandaag"], longHeadlines: ["Een duidelijke volgende stap"],
      descriptions: ["Bekijk de mogelijkheden.", "Vraag informatie aan."], searchThemes: ["aanpak"], audienceSignals: ["beslissers"],
      geoTargetConstants: [], languageConstants: [], brandGuidelinesEnabled: false,
      assets: [
        { id: "landscape", role: "LANDSCAPE", url: "https://cdn.example/landscape.jpg", source: "LIBRARY", evidenceRefs: ["media:landscape"] },
        { id: "square", role: "SQUARE", url: "https://cdn.example/square.jpg", source: "LIBRARY", evidenceRefs: ["media:square"] },
        { id: "logo", role: "LOGO", url: "https://cdn.example/logo.png", source: "LIBRARY", evidenceRefs: ["media:logo"] },
      ], summary: "PMax plan", assumptions: [], unknowns: [], confidence: 70, evidenceRefs: [], sourceStatus: "MIXED", generatedAt: new Date().toISOString(),
    };
    const project = {
      id: "project_pmax", createdById: "owner_1", providerSelection: "GOOGLE", status: "DRAFT", revision: 1,
      name: "PMax concept", brief: { product: "Demo", objective: "meer leads", website: "https://example.test" },
      googlePlan: {
        profileHash: "profile_1",
        strategy: { summary: "PMax", assumptions: [], unknowns: [], confidence: 70, evidenceRefs: [], google: { keywordThemes: [], adGroups: [], headlineDirections: ["Heldere copy"], negativeKeywordThemes: [] } },
        performanceMaxPlan: pmax,
      }, readiness: {},
    };
    const create = vi.fn().mockResolvedValue({ id: "google_draft_pmax", createdById: "owner_1", status: "DRAFT", campaignType: "PERFORMANCE_MAX" });
    const tx = {
      adsWizardProject: { findFirst: vi.fn().mockResolvedValueOnce(project).mockResolvedValueOnce({ ...project, revision: 2 }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      mediaGeneration: { findMany: vi.fn().mockResolvedValue([]) },
      metaAdPlan: { findFirst: vi.fn() },
      googleAdPlan: { findFirst: vi.fn().mockResolvedValue(null), create },
    };
    const db = { $transaction: (callback: (value: typeof tx) => unknown) => callback(tx) } as any;
    await createAdsWizardNativeDraft(db, ctx, { projectId: "project_pmax", provider: "GOOGLE", expectedRevision: 1 });
    const data = create.mock.calls[0]?.[0]?.data;
    expect(data.campaignType).toBe("PERFORMANCE_MAX");
    expect(data.creatives.imageUrl).toBe("https://cdn.example/landscape.jpg");
    expect(data.creatives.squareImageUrl).toBe("https://cdn.example/square.jpg");
    expect(data.creatives.logoUrl).toBe("https://cdn.example/logo.png");
    expect(data.targeting.campaignSettings.biddingStrategy).toBe("MAXIMIZE_CONVERSIONS");
  });

  it("materialises only workspace-scoped durable media into a Meta draft", async () => {
    const project = {
      id: "project_media", createdById: "owner_1", providerSelection: "META", status: "DRAFT", revision: 1,
      name: "Media concept", selectedAssetIds: ["asset_1"], brief: { product: "Demo", objective: "meer leads", website: "https://example.test" },
      metaPlan: { profileHash: "profile_1", strategy: { summary: "Meta", assumptions: [], unknowns: [], confidence: 70, evidenceRefs: [], meta: { angles: ["Demo"], audiences: ["Beslissers"], creativeDirections: ["Heldere visual"], callsToAction: ["Plan gesprek"] } } }, readiness: {},
    };
    const create = vi.fn().mockResolvedValue({ id: "meta_draft_media", createdById: "owner_1", status: "DRAFT" });
    const tx = {
      adsWizardProject: { findFirst: vi.fn().mockResolvedValueOnce(project).mockResolvedValueOnce({ ...project, revision: 2 }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      mediaGeneration: { findMany: vi.fn().mockResolvedValue([{ id: "asset_1", type: "IMAGE", blobUrl: "https://cdn.example/image.jpg" }]) },
      metaAdPlan: { findFirst: vi.fn().mockResolvedValue(null), create },
      googleAdPlan: { findFirst: vi.fn() },
    };
    const db = { $transaction: (callback: (value: typeof tx) => unknown) => callback(tx) } as any;
    await createAdsWizardNativeDraft(db, { user: { id: "member_1", ownerUserId: "owner_1", workspaceId: "workspace_a" } }, { projectId: "project_media", provider: "META", expectedRevision: 1 });
    const data = create.mock.calls[0]?.[0]?.data;
    expect(data.creatives.feedImageUrl).toBe("https://cdn.example/image.jpg");
    expect(data.creatives.selectedMedia).toEqual([{ id: "asset_1", type: "IMAGE", blobUrl: "https://cdn.example/image.jpg" }]);
  });

  it("blocks a project from another workspace before any provider draft is created", async () => {
    const create = vi.fn();
    const tx = {
      adsWizardProject: { findFirst: vi.fn().mockResolvedValue(null) },
      metaAdPlan: { findFirst: vi.fn(), create },
      googleAdPlan: { findFirst: vi.fn(), create: vi.fn() },
    };
    const db = { $transaction: (callback: (value: typeof tx) => unknown) => callback(tx) } as any;
    await expect(createAdsWizardNativeDraft(db, { user: { id: "member_b", ownerUserId: "owner_b" } }, {
      projectId: "project_a", provider: "META", expectedRevision: 0,
    })).rejects.toThrow(/niet gevonden in deze workspace/i);
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects selected media from another workspace before saving the wizard", async () => {
    const db = {
      adsWizardProject: { findFirst: vi.fn().mockResolvedValue({ id: "project_1", createdById: "owner_1", status: "DRAFT", revision: 1 }) },
      mediaGeneration: { findMany: vi.fn().mockResolvedValue([]) },
    } as any;
    await expect(saveAdsWizardProject(db, { user: { id: "member_1", ownerUserId: "owner_1", workspaceId: "workspace_a" } }, {
      id: "project_1", expectedRevision: 1, selectedAssetIds: ["asset_from_b"],
    })).rejects.toThrow(/niet bij deze workspace/i);
    expect(db.adsWizardProject.updateMany).toBeUndefined();
  });

  it("lists only completed durable media for the active workspace", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "asset_1", type: "IMAGE", blobUrl: "https://cdn.example/asset.jpg" }]);
    const caller = adsWizardRouter.createCaller({
      db: { mediaGeneration: { findMany } } as any,
      user: { id: "member_1", ownerUserId: "owner_1", workspaceId: "workspace_a", role: "MEMBER" },
      requestId: "req_assets_test",
    } as any);
    await caller.listAssets();
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ workspaceId: "workspace_a", status: "COMPLETED", blobUrl: { not: null } }) }));
  });

  it("reports actionable Google draft blockers without calling a provider", () => {
    const review = buildNativeDraftReview("GOOGLE", {
      name: "Search draft",
      dailyBudgetCents: null,
      lifetimeBudgetCents: null,
      targeting: { keywords: [] },
      creatives: { finalUrl: "http://example.test", headlines: ["Te korte set"], descriptions: ["Een beschrijving"] },
    });
    expect(review.status).toBe("BLOCKED");
    expect(review.blockingIssues).toEqual(expect.arrayContaining([
      expect.stringMatching(/budget/i),
      expect.stringMatching(/advertentieaccount/i),
      expect.stringMatching(/https/i),
    ]));
  });

  it("persists a draft review with optimistic locking", async () => {
    const project = { id: "project_1", createdById: "owner_1", status: "DRAFT", revision: 4, readiness: { drafts: { GOOGLE: { status: "READY", draftId: "google_1" } } } };
    const draft = { id: "google_1", createdById: "owner_1", name: "Search", dailyBudgetCents: 1000, lifetimeBudgetCents: null, targeting: { keywords: ["demo"] }, creatives: { finalUrl: "https://example.test", headlines: ["Een", "Twee", "Drie"], descriptions: ["Een beschrijving", "Nog een beschrijving"] } };
    const findFirst = vi.fn().mockResolvedValueOnce(project).mockResolvedValueOnce({ ...project, revision: 5 });
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const db = { adsWizardProject: { findFirst, updateMany }, googleAdPlan: { findFirst: vi.fn().mockResolvedValue(draft) }, metaAdPlan: { findFirst: vi.fn() } } as any;
    const result = await reviewAdsWizardNativeDraft(db, { user: { id: "member_1", ownerUserId: "owner_1" } }, { projectId: "project_1", provider: "GOOGLE", expectedRevision: 4 });
    expect(result.review.status).toBe("BLOCKED"); // account selection remains an explicit provider action
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ revision: 4 }) }));
  });

  it("requires a fresh review before submitting a draft for approval", async () => {
    const project = { id: "project_1", createdById: "owner_1", status: "DRAFT", revision: 2, readiness: { drafts: { GOOGLE: { status: "READY", draftId: "google_1", review: { status: "BLOCKED" } } } } };
    const findProject = vi.fn().mockResolvedValue(project);
    const findDraft = vi.fn().mockResolvedValue({ id: "google_1", status: "DRAFT", updatedAt: new Date() });
    const tx = { adsWizardProject: { findFirst: findProject }, googleAdPlan: { findFirst: findDraft }, metaAdPlan: { findFirst: vi.fn() }, activity: { create: vi.fn() } };
    const db = { $transaction: (callback: (value: typeof tx) => unknown) => callback(tx) } as any;
    Object.assign(db, { adsWizardProject: tx.adsWizardProject, googleAdPlan: tx.googleAdPlan, metaAdPlan: tx.metaAdPlan });
    await expect(submitAdsWizardNativeDraftForApproval(db, { user: { id: "member_1", ownerUserId: "owner_1" } }, { projectId: "project_1", provider: "GOOGLE", expectedRevision: 2 })).rejects.toThrow(/blokkerende punten/i);
    expect(tx.activity.create).not.toHaveBeenCalled();
  });

  it("submits a reviewed native draft without publishing to a provider", async () => {
    const updatedAt = new Date();
    const project = {
      id: "project_1", createdById: "owner_1", status: "DRAFT", revision: 2,
      readiness: { drafts: { GOOGLE: { status: "READY", draftId: "google_1", review: { status: "READY", draftUpdatedAt: updatedAt.toISOString() } } } },
    };
    const draft = { id: "google_1", createdById: "owner_1", status: "DRAFT", updatedAt };
    const savedProject = { ...project, revision: 3 };
    const updatedDraft = { ...draft, status: "PENDING_APPROVAL" };
    const activityCreate = vi.fn().mockResolvedValue({ id: "activity_1" });
    const tx = {
      adsWizardProject: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), findFirst: vi.fn().mockResolvedValue(savedProject) },
      googleAdPlan: { update: vi.fn().mockResolvedValue(updatedDraft) },
      metaAdPlan: { update: vi.fn() },
      activity: { create: activityCreate },
    };
    const db = {
      adsWizardProject: { findFirst: vi.fn().mockResolvedValue(project) },
      googleAdPlan: { findFirst: vi.fn().mockResolvedValue(draft) },
      metaAdPlan: { findFirst: vi.fn() },
      $transaction: (callback: (value: typeof tx) => unknown) => callback(tx),
    } as any;
    const result = await submitAdsWizardNativeDraftForApproval(db, { user: { id: "member_1", ownerUserId: "owner_1" } }, {
      projectId: "project_1", provider: "GOOGLE", expectedRevision: 2,
    });
    expect(result).toMatchObject({ reused: false, draft: updatedDraft, project: savedProject });
    expect(tx.googleAdPlan.update).toHaveBeenCalledWith({ where: { id: "google_1" }, data: { status: "PENDING_APPROVAL", lastError: null } });
    expect(activityCreate).toHaveBeenCalledOnce();
  });

  it("mirrors an approval result back into the wizard without a provider call", async () => {
    const project = {
      id: "project_1", createdById: "owner_1", status: "READY", revision: 5,
      readiness: { drafts: { META: { status: "READY", draftId: "meta_1", approval: { status: "PENDING" } } } },
    };
    const updatedProject = { ...project, revision: 6 };
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const db = {
      adsWizardProject: { findFirst: vi.fn().mockResolvedValueOnce(project).mockResolvedValueOnce(updatedProject), updateMany },
      metaAdPlan: { findFirst: vi.fn().mockResolvedValue({ id: "meta_1", createdById: "owner_1", status: "APPROVED" }) },
      googleAdPlan: { findFirst: vi.fn() },
    } as any;
    const result = await syncAdsWizardNativeDraftStatus(db, { user: { id: "member_1", ownerUserId: "owner_1" } }, {
      projectId: "project_1", provider: "META", expectedRevision: 5,
    });
    expect(result).toMatchObject({ changed: true, project: updatedProject, draft: { status: "APPROVED" } });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ revision: 5 }) }));
    expect(updateMany.mock.calls[0]?.[0].data.readiness).toMatchObject({ drafts: { META: { providerStatus: "APPROVED", approval: { status: "APPROVED" } } } });
  });

  it("scopes reads to the active workspace owner", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const caller = adsWizardRouter.createCaller({
      db: { adsWizardProject: { findMany } } as any,
      user: { id: "member_1", ownerUserId: "owner_1", workspaceId: "workspace_a", role: "MEMBER" },
      requestId: "req_wizard_test",
    } as any);
    await caller.list();
    // The reduced test context falls back to its active workspace id. The
    // production tenant resolver supplies the workspace owner for legacy
    // createdById records.
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ createdById: "workspace_a" }) }));
  });

  it("reuses a concurrent create instead of creating a duplicate", async () => {
    const existing = { id: "project_1", createdById: "owner_1", revision: 0 };
    const db = {
      adsWizardProject: {
        findFirst: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(existing),
        create: vi.fn().mockRejectedValue({ code: "P2002" }),
      },
    } as any;
    const result = await createAdsWizardProject(db, ctx, { providerSelection: "META", brief: {}, idempotencyKey: "same-key-123" });
    expect(result).toBe(existing);
    expect(db.adsWizardProject.create).toHaveBeenCalledOnce();
  });

  it("rejects a stale revision without overwriting the newer project", async () => {
    const db = {
      adsWizardProject: {
        findFirst: vi.fn().mockResolvedValue({ id: "project_1", createdById: "owner_1", status: "DRAFT", revision: 2 }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    } as any;
    await expect(saveAdsWizardProject(db, ctx, {
      id: "project_1",
      expectedRevision: 1,
      brief: {},
    })).rejects.toThrow(/ander tabblad gewijzigd/i);
    expect(db.adsWizardProject.updateMany).toHaveBeenCalledOnce();
  });
});
