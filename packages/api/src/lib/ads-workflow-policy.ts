import { createHash } from "node:crypto";
import { z } from "zod";

export type AdProvider = "GOOGLE" | "META";
export type AdSnapshot = Record<string, any>;
export const optimizationSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  maxBudgetChangePercent: z.number().min(0).max(20).default(20),
  targetCpl: z.number().positive().nullable().default(null),
  targetRoas: z.number().positive().nullable().default(null),
});
export const changePatchSchema = z.object({
  path: z.string().min(1).max(240),
  value: z.unknown(),
}).strict();

// Sort keys, preserve ordered assets, exclude server-only/volatile provider metadata.
export function fingerprint(value: unknown): string {
  const canonical = (v: any): any => Array.isArray(v) ? v.map(canonical)
    : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort()
      .filter((k) => !["updated_time", "effective_status", "resources", "syncedAt"].includes(k))
      .map((k) => [k, canonical(v[k])])) : v;
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

export function editablePath(provider: AdProvider, path: string): boolean {
  if (path.split(".").some((p) => ["__proto__", "prototype", "constructor"].includes(p))) return false;
  if (provider === "GOOGLE") return /^(name|dailyBudgetCents|creatives\.(finalUrl|headlines|descriptions|longHeadlines|businessName|path1|path2|headlinePin1|descriptionPin1|assetGroupName|imageUrl|squareImageUrl|logoUrl|portraitImageUrl|landscapeLogoUrl)|targeting\.(keywords|negativeKeywords|geoTargetConstants|languageConstants|matchType|adGroupName|searchPartners|displayExpansion)|targeting\.campaignSettings\.(trackingTemplate|finalUrlSuffix))$/.test(path);
  return /^(campaign\.(name|daily_budget|lifetime_budget)|adsets\.\d+\.(name|daily_budget|lifetime_budget|targeting|bid_amount|start_time|end_time)|adsets\.\d+\.ads\.\d+\.(name|status)|adsets\.\d+\.ads\.\d+\.creative\.object_story_spec)$/.test(path);
}

export function applyPatches(provider: AdProvider, before: AdSnapshot, patches: Array<z.infer<typeof changePatchSchema>>): AdSnapshot {
  const after = structuredClone(before);
  if (!patches.length || patches.length > 60) throw new Error("Kies 1 tot 60 wijzigingen.");
  const paths = new Set<string>();
  for (const patch of patches) {
    if (!editablePath(provider, patch.path) || paths.has(patch.path)) throw new Error("Dit veld is alleen-lezen of komt dubbel voor: " + patch.path);
    paths.add(patch.path);
    if (provider === "META" && patch.path.endsWith(".status")) z.enum(["ACTIVE", "PAUSED"]).parse(patch.value);
    if (provider === "GOOGLE" && before.campaignType === "PERFORMANCE_MAX" &&
      (/^targeting\.(?!campaignSettings\.)/.test(patch.path) || /^creatives\.(path[12]|headlinePin1|descriptionPin1)$/.test(patch.path))) {
      throw new Error("Dit veld wordt voor Performance Max nog niet ondersteund en blijft alleen-lezen.");
    }
    const segments = patch.path.split(".");
    const key = segments.pop()!;
    let target: any = after;
    for (const segment of segments) {
      if (!target || typeof target !== "object") throw new Error("Onbekend veld: " + patch.path);
      if (!(segment in target)) {
        // Only documented optional Google settings may be absent.
        if (provider === "GOOGLE" && segment === "campaignSettings") target[segment] = {};
        else throw new Error("Onbekend veld: " + patch.path);
      }
      target = target[segment];
    }
    if (!target || typeof target !== "object") throw new Error("Onbekend veld: " + patch.path);
    target[key] = patch.value;
  }
  return after;
}

export function validateSnapshot(provider: AdProvider, snapshot: AdSnapshot) {
  const positiveBudget = z.coerce.number().int().positive().max(100_000_000);
  if (provider === "GOOGLE") {
    z.object({ name: z.string().min(2).max(160), dailyBudgetCents: positiveBudget,
      creatives: z.object({
        finalUrl: z.string().url().refine((v) => /^https?:\/\//.test(v)),
        headlines: z.array(z.string().min(1).max(30)).min(3).max(15),
        descriptions: z.array(z.string().min(1).max(90)).min(2).max(snapshot.campaignType === "SEARCH" ? 4 : 5),
        longHeadlines: z.array(z.string().min(1).max(90)).max(5).optional(),
        path1: z.string().max(15).optional(), path2: z.string().max(15).optional(),
        businessName: z.string().max(25).optional(),
      }).passthrough(),
      targeting: z.object({
        matchType: z.enum(["BROAD", "PHRASE", "EXACT"]).optional(),
        keywords: z.array(z.string().min(1).max(80)).max(1000).optional(),
        negativeKeywords: z.array(z.string().min(1).max(80)).max(1000).optional(),
        geoTargetConstants: z.array(z.string().regex(/^(geoTargetConstants\/)?\d+$/)).max(1000).optional(),
        languageConstants: z.array(z.string().regex(/^(languageConstants\/)?\d+$/)).max(100).optional(),
        searchPartners: z.boolean().optional(), displayExpansion: z.boolean().optional(),
      }).passthrough().optional(),
    }).passthrough().parse(snapshot);
    if (snapshot.campaignType === "PERFORMANCE_MAX" && !snapshot.creatives.longHeadlines?.length) throw new Error("Performance Max vereist een lange headline.");
  } else {
    z.object({ campaign: z.object({ id: z.string().min(1), name: z.string().min(2).max(160) }).passthrough(),
      adsets: z.array(z.object({ id: z.string().min(1), name: z.string().min(1).max(160),
        daily_budget: positiveBudget.optional(), lifetime_budget: positiveBudget.optional(),
        targeting: z.record(z.unknown()).optional(), ads: z.array(z.object({ id: z.string().min(1),
          name: z.string().min(1).max(160), creative: z.object({ object_story_spec: z.record(z.unknown()).optional() }).passthrough().optional(),
        }).passthrough()),
      }).passthrough()),
    }).passthrough().parse(snapshot);
    for (const item of [snapshot.campaign, ...snapshot.adsets]) {
      for (const field of ["daily_budget", "lifetime_budget"]) if (item[field] != null) positiveBudget.parse(item[field]);
    }
  }
  if (JSON.stringify(snapshot).length > 500_000) throw new Error("Advertentiegegevens zijn te groot.");
}

export function checkBudgetChange(provider: AdProvider, before: AdSnapshot, after: AdSnapshot, maxPercent: number) {
  const pairs: Array<[number, number]> = provider === "GOOGLE"
    ? [[Number(before.dailyBudgetCents), Number(after.dailyBudgetCents)]]
    : [before.campaign, ...before.adsets].flatMap((item: any, i: number) => {
      const next = [after.campaign, ...after.adsets][i];
      return ["daily_budget", "lifetime_budget"].map((field) => [Number(item[field] || 0), Number(next[field] || 0)] as [number, number]);
    });
  for (const [oldValue, newValue] of pairs) {
    if (oldValue !== newValue && (!oldValue || Math.abs(newValue - oldValue) / oldValue * 100 > maxPercent + 0.0001)) {
      throw new Error("Budgetvoorstel overschrijdt de ingestelde grens van " + maxPercent + "%.");
    }
  }
}

export const AD_CAPABILITIES = {
  GOOGLE: { editable: ["Campagnenaam", "Dagbudget", "Zoekwoorden", "Locaties en talen", "RSA-teksten en URL", "Tracking", "PMax teksten en beelden"],
    readOnly: ["Campagnetype", "Conversiedoelen", "Biedstrategie", "Planning", "Video-assets", "Niet-ondersteunde campagnetypes"] },
  META: { editable: ["Campagnenaam", "Budget", "Ad set-naam", "Targeting", "Biedbedrag", "Planning", "Advertentienaam", "Creative, links en CTA"],
    readOnly: ["Campagnedoel", "Biedstrategie", "Conversie-event", "Bestaande creative-ID", "Activering"] },
} as const;
