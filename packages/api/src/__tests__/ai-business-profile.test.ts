import { describe, expect, it } from "vitest";
import { loadAiBusinessProfile } from "../lib/ai-business-profile";
import { buildMetaCampaignSystemPrompt } from "../lib/meta-ads-ai";

function fakeDb(rows: Array<{ key: string; value: string }>) {
  return { setting: { findMany: async ({ where }: any) => rows.filter((row) => where.key?.in?.includes(row.key) || (where.key?.startsWith && row.key.startsWith(where.key.startsWith))) } } as any;
}

describe("workspace AI business profile", () => {
  it("keeps Revisual and Digitify profiles isolated", async () => {
    const revisual = await loadAiBusinessProfile(fakeDb([
      { key: "workspace:revisual:branding.company_name", value: "Revisual" },
      { key: "workspace:revisual:company.niche", value: "Vastgoedsoftware" },
      { key: "workspace:revisual:ai.business_profile", value: JSON.stringify({ idealCustomer: "Vastgoedkantoren", primaryOffer: "Visualisatieplatform" }) },
    ]), "revisual");
    const digitify = await loadAiBusinessProfile(fakeDb([
      { key: "workspace:digitify:branding.company_name", value: "Digitify" },
      { key: "workspace:digitify:company.niche", value: "Digitale groei" },
      { key: "workspace:digitify:ai.business_profile", value: JSON.stringify({ idealCustomer: "Belgische KMO's", primaryOffer: "Lead Finder" }) },
    ]), "digitify");
    expect(revisual.companyName).toBe("Revisual");
    expect(revisual.idealCustomer).toBe("Vastgoedkantoren");
    expect(digitify.companyName).toBe("Digitify");
    expect(digitify.idealCustomer).toContain("KMO");
    expect(revisual.hash).not.toBe(digitify.hash);
  });

  it("does not inject a generic Digitify business claim into Meta prompts", () => {
    const prompt = buildMetaCampaignSystemPrompt("", "Revisual", "Vastgoedsoftware\nVastgoedkantoren");
    expect(prompt).toContain("Revisual");
    expect(prompt).toContain("Vastgoedsoftware");
    expect(prompt).not.toContain("Digitify is een digitaal marketingbureau");
  });
});
