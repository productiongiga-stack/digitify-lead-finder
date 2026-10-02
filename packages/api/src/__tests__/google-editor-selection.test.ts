import { beforeEach, describe, expect, it, vi } from "vitest";
import { adVersionTargetKey, googleEditorSelectionSchema } from "../lib/google-editor-selection";

const mock = vi.hoisted(() => ({ query: vi.fn(), adsUpdate: vi.fn(), campaignsUpdate: vi.fn() }));
vi.mock("google-ads-api", () => ({
  GoogleAdsApi: class { Customer() { return { query: mock.query, ads: { update: mock.adsUpdate }, campaigns: { update: mock.campaignsUpdate } }; } },
  enums: { ServedAssetFieldType: { HEADLINE_1: 2, DESCRIPTION_1: 5 }, CampaignStatus: { ENABLED: 2, PAUSED: 3 } },
}));
import { getGoogleCampaignDetails, updateGoogleCampaignFromPlan } from "../lib/google-ads";

const config = { clientId: "client", clientSecret: "secret", developerToken: "dev", refreshToken: "refresh", customerId: "42", defaultCurrency: "EUR", maxDailyBudgetCents: 10000 } as any;
beforeEach(() => {
  vi.clearAllMocks();
  mock.query.mockImplementation(async (query: string) => {
    if (/FROM campaign\s+WHERE/.test(query)) return [{ campaign: { id: "123", name: "Campagne", status: "PAUSED", advertising_channel_type: "SEARCH" }, campaign_budget: { amount_micros: 10000000 } }];
    if (/FROM ad_group\s/.test(query)) return query.includes("ad_group.id = 99") ? [] : [{ ad_group: { name: "Tweede groep", resource_name: "customers/42/adGroups/22" } }];
    if (/FROM ad_group_ad\s/.test(query)) return query.includes("ad_group_ad.ad.id = 99") ? [] : [{ ad_group_ad: {
      resource_name: "customers/42/adGroupAds/22~55", ad: { final_urls: ["https://example.com", "https://example.com/extra"], responsive_search_ad: {
        headlines: [{ text: "Een", pinned_field: 3 }, { text: "Twee" }, { text: "Drie" }], descriptions: [{ text: "Beschrijving een" }, { text: "Beschrijving twee" }],
      } },
    } }];
    return [];
  });
});

describe("Google editor-selectie", () => {
  it.each([{ adGroupId: "22", adId: "55" }, { assetGroupId: "33" }, {}])("accepteert een geldig doel %j", (value) => {
    expect(googleEditorSelectionSchema.parse(value)).toEqual(value);
  });
  it.each([{ adId: "55" }, { adGroupId: "22", assetGroupId: "33" }, { adGroupId: "22 OR 1=1" }, { adId: "55", extra: true }])("weigert een ongeldig doel %j", (value) => {
    expect(() => googleEditorSelectionSchema.parse(value)).toThrow();
  });
  it("houdt snapshots van verschillende accounts en onderdelen apart", () => {
    const first = { accountId: "42", campaignId: "123", snapshot: { editorTarget: { adGroupId: "22", adId: "55" } } };
    expect(adVersionTargetKey(first)).not.toBe(adVersionTargetKey({ ...first, accountId: "99" }));
    expect(adVersionTargetKey(first)).not.toBe(adVersionTargetKey({ ...first, snapshot: { editorTarget: { adGroupId: "22", adId: "56" } } }));
  });
  it("scopet de geselecteerde RSA tot campagne en advertentiegroep", async () => {
    const snapshot = await getGoogleCampaignDetails(config, "123", { adGroupId: "22", adId: "55" });
    expect(snapshot.editorTarget).toEqual({ adGroupId: "22", adId: "55" });
    const query = mock.query.mock.calls.find(([sql]) => /FROM ad_group_ad\s/.test(sql))![0];
    expect(query).toContain("campaign.id = 123");
    expect(query).toContain("ad_group.resource_name = 'customers/42/adGroups/22'");
    expect(query).toContain("ad_group_ad.ad.id = 55");
  });
  it("weigert een groep of RSA die niet binnen de selectie bestaat", async () => {
    await expect(getGoogleCampaignDetails(config, "123", { adGroupId: "99" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getGoogleCampaignDetails(config, "123", { adGroupId: "22", adId: "99" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mock.adsUpdate).not.toHaveBeenCalled();
  });
  it("publiceert naar het geselecteerde Ad-resource en behoudt andere pins en URLs", async () => {
    const snapshot = await getGoogleCampaignDetails(config, "123", { adGroupId: "22", adId: "55" });
    await updateGoogleCampaignFromPlan(config, "123", { ...snapshot, creatives: { ...snapshot.creatives, headlines: ["Een", "Twee", "Nieuw"] }, changedPaths: ["creatives.headlines"] });
    expect(mock.adsUpdate).toHaveBeenCalledWith([expect.objectContaining({ resource_name: "customers/42/ads/55",
      final_urls: ["https://example.com", "https://example.com/extra"],
      responsive_search_ad: expect.objectContaining({ headlines: [{ text: "Een", pinned_field: 3 }, { text: "Twee" }, { text: "Nieuw" }] }),
    })]);
    expect(mock.campaignsUpdate).not.toHaveBeenCalled();
  });
});
