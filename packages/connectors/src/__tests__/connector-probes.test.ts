import { describe, expect, it } from "vitest";
import { runLocalConnectorProbe } from "../connector-probes";

describe("local connector probes", () => {
  it("returns a ready result for valid local configuration", () => {
    expect(runLocalConnectorProbe({ connectorId: "smtp", missing: [] })).toMatchObject({
      adapter: "local-mock",
      status: "READY",
      code: "CONFIGURATION_OK",
    });
  });

  it("classifies missing configuration without a network call", () => {
    expect(runLocalConnectorProbe({ connectorId: "webhook", missing: ["Webhook-URL"] })).toMatchObject({
      status: "NOT_CONFIGURED",
      code: "MISSING_CONFIGURATION",
    });
  });

  it("keeps providers without adapters explicit", () => {
    expect(runLocalConnectorProbe({ connectorId: "stripe", missing: ["Stripe is nog niet geconfigureerd"] })).toMatchObject({
      status: "NOT_CONFIGURED",
      code: "PROVIDER_ADAPTER_PENDING",
    });
  });
});
