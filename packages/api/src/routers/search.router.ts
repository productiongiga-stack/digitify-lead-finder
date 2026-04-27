import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { getSettingString, settingsRowsToMap } from "../lib/settings";
import { loadUserSettingRows } from "../lib/user-settings";
import { checkRateLimit } from "../lib/rate-limit-bucket";
import { log } from "../lib/logger";
import { readUserJsonSetting, writeUserJsonSetting } from "../lib/user-json-setting";

const searchStringSchema = z
  .string()
  .optional()
  .transform((value) => value?.trim() ?? "");

const searchResultSchema = z.object({
  placeId: z.string(),
  displayName: z.string(),
  formattedAddress: z.string().optional(),
  websiteUri: z.string().optional(),
  nationalPhoneNumber: z.string().optional(),
  googleMapsUri: z.string().optional(),
  rating: z.number().optional(),
  userRatingCount: z.number().optional(),
  types: z.array(z.string()).optional(),
  primaryType: z.string().optional(),
});

const SAVED_SEARCHES_KEY = "search.saved_searches_json";

const savedSearchSchema = z.object({
  id: z.string(),
  name: z.string(),
  query: z.string().default(""),
  city: z.string().default(""),
  country: z.string().default("België"),
  niche: z.string().default(""),
  pageSize: z.number().min(5).max(80).default(20),
  createdAt: z.string(),
  updatedAt: z.string(),
});

type SavedSearchItem = z.infer<typeof savedSearchSchema>;

async function loadSavedSearches(db: any, userId: string): Promise<SavedSearchItem[]> {
  const raw = await readUserJsonSetting<unknown[]>(db, userId, SAVED_SEARCHES_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => savedSearchSchema.safeParse(item))
    .filter((item) => item.success)
    .map((item) => item.data);
}

function extractCity(formattedAddress: string | undefined): string | undefined {
  if (!formattedAddress) return undefined;
  const parts = formattedAddress.split(",").map((p) => p.trim());
  // Typically: "Street 123, 9000 Gent, Belgium" -> city is second-to-last or contains postal code
  // Try to find a part that looks like "1234 CityName" (Belgian/Dutch format)
  for (const part of parts) {
    const match = part.match(/^\d{4,5}\s+(.+)$/);
    if (match) return match[1];
  }
  // Fallback: take the second part if there are 3+ parts, otherwise the first
  if (parts.length >= 3) return parts[parts.length - 2]?.replace(/^\d+\s*/, "");
  if (parts.length >= 2) return parts[1];
  return undefined;
}

function shuffleArray<T>(items: T[]): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex]!, next[index]!];
  }
  return next;
}

function buildSearchQueries(input: {
  query: string;
  niche?: string;
  city: string;
  country: string;
}) {
  const location = [input.city, input.country].filter(Boolean).join(", ").trim();
  const mainKeyword = input.query || input.niche || "bedrijf";
  const combinedKeyword = [input.query, input.niche].filter(Boolean).join(" ").trim();
  const fallbackKeyword = combinedKeyword || mainKeyword;

  const queries = [
    [fallbackKeyword, location ? `in ${location}` : ""].filter(Boolean).join(" "),
    [mainKeyword, "bedrijf", location ? `in ${location}` : ""].filter(Boolean).join(" "),
    [mainKeyword, "zaak", location ? `in ${location}` : ""].filter(Boolean).join(" "),
    [mainKeyword, "kmo", location ? `in ${location}` : ""].filter(Boolean).join(" "),
  ]
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set(queries)).slice(0, 4);
}

export const searchRouter = router({
  searchPlaces: protectedProcedure
    .input(
      z
        .object({
          query: searchStringSchema,
          city: searchStringSchema,
          country: z.string().trim().default("België"),
          niche: searchStringSchema.optional(),
          pageSize: z.number().min(5).max(80).default(20),
        })
        .superRefine((value, ctx) => {
          if (!value.query && !value.niche && !value.city) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Vul minstens een zoekterm, niche of stad in.",
              path: ["query"],
            });
          }
        })
    )
    .mutation(async ({ ctx, input }) => {
      const rateLimit = checkRateLimit({
        key: `lead-search:${ctx.user.id}`,
        limit: 20,
        windowMs: 60_000,
      });
      if (!rateLimit.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Te veel zoekopdrachten op korte tijd. Wacht even en probeer opnieuw.",
        });
      }

      const settings = await loadUserSettingRows(ctx.db, ctx.user.id, ["api.google_places_key"]);
      const apiKey = getSettingString(settingsRowsToMap(settings), "api.google_places_key");
      if (!apiKey) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Google Places API key is niet geconfigureerd. Ga naar Instellingen > Integraties om de API key in te stellen.",
        });
      }

      const fieldMask = [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.websiteUri",
        "places.nationalPhoneNumber",
        "places.googleMapsUri",
        "places.rating",
        "places.userRatingCount",
        "places.types",
        "places.primaryType",
      ].join(",");

      const searchQueries = buildSearchQueries(input);
      const perRequestResultCount = Math.min(
        20,
        Math.max(5, Math.ceil(input.pageSize / searchQueries.length) + 3)
      );
      const dedupedPlaces = new Map<string, Record<string, unknown>>();

      for (const textQuery of searchQueries) {
        const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": fieldMask,
          },
          body: JSON.stringify({
            textQuery,
            maxResultCount: perRequestResultCount,
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          log.integration.error("Google Places API error", {
            userId: ctx.user.id,
            status: response.status,
            bodyPreview: errorBody.slice(0, 200),
            textQuery,
          });
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Google Places API fout (${response.status}). Controleer je API key en probeer opnieuw.`,
          });
        }

        const data = await response.json();
        const places = Array.isArray(data.places) ? (data.places as Record<string, unknown>[]) : [];

        for (const place of places) {
          const placeId = place.id as string | undefined;
          if (!placeId || dedupedPlaces.has(placeId)) continue;
          dedupedPlaces.set(placeId, place);
        }
      }

      const places = shuffleArray(Array.from(dedupedPlaces.values())).slice(0, input.pageSize);
      const searchLabel = searchQueries[0] ?? [input.query, input.niche, input.city].filter(Boolean).join(" ");

      // Log the search as an activity
      await ctx.db.activity.create({
        data: {
          userId: ctx.user.id,
          type: "SEARCH_PERFORMED",
          title: `Zoekopdracht: "${searchLabel}"`,
          metadata: {
            query: input.query,
            city: input.city,
            country: input.country,
            niche: input.niche,
            searchQueries,
            resultCount: places.length,
          },
        },
      });

      return places.map((place: Record<string, unknown>) => ({
        placeId: place.id as string,
        displayName: (place.displayName as Record<string, string>)?.text ?? "",
        formattedAddress: place.formattedAddress as string | undefined,
        websiteUri: place.websiteUri as string | undefined,
        nationalPhoneNumber: place.nationalPhoneNumber as string | undefined,
        googleMapsUri: place.googleMapsUri as string | undefined,
        rating: place.rating as number | undefined,
        userRatingCount: place.userRatingCount as number | undefined,
        types: place.types as string[] | undefined,
        primaryType: place.primaryType as string | undefined,
      }));
    }),

  getPopularSearches: protectedProcedure.query(async ({ ctx }) => {
    const fallback = [
      "Webdesign Gent",
      "SEO bureau Antwerpen",
      "Marketingbureau Brussel",
      "Google Ads bureau Gent",
      "Social media bureau Antwerpen",
      "Branding bureau Leuven",
      "Loodgieter Gent",
      "Elektricien Antwerpen",
      "Dakwerker Brussel",
      "Schilder Gent",
      "Tandarts Antwerpen",
      "Kinesist Mechelen",
      "Fysiotherapeut Hasselt",
      "Restaurant Antwerpen",
      "Traiteur Gent",
      "Koffiebar Brussel",
      "Kapper Brussel",
      "Schoonheidssalon Antwerpen",
      "Nagelstudio Leuven",
      "Barbershop Gent",
      "Immokantoor Leuven",
      "Boekhouder Brugge",
      "Verzekeringsmakelaar Gent",
      "Advocaat Brussel",
      "Notaris Gent",
      "Autogarage Kortrijk",
      "Fietsenwinkel Gent",
      "Carrosserie Antwerpen",
      "Tuinarchitect Aalst",
      "Bakkerij Sint-Niklaas",
      "Fotograaf Leuven",
      "Schrijnwerker Brugge",
      "Ramen en deuren Turnhout",
      "Keukenbouwer Antwerpen",
      "Interieurarchitect Gent",
    ];

    const recentSearches = await ctx.db.activity.findMany({
      where: { type: "SEARCH_PERFORMED", userId: ctx.user.id },
      orderBy: { createdAt: "desc" },
      take: 120,
      select: { metadata: true },
    });

    const counts = new Map<string, number>();

    for (const activity of recentSearches) {
      const metadata = activity.metadata as
        | { query?: string; city?: string; niche?: string; searchQueries?: string[] }
        | null;
      if (!metadata) continue;

      const variants = [
        [metadata.query, metadata.city].filter(Boolean).join(" ").trim(),
        [metadata.niche, metadata.city].filter(Boolean).join(" ").trim(),
        metadata.query?.trim(),
      ].filter((value): value is string => Boolean(value && value.length >= 3));

      for (const value of variants) {
        const key = value.replace(/\s+/g, " ").trim();
        if (!key) continue;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }

    const dynamic = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([term]) => term);

    const merged = Array.from(new Set([...dynamic, ...fallback]));
    return merged.slice(0, 24);
  }),

  listSavedSearches: protectedProcedure.query(async ({ ctx }) => {
    const items = await loadSavedSearches(ctx.db, ctx.user.id);
    return items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }),

  saveSearch: protectedProcedure
    .input(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1).max(120),
        query: searchStringSchema,
        city: searchStringSchema,
        country: z.string().trim().default("België"),
        niche: searchStringSchema.optional(),
        pageSize: z.number().min(5).max(80).default(20),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const items = await loadSavedSearches(ctx.db, ctx.user.id);
      const now = new Date().toISOString();
      const nextItem: SavedSearchItem = {
        id: input.id || `search_${Math.random().toString(36).slice(2, 10)}`,
        name: input.name.trim(),
        query: input.query || "",
        city: input.city || "",
        country: input.country || "België",
        niche: input.niche || "",
        pageSize: input.pageSize,
        createdAt: now,
        updatedAt: now,
      };

      const existingIndex = items.findIndex((item) => item.id === nextItem.id);
      if (existingIndex >= 0) {
        const current = items[existingIndex];
        items[existingIndex] = {
          ...current!,
          ...nextItem,
          createdAt: current!.createdAt,
        };
      } else {
        items.unshift(nextItem);
      }
      await writeUserJsonSetting(ctx.db, ctx.user.id, SAVED_SEARCHES_KEY, items.slice(0, 100));
      return nextItem;
    }),

  deleteSavedSearch: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const items = await loadSavedSearches(ctx.db, ctx.user.id);
      const filtered = items.filter((item) => item.id !== input.id);
      await writeUserJsonSetting(ctx.db, ctx.user.id, SAVED_SEARCHES_KEY, filtered);
      return { success: true };
    }),

  checkExistingLeads: protectedProcedure
    .input(z.object({ placeIds: z.array(z.string()) }))
    .query(async ({ ctx, input }) => {
      const existing = await ctx.db.lead.findMany({
        where: { gmbPlaceId: { in: input.placeIds }, createdById: ctx.user.id },
        select: { id: true, gmbPlaceId: true, companyName: true, overallScore: true, scorePriority: true },
      });
      return existing;
    }),

  previewScore: protectedProcedure
    .input(z.object({
      hasWebsite: z.boolean(),
      rating: z.number().optional(),
      reviewCount: z.number().optional(),
    }))
    .query(async ({ input }) => {
      let score = 50;
      if (!input.hasWebsite) score += 20;
      if (input.rating != null) {
        if (input.rating < 3.5) score += 10;
        else if (input.rating > 4.5) score -= 10;
      }
      if (input.reviewCount != null) {
        if (input.reviewCount === 0) score += 10;
        else if (input.reviewCount < 5) score += 5;
        else if (input.reviewCount > 50) score -= 5;
      }
      score = Math.max(0, Math.min(100, score));
      const priority = score >= 75 ? "Hot" : score >= 50 ? "Warm" : "Low";
      return { score, priority };
    }),

  saveSearchResult: protectedProcedure
    .input(searchResultSchema)
    .mutation(async ({ ctx, input }) => {
      // Check by placeId (exact) or company name (fuzzy duplicate prevention)
      const existing = await ctx.db.lead.findFirst({
        where: {
          createdById: ctx.user.id,
          OR: [
            { gmbPlaceId: input.placeId },
            {
              companyName: {
                equals: input.displayName.trim(),
                mode: "insensitive",
              },
            },
          ],
        },
        select: { id: true, companyName: true, gmbPlaceId: true },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: existing.gmbPlaceId === input.placeId
            ? `"${existing.companyName}" bestaat al als lead (zelfde Google-locatie).`
            : `"${existing.companyName}" bestaat al als lead (zelfde bedrijfsnaam).`,
        });
      }

      // Extract city from formatted address
      const city = extractCity(input.formattedAddress);

      // Set industry from primaryType if available
      const industry = input.primaryType
        ? input.primaryType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : undefined;

      const lead = await ctx.db.lead.create({
        data: {
          companyName: input.displayName,
          address: input.formattedAddress,
          city,
          industry,
          website: input.websiteUri,
          phone: input.nationalPhoneNumber,
          gmbPlaceId: input.placeId,
          gmbRating: input.rating,
          gmbReviewCount: input.userRatingCount,
          gmbCategories: input.types ?? [],
          source: "google_places",
          sourceQuery: input.displayName,
          createdById: ctx.user.id,
        },
      });

      await ctx.db.activity.create({
        data: {
          leadId: lead.id,
          userId: ctx.user.id,
          type: "LEAD_CREATED",
          title: `Lead "${lead.companyName}" opgeslagen vanuit Google Places`,
          metadata: { placeId: input.placeId, source: "google_places" },
        },
      });

      return lead;
    }),
});
