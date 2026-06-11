import { describe, expect, it, vi } from "vitest";
import {
  mergeBrandKitWithWorkspace,
  upsertSocialBrandKit,
  type SocialBrandKit,
} from "../lib/social-brand-kits";
import type { PrismaClient } from "@digitify/db";
import type { CreativeBrandContext } from "@digitify/media-studio";

const workspaceBrand: CreativeBrandContext = {
  enabled: true,
  includeLogo: true,
  companyName: "Digitify",
  primaryColor: "#111111",
  brandVoice: "professioneel",
};

const kit: SocialBrandKit = {
  id: "kit_1",
  name: "Klant A",
  isDefault: false,
  companyName: "Klant A BV",
  slogan: "Groei zonder chaos",
  primaryColor: "#ff5500",
  logoUrl: "https://example.com/logo.png",
  website: "https://klanta.be",
  brandVoice: "warm en direct",
  brandKeywords: "marketing kmo",
  brandAvoid: "goedkoop",
  brandSummary: "Marketing voor KMO",
  brandSignature: "Klant A · marketing",
  defaultHashtags: "marketing belgie",
  defaultTone: "warm en professioneel",
  defaultCta: "Plan een gesprek",
  defaultLinkUrl: "https://klanta.be/contact",
  includeLogo: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("mergeBrandKitWithWorkspace", () => {
  it("overrides workspace brand fields with selected social brand kit", () => {
    const merged = mergeBrandKitWithWorkspace(workspaceBrand, kit);
    expect(merged.companyName).toBe("Klant A BV");
    expect(merged.primaryColor).toBe("#ff5500");
    expect(merged.brandVoice).toBe("warm en direct");
    expect(merged.includeLogo).toBe(false);
  });

  it("returns workspace brand when no kit is selected", () => {
    expect(mergeBrandKitWithWorkspace(workspaceBrand, null)).toEqual(workspaceBrand);
  });
});

describe("upsertSocialBrandKit", () => {
  it("adds a second brand kit without replacing the first", async () => {
    const store = new Map<string, string>();
    const workspaceId = "ws_test";

    const db = {
      setting: {
        findMany: vi.fn(async ({ where }: { where: { key: { in?: string[]; startsWith?: string } } }) => {
          if (where.key.in) {
            return where.key.in
              .map((key: string) => {
                const value = store.get(key);
                return value ? { key, value } : null;
              })
              .filter(Boolean);
          }
          if (where.key.startsWith) {
            const prefix = where.key.startsWith as string;
            return Array.from(store.entries())
              .filter(([key]) => key.startsWith(prefix))
              .map(([key, value]) => ({ key, value }));
          }
          return [];
        }),
        upsert: vi.fn(
          async ({
            where,
            update,
            create,
          }: {
            where: { key: string };
            update: { value: string };
            create: { key: string; value: string };
          }) => {
            const value = update?.value ?? create.value;
            store.set(where.key, value);
            return { key: where.key, value };
          },
        ),
      },
    } as unknown as PrismaClient;

    const existingKit: SocialBrandKit = {
      ...kit,
      id: "kit_existing",
      name: "Hoofdmerk",
      isDefault: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    store.set(`workspace:${workspaceId}:social.brand_kits`, JSON.stringify([existingKit]));
    store.set(`workspace:${workspaceId}:social.default_brand_kit_id`, existingKit.id);

    const second = await upsertSocialBrandKit(db, workspaceId, { name: "Klant B", companyName: "Klant B BV" });

    expect(second.id).not.toBe(existingKit.id);
    const stored = JSON.parse(
      store.get(`workspace:${workspaceId}:social.brand_kits`) || "[]",
    ) as SocialBrandKit[];
    expect(stored).toHaveLength(2);
    expect(stored.map((item) => item.name)).toEqual(expect.arrayContaining(["Hoofdmerk", "Klant B"]));
  });
});
