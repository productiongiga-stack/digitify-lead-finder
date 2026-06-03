import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/social-meta", async (importActual) => {
  const actual = await importActual<typeof import("../lib/social-meta")>();
  return {
    ...actual,
    metaGet: vi.fn(),
  };
});

import { metaGet } from "../lib/social-meta";
import { loadMetaPublisherIdentity } from "../lib/meta-ads";

describe("loadMetaPublisherIdentity", () => {
  beforeEach(() => {
    vi.mocked(metaGet).mockReset();
  });

  it("uses ad account name for Facebook and Instagram when IG is linked", async () => {
    vi.mocked(metaGet).mockResolvedValue({
      name: "Digitify Page",
      instagram_business_account: { id: "ig_1", username: "digitify.be" },
    });

    const identity = await loadMetaPublisherIdentity({
      config: {
        pageId: "page_1",
        pageAccessToken: "token",
        accessToken: "user",
        instagramBusinessId: "ig_1",
      },
      adAccountName: "Digitify Ads",
    });

    expect(identity.facebookPublisherName).toBe("Digitify Ads");
    expect(identity.instagramPublisherName).toBe("Digitify Ads");
    expect(identity.hasInstagram).toBe(true);
  });

  it("falls back Instagram name to Facebook when no IG is linked", async () => {
    vi.mocked(metaGet).mockResolvedValue({
      name: "Digitify Page",
      instagram_business_account: undefined,
    });

    const identity = await loadMetaPublisherIdentity({
      config: {
        pageId: "page_1",
        pageAccessToken: "token",
        accessToken: "user",
        instagramBusinessId: "",
      },
      adAccountName: "Digitify Ads",
    });

    expect(identity.facebookPublisherName).toBe("Digitify Ads");
    expect(identity.instagramPublisherName).toBe("Digitify Ads");
    expect(identity.hasInstagram).toBe(false);
  });
});
