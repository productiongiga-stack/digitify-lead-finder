import { describe, expect, it, vi, afterEach } from "vitest";
import Stripe from "stripe";
import { creativeStripe } from "../lib/creative-stripe";
import { creativePriceKey } from "../lib/creative-credits";
afterEach(() => vi.unstubAllEnvs());
describe("Creative test payments", () => {
  it("rejects live or missing keys", () => {
    vi.stubEnv("CREATIVE_STRIPE_TEST_SECRET_KEY", "sk_live_forbidden");
    expect(() => creativeStripe()).toThrow("nog niet ingesteld");
    vi.stubEnv("CREATIVE_STRIPE_TEST_SECRET_KEY", "");
    expect(() => creativeStripe()).toThrow("nog niet ingesteld");
  });
  it("verifies raw webhook bodies and rejects tampering", () => {
    const stripe = new Stripe("sk_test_no_network");
    const body = JSON.stringify({
      id: "evt_test",
      type: "checkout.session.completed",
      data: { object: {} },
    });
    const secret = "whsec_test";
    const signature = stripe.webhooks.generateTestHeaderString({
      payload: body,
      secret,
    });
    expect(stripe.webhooks.constructEvent(body, signature, secret).id).toBe(
      "evt_test",
    );
    expect(() =>
      stripe.webhooks.constructEvent(body + " ", signature, secret),
    ).toThrow();
  });
  it("prices exact settings independent of object property order", () => {
    expect(creativePriceKey("model", { resolution: "720p", duration: 5 })).toBe(
      creativePriceKey("model", { duration: 5, resolution: "720p" }),
    );
    expect(creativePriceKey("model", { duration: 10 })).not.toBe(
      creativePriceKey("model", { duration: 5 }),
    );
  });
});
