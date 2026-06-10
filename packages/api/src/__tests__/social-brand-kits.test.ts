import { describe, expect, it } from "vitest";
import { mergeBrandKitWithWorkspace, type SocialBrandKit } from "../lib/social-brand-kits";
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
