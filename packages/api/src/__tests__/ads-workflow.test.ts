import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../lib/ads-workflow-providers", () => ({
  readAdCampaign: vi.fn(), adProviderConfig: vi.fn(), publishAdChanges: vi.fn(), readAdAccount: vi.fn(),
}));
import * as providers from "../lib/ads-workflow-providers";
import { applyAdChange, createAdChange, decideAdChange, prepareMetaReplacementSwitch, safeAdError } from "../lib/ads-workflow";
import { applyPatches, checkBudgetChange, editablePath, fingerprint, validateSnapshot } from "../lib/ads-workflow-policy";

const before = { campaignId: "123", name: "Campagne", campaignType: "SEARCH", dailyBudgetCents: 1000,
  creatives: { finalUrl: "https://example.com", headlines: ["Headline 1", "Headline 2", "Headline 3"], descriptions: ["Beschrijving 1", "Beschrijving 2"] },
  targeting: { keywords: ["website"], campaignSettings: {} }, status: "PAUSED" };
const after = { ...before, name: "Nieuwe campagne" };

function dbMock(status = "APPROVED") {
  const row = { id: "change", createdById: "owner", provider: "GOOGLE", accountId: "account", campaignId: "123",
    before, after, beforeHash: fingerprint(before), afterHash: fingerprint(after), status };
  const db: any = {
    adChangeSet: { findFirst: vi.fn(async (args) => args.where.createdById === "owner" ? row : null),
      updateMany: vi.fn(async () => ({ count: 1 })), create: vi.fn(async ({ data }) => ({ ...data, id: "new-change" })) },
    adApprovalRequest: { findFirst: vi.fn(async () => ({ versionHash: fingerprint(after), status: "APPROVED" })),
      create: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({ count: 1 })) },
    adSyncOperation: { findFirst: vi.fn(async () => null), create: vi.fn(async ({ data }) => ({ ...data, id: "operation" })),
      updateMany: vi.fn(async () => ({ count: 1 })) },
    adVersion: { create: vi.fn(async ({ data }) => ({ ...data, id: "version" })),
      findFirst: vi.fn(async ({ where }) => where.createdById === "owner" ? { id: "version", createdById: "owner",
        accountId: "account", campaignId: "123", snapshot: before, fingerprint: fingerprint(before) } : null) },
    setting: { findMany: vi.fn(async () => []) },
  };
  db.$transaction = async (fn: any) => fn(db);
  return db;
}

describe("advertentie-wijzigingsbeleid", () => {
  it("maakt een afzonderlijk versiegebonden goedkeuringsvoorstel voor Meta-overstap", async () => {
    const snapshot = { campaign: { id: "123", name: "Meta campagne" }, adsets: [{ id: "set", name: "Set", ads: [
      { id: "old", name: "Oud", status: "ACTIVE" }, { id: "new", name: "Nieuw", status: "PAUSED" },
    ] }] };
    const db = dbMock();
    db.adChangeSet.findFirst.mockResolvedValue({ id: "published", campaignId: "123", accountId: "account" });
    db.adSyncOperation.findFirst.mockResolvedValue({ response: { journal: [{ objectId: "old", replacementAdId: "new", action: "CREATE_PAUSED_REPLACEMENT" }] } });
    db.adVersion.create.mockImplementation(async ({ data }: any) => ({ ...data, id: "meta-version" }));
    db.adVersion.findFirst.mockResolvedValue({ id: "meta-version", snapshot, fingerprint: fingerprint(snapshot), accountId: "account", campaignId: "123" });
    vi.mocked(providers.readAdCampaign).mockResolvedValue({ accountId: "account", snapshot });
    const proposal = await prepareMetaReplacementSwitch(db, "owner", "admin", "published");
    expect(proposal.source).toBe("REPLACEMENT_SWITCH");
    expect(proposal.after.adsets[0].ads.map((ad: any) => ad.status)).toEqual(["PAUSED", "ACTIVE"]);
    expect(db.adApprovalRequest.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ versionHash: proposal.afterHash }) }));
    expect(providers.publishAdChanges).not.toHaveBeenCalled();
  });
  it("maskert tokens in JSON, URLs en Authorization-fouten", () => {
    const safe = safeAdError(new Error('"access_token":"secret" Bearer abcXYZ api_key=key'));
    expect(safe).not.toContain("secret"); expect(safe).not.toContain("abcXYZ"); expect(safe).not.toContain("=key");
  });
  it("weigert niet-ondersteunde PMax-targeting in plaats van stil te negeren", () => {
    expect(() => applyPatches("GOOGLE", { ...before, campaignType: "PERFORMANCE_MAX" }, [{ path: "targeting.keywords", value: ["nieuw"] }])).toThrow("alleen-lezen");
  });
  it("valideert matchtypes en locatie-ID’s", () => {
    expect(() => validateSnapshot("GOOGLE", { ...before, targeting: { matchType: "WRONG" } })).toThrow();
    expect(() => validateSnapshot("GOOGLE", { ...before, targeting: { geoTargetConstants: ["private-url"] } })).toThrow();
  });
  it("vergelijkt volledige inhoud maar negeert vluchtige metadata", () => {
    expect(fingerprint({ a: 1, b: 2 })).toBe(fingerprint({ b: 2, a: 1 }));
    expect(fingerprint({ ...before, resources: { token: 1 }, updated_time: "now" })).toBe(fingerprint(before));
    expect(fingerprint(after)).not.toBe(fingerprint(before));
  });
  it.each(["__proto__.name", "targeting.constructor", "campaignId", "status", "resources.campaignResourceName"])("blokkeert ongeoorloofde wijziging %s", (path) => {
    expect(editablePath("GOOGLE", path)).toBe(false);
    expect(() => applyPatches("GOOGLE", before, [{ path, value: "x" }])).toThrow();
  });
  it("behoudt de volledige bestaande assetlijsten bij een naamwijziging", () => {
    expect(applyPatches("GOOGLE", before, [{ path: "name", value: after.name }]).creatives).toEqual(before.creatives);
    expect(before.name).toBe("Campagne");
  });
  it("beperkt AI-budgetten tot de ingestelde grens", () => {
    expect(() => checkBudgetChange("GOOGLE", before, { ...before, dailyBudgetCents: 1200 }, 20)).not.toThrow();
    expect(() => checkBudgetChange("GOOGLE", before, { ...before, dailyBudgetCents: 1201 }, 20)).toThrow();
    expect(() => checkBudgetChange("GOOGLE", before, { ...before, dailyBudgetCents: 799 }, 20)).toThrow();
  });
  it("valideert de volledige RSA en weigert ongeldige URLs/assets", () => {
    expect(() => validateSnapshot("GOOGLE", before)).not.toThrow();
    expect(() => validateSnapshot("GOOGLE", { ...before, creatives: { ...before.creatives, headlines: ["Een"] } })).toThrow();
    expect(() => validateSnapshot("GOOGLE", { ...before, creatives: { ...before.creatives, finalUrl: "javascript:alert(1)" } })).toThrow();
  });
  it("verwijdert tokens uit foutmeldingen", () => {
    expect(safeAdError(new Error("access_token=secret&api_key=key"))).not.toContain("secret");
  });
});

describe("versiegebonden goedkeuring en publicatie", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(providers.readAdCampaign).mockResolvedValue({ accountId: "account", snapshot: before });
    vi.mocked(providers.adProviderConfig).mockResolvedValue({ accountId: "account", enabled: true } as any);
    vi.mocked(providers.publishAdChanges).mockResolvedValue({ campaignId: "123" });
  });
  it("slaat voorstel en bijbehorende goedkeuring atomair op", async () => {
    const db = dbMock();
    await createAdChange(db, "owner", "member", "GOOGLE", "version", [{ path: "name", value: after.name }], "Betere naam");
    expect(db.adChangeSet.create.mock.calls[0][0].data).toMatchObject({ createdById: "owner", authorId: "member", afterHash: fingerprint(after) });
    expect(db.adApprovalRequest.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ versionHash: fingerprint(after), changeSetId: "new-change" }) }));
    expect(providers.publishAdChanges).not.toHaveBeenCalled();
  });
  it("weigert een versie uit een andere workspace", async () => {
    await expect(createAdChange(dbMock(), "other", "member", "GOOGLE", "version", [{ path: "name", value: "Naam" }], "Test")).rejects.toThrow();
  });
  it("publiceert niet zonder goedkeuring", async () => {
    await expect(applyAdChange(dbMock("PENDING_APPROVAL"), "owner", "GOOGLE", "change")).rejects.toThrow("Keur deze versie");
    expect(providers.publishAdChanges).not.toHaveBeenCalled();
  });
  it("publiceert niet als de goedkeuring ontbreekt", async () => {
    const db = dbMock(); db.adApprovalRequest.findFirst.mockResolvedValue(null);
    await expect(applyAdChange(db, "owner", "GOOGLE", "change")).rejects.toThrow("Goedkeuring");
  });
  it("detecteert externe wijzigingen vóór publicatie", async () => {
    vi.mocked(providers.readAdCampaign).mockResolvedValue({ accountId: "account", snapshot: { ...before, name: "Extern gewijzigd" } });
    const db = dbMock();
    await expect(applyAdChange(db, "owner", "GOOGLE", "change")).rejects.toThrow("extern gewijzigd");
    expect(providers.publishAdChanges).not.toHaveBeenCalled();
    expect(db.adChangeSet.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "CONFLICT" } }));
  });
  it("weigert een gewijzigd gekoppeld advertentieaccount", async () => {
    vi.mocked(providers.readAdCampaign).mockResolvedValue({ accountId: "other", snapshot: before });
    await expect(applyAdChange(dbMock(), "owner", "GOOGLE", "change")).rejects.toThrow();
  });
  it("claimt een publicatie voordat de provider wordt aangeroepen", async () => {
    const db = dbMock(); db.adChangeSet.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(applyAdChange(db, "owner", "GOOGLE", "change")).rejects.toThrow("al verwerkt");
    expect(providers.publishAdChanges).not.toHaveBeenCalled();
  });
  it("registreert een geslaagde publicatie en nieuwe versie", async () => {
    const db = dbMock();
    const result = await applyAdChange(db, "owner", "GOOGLE", "change");
    expect(result.status).toBe("SUCCEEDED");
    expect(providers.publishAdChanges).toHaveBeenCalledOnce();
    expect(db.adVersion.create).toHaveBeenCalledOnce();
  });
  it("herhaalt een geslaagde publicatie niet", async () => {
    const db = dbMock(); db.adSyncOperation.findFirst.mockResolvedValue({ status: "SUCCEEDED", id: "op" });
    expect((await applyAdChange(db, "owner", "GOOGLE", "change")).status).toBe("SUCCEEDED");
    expect(providers.publishAdChanges).not.toHaveBeenCalled();
  });
  it("herhaalt een onzekere externe write niet automatisch", async () => {
    vi.mocked(providers.publishAdChanges).mockRejectedValue(new Error("Netwerkverbinding verbroken"));
    const db = dbMock();
    await expect(applyAdChange(db, "owner", "GOOGLE", "change")).rejects.toThrow("gecontroleerd");
    expect(db.adSyncOperation.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "RECONCILE_REQUIRED" }) }));
  });
  it("weigert goedkeuring van een reeds afgehandeld voorstel", async () => {
    const db = dbMock(); db.adChangeSet.findFirst.mockResolvedValue(null);
    await expect(decideAdChange(db, "owner", "member", "GOOGLE", "change", true)).rejects.toThrow();
  });
});
