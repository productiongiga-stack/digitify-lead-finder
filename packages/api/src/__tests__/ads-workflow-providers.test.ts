import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../lib/google-ads", () => ({
  loadGoogleAdsWorkspaceConfig: vi.fn(), updateGoogleCampaignFromPlan: vi.fn(),
  validateBudgetGuard: vi.fn(), getGoogleCampaignDetails: vi.fn(), getGoogleAdsInsights: vi.fn(), listGoogleCampaigns: vi.fn(),
}));
vi.mock("../lib/meta-ads", () => ({
  loadMetaAdsWorkspaceConfig: vi.fn(), normalizeAdAccountId: (v: string) => v.startsWith("act_") ? v : "act_" + v,
  getMetaCampaignDetails: vi.fn(), getMetaInsights: vi.fn(), listMetaCampaigns: vi.fn(),
}));
vi.mock("../lib/social-meta", () => ({ metaPost: vi.fn() }));
import * as google from "../lib/google-ads";
import * as meta from "../lib/meta-ads";
import { metaPost } from "../lib/social-meta";
import { publishAdChanges, readAdAccount, readAdCampaign } from "../lib/ads-workflow-providers";

const snapshot = { campaign: { id: "123", name: "Campagne" }, adsets: [{ id: "set1", name: "Doelgroep", daily_budget: "1000", targeting: {},
  ads: [{ id: "ad1", name: "Advertentie", creative: { id: "creative-old", object_story_spec: { page_id: "page", link_data: { message: "Oud", link: "https://example.com" } } } }] }] };
describe("provideradapter voor advertentiewijzigingen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(meta.loadMetaAdsWorkspaceConfig).mockResolvedValue({ accessToken: "token", adAccountId: "act_42", autoadsEnabled: true, maxDailyBudgetCents: 5000 } as any);
    vi.mocked(google.loadGoogleAdsWorkspaceConfig).mockResolvedValue({ customerId: "42", refreshToken: "refresh", developerToken: "developer",
      autoadsEnabled: true, maxDailyBudgetCents: 5000 } as any);
    vi.mocked(metaPost).mockResolvedValue({ success: true });
  });
  it("werkt een bestaande Meta-campagne direct bij zonder de status te wijzigen", async () => {
    const after = structuredClone(snapshot); after.campaign.name = "Nieuwe naam";
    await publishAdChanges({} as any, "owner", "META", "123", snapshot, after);
    expect(metaPost).toHaveBeenCalledOnce();
    expect(metaPost).toHaveBeenCalledWith("123", { access_token: "token", name: "Nieuwe naam" });
  });
  it("maakt een gepauzeerde vervanger en behoudt de bestaande advertentie", async () => {
    const after = structuredClone(snapshot); after.adsets[0].ads[0].creative.object_story_spec.link_data.message = "Nieuw";
    vi.mocked(metaPost).mockResolvedValueOnce({ id: "creative-new" }).mockResolvedValueOnce({ id: "ad-new" });
    const result = await publishAdChanges({} as any, "owner", "META", "123", snapshot, after);
    expect(metaPost).toHaveBeenNthCalledWith(1, "act_42/adcreatives", expect.objectContaining({ name: "Advertentie" }));
    expect(metaPost).toHaveBeenNthCalledWith(2, "act_42/ads", expect.objectContaining({ status: "PAUSED", creative: JSON.stringify({ creative_id: "creative-new" }) }));
    expect(metaPost).not.toHaveBeenCalledWith("ad1", expect.anything());
    expect(snapshot.adsets[0].ads[0].creative.id).toBe("creative-old");
    expect(result).toHaveProperty("journal");
  });
  it("houdt gedeeltelijke externe resultaten bij en herhaalt niet", async () => {
    const after = structuredClone(snapshot); after.adsets[0].ads[0].creative.object_story_spec.link_data.message = "Nieuw";
    vi.mocked(metaPost).mockResolvedValueOnce({ id: "creative-new" }).mockRejectedValueOnce(new Error("Netwerk"));
    await expect(publishAdChanges({} as any, "owner", "META", "123", snapshot, after)).rejects.toMatchObject({
      journal: [{ objectId: "ad1", action: "CREATE_CREATIVE", creativeId: "creative-new" }],
    });
    expect(metaPost).toHaveBeenCalledTimes(2);
  });
  it("controleert budgetlimieten vóór iedere externe write", async () => {
    const next = structuredClone(snapshot) as any;
    next.adsets[0].ads = [{ ...snapshot.adsets[0].ads[0], id: "new", status: "ACTIVE" }, { ...snapshot.adsets[0].ads[0], id: "old", status: "PAUSED" }];
    const prior = structuredClone(next);
    prior.adsets[0].ads[0].status = "PAUSED"; prior.adsets[0].ads[1].status = "ACTIVE";
    vi.mocked(metaPost).mockResolvedValue({ success: true });
    await publishAdChanges({} as any, "owner", "META", "123", prior, next);
    expect(metaPost).toHaveBeenNthCalledWith(1, "old", expect.objectContaining({ status: "PAUSED" }));
    expect(metaPost).toHaveBeenNthCalledWith(2, "new", expect.objectContaining({ status: "ACTIVE" }));
    vi.mocked(metaPost).mockClear();
    const after = structuredClone(snapshot); after.adsets[0].daily_budget = "10000";
    await expect(publishAdChanges({} as any, "owner", "META", "123", snapshot, after)).rejects.toThrow("budget");
    expect(metaPost).not.toHaveBeenCalled();
  });
  it("blokkeert publicatie wanneer de module uit staat", async () => {
    vi.mocked(meta.loadMetaAdsWorkspaceConfig).mockResolvedValue({ accessToken: "token", adAccountId: "act_42", autoadsEnabled: false } as any);
    await expect(publishAdChanges({} as any, "owner", "META", "123", snapshot, snapshot)).rejects.toThrow("Schakel");
    expect(metaPost).not.toHaveBeenCalled();
  });
  it("weigert Meta-campagnes buiten het gekozen advertentieaccount", async () => {
    vi.mocked(meta.listMetaCampaigns).mockResolvedValue([{ id: "999" }]);
    await expect(readAdCampaign({} as any, "owner", "META", "123")).rejects.toThrow("behoort niet");
    expect(meta.getMetaCampaignDetails).not.toHaveBeenCalled();
  });
  it("laat niet-bewerkbare Google-campagnes de dagelijkse synchronisatie niet blokkeren", async () => {
    vi.mocked(google.listGoogleCampaigns).mockResolvedValue([
      { id: "1", channelType: "SEARCH" }, { id: "2", channelType: "10" }, { id: "3", channelType: "DISPLAY" },
    ] as any);
    vi.mocked(google.getGoogleAdsInsights).mockResolvedValue({} as any);
    const account = await readAdAccount({} as any, "owner", "GOOGLE");
    expect(account.campaignIds).toEqual(["1", "2"]);
    expect(google.updateGoogleCampaignFromPlan).not.toHaveBeenCalled();
  });
  it("stuurt alleen gewijzigde Google-velden met de volledige assetlijst", async () => {
    const before = { name: "Oud", dailyBudgetCents: 1000, campaignType: "SEARCH", creatives: { headlines: ["Een", "Twee", "Drie"] }, targeting: {} };
    await publishAdChanges({} as any, "owner", "GOOGLE", "123", before, { ...before, name: "Nieuw" });
    expect(google.updateGoogleCampaignFromPlan).toHaveBeenCalledWith(expect.anything(), "123",
      expect.objectContaining({ changedPaths: ["name"], creatives: before.creatives }));
  });
});
