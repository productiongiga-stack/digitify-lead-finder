import { describe, expect, it } from "vitest";
import {
  buildShellPreviewMessageCatalog,
  findShellPreviewMessage,
  GENERIC_SHELL_PREVIEW_MESSAGE,
} from "../email-shell-preview-messages";

describe("email-shell-preview-messages", () => {
  it("includes generic, starters and system messages", () => {
    const catalog = buildShellPreviewMessageCatalog(
      [
        {
          templateKey: "booking.confirmed",
          module: "BOOKINGS",
          moduleLabel: "Boekingen",
          name: "Afspraak bevestigd",
          subject: "Bevestigd",
          body: "Beste {{contactName}}, je afspraak staat.",
        },
      ],
      [
        {
          name: "Intro — Modern outreach",
          subject: "Hallo",
          body: "Beste {{contactName}}",
          ctaText: "Plan",
          ctaUrl: "{{bookingLink}}",
        },
      ],
    );

    expect(catalog[0].id).toBe("generic");
    expect(catalog.some((item) => item.id.startsWith("starter:"))).toBe(true);
    expect(catalog.some((item) => item.id === "system:booking.confirmed")).toBe(true);
  });

  it("falls back to generic for unknown id", () => {
    const catalog = buildShellPreviewMessageCatalog();
    expect(findShellPreviewMessage(catalog, "missing").id).toBe(GENERIC_SHELL_PREVIEW_MESSAGE.id);
  });
});
