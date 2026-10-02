import type { PrismaClient } from "@digitify/db";
import { getGoogleCampaignDetails, getGoogleAdsInsights, listGoogleCampaigns, loadGoogleAdsWorkspaceConfig, updateGoogleCampaignFromPlan, validateBudgetGuard } from "./google-ads";
import { getMetaCampaignDetails, getMetaInsights, listMetaCampaigns, loadMetaAdsWorkspaceConfig, normalizeAdAccountId } from "./meta-ads";
import { metaPost } from "./social-meta";
import { fingerprint, type AdProvider, type AdSnapshot } from "./ads-workflow-policy";
import { retryAdRead } from "./ads-workflow-read";
import type { GoogleEditorSelection } from "./google-editor-selection";

export async function adProviderConfig(db: PrismaClient, workspaceId: string, provider: AdProvider) {
  const scope = { workspaceId, memberId: workspaceId };
  if (provider === "GOOGLE") {
    const config = await loadGoogleAdsWorkspaceConfig(db, scope);
    if (!config.customerId || !config.refreshToken || !config.developerToken) throw new Error("Koppel Google Ads en kies een klantaccount via Integraties.");
    return { accountId: config.customerId, enabled: config.autoadsEnabled, google: config };
  }
  const config = await loadMetaAdsWorkspaceConfig(db, scope);
  if (!config.adAccountId || !config.accessToken) throw new Error("Koppel Meta en kies een advertentieaccount via Integraties.");
  return { accountId: normalizeAdAccountId(config.adAccountId), enabled: config.autoadsEnabled, meta: config };
}

export async function readAdCampaign(db: PrismaClient, workspaceId: string, provider: AdProvider, campaignId: string, target?: GoogleEditorSelection) {
  const config = await adProviderConfig(db, workspaceId, provider);
  if (config.google) {
    const snapshot = await retryAdRead(() => getGoogleCampaignDetails(config.google!, campaignId, target));
    const campaigns = await retryAdRead(() => listGoogleCampaigns(config.google!));
    const live = campaigns.find((c) => c.id === campaignId);
    if (!live || !["SEARCH", "PERFORMANCE_MAX", "2", "10"].includes(String(live.channelType))) throw new Error("Dit campagnetype is alleen-lezen; kies Search of Performance Max.");
    return { accountId: config.accountId, snapshot: snapshot as AdSnapshot };
  }
  // Validate remote ownership, not just local row ownership.
  const campaigns = await retryAdRead(() => listMetaCampaigns({ adAccountId: config.accountId, accessToken: config.meta!.accessToken }));
  if (!campaigns.some((c) => c.id === campaignId)) throw new Error("Campagne behoort niet tot het geselecteerde advertentieaccount.");
  const snapshot = await retryAdRead(() => getMetaCampaignDetails({ campaignId, accessToken: config.meta!.accessToken }));
  return { accountId: config.accountId, snapshot: snapshot as AdSnapshot };
}

export async function readAdAccount(db: PrismaClient, workspaceId: string, provider: AdProvider) {
  const config = await adProviderConfig(db, workspaceId, provider);
  if (config.google) {
    const [campaigns, metrics] = await Promise.all([retryAdRead(() => listGoogleCampaigns(config.google!)), retryAdRead(() => getGoogleAdsInsights(config.google!))]);
    // Unsupported campaign types must not block all supported campaigns' daily analysis.
    const editable = campaigns.filter((c) => ["SEARCH", "PERFORMANCE_MAX", "2", "10"].includes(String(c.channelType)));
    return { accountId: config.accountId, campaignIds: editable.map((c) => String(c.id)), metrics };
  }
  const [campaigns, metrics] = await Promise.all([
    retryAdRead(() => listMetaCampaigns({ adAccountId: config.accountId, accessToken: config.meta!.accessToken })),
    retryAdRead(() => getMetaInsights({ adAccountId: config.accountId, accessToken: config.meta!.accessToken, datePreset: "last_30d" })),
  ]);
  return { accountId: config.accountId, campaignIds: campaigns.map((c) => String(c.id)), metrics };
}

export async function publishAdChanges(db: PrismaClient, workspaceId: string, provider: AdProvider, campaignId: string, before: AdSnapshot, after: AdSnapshot) {
  const config = await adProviderConfig(db, workspaceId, provider);
  if (!config.enabled) throw new Error("Schakel de advertentiemodule in voordat je publiceert.");
  if (config.google) {
    validateBudgetGuard(after, config.google.maxDailyBudgetCents);
    const changedPaths = ["name", "dailyBudgetCents"].filter((key) => fingerprint(before[key]) !== fingerprint(after[key]));
    for (const group of ["creatives", "targeting"]) for (const key of Object.keys(after[group] || {})) {
      if (key === "campaignSettings" && group === "targeting") {
        for (const field of ["trackingTemplate", "finalUrlSuffix"]) if (fingerprint(before.targeting?.campaignSettings?.[field] ?? null) !== fingerprint(after.targeting.campaignSettings[field] ?? null)) changedPaths.push("targeting.campaignSettings." + field);
      } else if (fingerprint(before[group]?.[key] ?? null) !== fingerprint(after[group][key])) changedPaths.push(group + "." + key);
    }
    return updateGoogleCampaignFromPlan(config.google, campaignId, { ...after, name: after.name, campaignType: after.campaignType, changedPaths });
  }
  const token = config.meta!.accessToken;
  const post = (id: string, fields: Record<string, string>) => metaPost(id, { ...fields, access_token: token });
  const journal: Array<{ objectId: string; action: string; creativeId?: string; replacementAdId?: string }> = [];
  const statusChanges: Array<{ id: string; status: string }> = [];
  const max = config.meta!.maxDailyBudgetCents;
  // Validate every object before any write. Lifetime budgets need a scheduled duration.
  for (const item of [after.campaign, ...after.adsets]) {
    if (max > 0 && Number(item.daily_budget || 0) > max) throw new Error("Dagbudget overschrijdt de workspace-limiet.");
    if (Number(item.lifetime_budget || 0) > 0 && item.lifetime_budget !== [before.campaign, ...before.adsets].find((v: any) => v.id === item.id)?.lifetime_budget) {
      const days = (new Date(item.end_time).getTime() - new Date(item.start_time).getTime()) / 86400000;
      if (!(days > 0) || (max > 0 && Number(item.lifetime_budget) / days > max)) throw new Error("Lifetime-budget vereist een geldige planning binnen de budgetlimiet.");
    }
  }
  try {
    const changedFields = (old: any, next: any, allowed: string[]) => Object.fromEntries(allowed
      .filter((key) => fingerprint(old[key] ?? null) !== fingerprint(next[key] ?? null))
      .map((key) => [key, typeof next[key] === "object" ? JSON.stringify(next[key]) : String(next[key])]));
    const campaignFields = changedFields(before.campaign, after.campaign, ["name", "daily_budget", "lifetime_budget"]);
    if (Object.keys(campaignFields).length) {
      await post(campaignId, campaignFields);
      journal.push({ objectId: campaignId, action: "UPDATE_CAMPAIGN" });
    }
    for (let i = 0; i < after.adsets.length; i++) {
      const adset = after.adsets[i], previous = before.adsets[i];
      const fields = changedFields(previous, adset, ["name", "daily_budget", "lifetime_budget", "targeting", "bid_amount", "start_time", "end_time"]);
      if (Object.keys(fields).length) {
        await post(adset.id, fields);
        journal.push({ objectId: adset.id, action: "UPDATE_ADSET" });
      }
      for (let j = 0; j < adset.ads.length; j++) {
        const ad = adset.ads[j], oldAd = previous.ads[j];
        if (ad.status !== oldAd.status) statusChanges.push({ id: ad.id, status: ad.status });
        const adFields = changedFields(oldAd, ad, ["name"]);
        if (fingerprint(oldAd.creative?.object_story_spec ?? null) !== fingerprint(ad.creative?.object_story_spec ?? null)) {
          // Keep the old ad untouched; publish the replacement as a separate paused version.
          const created = await post(config.accountId + "/adcreatives", { name: ad.name, object_story_spec: JSON.stringify(ad.creative.object_story_spec) }) as { id?: string };
          if (!created.id) throw new Error("Meta gaf geen creative-ID terug.");
          journal.push({ objectId: ad.id, action: "CREATE_CREATIVE", creativeId: created.id });
          const replacement = await post(config.accountId + "/ads", { name: ad.name, adset_id: adset.id,
            creative: JSON.stringify({ creative_id: created.id }), status: "PAUSED",
            ...(oldAd.tracking_specs ? { tracking_specs: JSON.stringify(oldAd.tracking_specs) } : {}) }) as { id?: string };
          if (!replacement.id) throw new Error("Meta gaf geen vervangende advertentie-ID terug.");
          journal.push({ objectId: ad.id, action: "CREATE_PAUSED_REPLACEMENT", creativeId: created.id, replacementAdId: replacement.id });
          continue;
        }
        if (Object.keys(adFields).length) {
          await post(ad.id, adFields);
          journal.push({ objectId: ad.id, action: "UPDATE_AD" });
        }
      }
    }
    // Pause all old versions before any replacement activation. API calls are not atomic;
    // failures remain locked for explicit reconciliation rather than blind rollback/retry.
    statusChanges.sort((a, b) => Number(a.status === "ACTIVE") - Number(b.status === "ACTIVE"));
    for (const item of statusChanges) {
      if (!["ACTIVE", "PAUSED"].includes(item.status)) throw new Error("Ongeldige advertentiestatus.");
      await post(item.id, { status: item.status });
      journal.push({ objectId: item.id, action: item.status === "ACTIVE" ? "ACTIVATE_REPLACEMENT" : "PAUSE_OLD_AD" });
    }
    return { campaignId, journal };
  } catch (error) {
    // Do not automatically retry a potentially committed external mutation.
    throw Object.assign(new Error(error instanceof Error ? error.message : "Meta-wijziging mislukt."), { journal });
  }
}
