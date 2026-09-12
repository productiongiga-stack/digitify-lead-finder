export type LocalConnectorId = "google" | "meta" | "smtp" | "imap" | "muapi" | "webhook" | "stripe" | "wordpress";
export type LocalConnectorProbeStatus = "READY" | "NOT_CONFIGURED";

export type LocalConnectorProbe = {
  connectorId: LocalConnectorId;
  adapter: "local-mock";
  status: LocalConnectorProbeStatus;
  code: "CONFIGURATION_OK" | "MISSING_CONFIGURATION" | "PROVIDER_ADAPTER_PENDING";
  message: string;
};

/** Deterministic provider adapter used by local checks; it never performs network I/O. */
export function runLocalConnectorProbe(input: {
  connectorId: LocalConnectorId;
  missing: readonly string[];
}): LocalConnectorProbe {
  if (input.connectorId === "stripe" || input.connectorId === "wordpress") {
    return {
      connectorId: input.connectorId,
      adapter: "local-mock",
      status: "NOT_CONFIGURED",
      code: "PROVIDER_ADAPTER_PENDING",
      message: `${input.connectorId === "stripe" ? "Stripe" : "WordPress"} heeft nog geen lokale provider-adapter.`,
    };
  }

  if (input.missing.length > 0) {
    return {
      connectorId: input.connectorId,
      adapter: "local-mock",
      status: "NOT_CONFIGURED",
      code: "MISSING_CONFIGURATION",
      message: "Configuratie ontbreekt voor deze connector.",
    };
  }

  return {
    connectorId: input.connectorId,
    adapter: "local-mock",
    status: "READY",
    code: "CONFIGURATION_OK",
    message: "Lokale connector-test geslaagd. Er is geen externe verbinding aangeroepen.",
  };
}
