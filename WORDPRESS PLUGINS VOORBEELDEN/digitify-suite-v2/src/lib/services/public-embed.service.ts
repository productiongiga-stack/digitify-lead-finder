// ============================================================================
// Public Embed Service
//
// Handles embed code generation, domain validation, and public page resolution
// for the Distribution Layer (iframe, JS widget, hosted pages).
// ============================================================================

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.digitify.be";

export interface EmbedCode {
  iframe: string;
  jsSnippet: string;
  hostedUrl: string;
}

/**
 * Generate embed codes for a configurator.
 */
export function generateConfiguratorEmbedCodes(
  configuratorSlug: string,
  options?: {
    width?: string;
    height?: string;
    borderRadius?: string;
    shadow?: boolean;
    hideHeader?: boolean;
    hideFooter?: boolean;
  }
): EmbedCode {
  const width = options?.width ?? "100%";
  const height = options?.height ?? "700px";
  const borderRadius = options?.borderRadius ?? "12px";
  const shadow = options?.shadow ?? true;
  const params = new URLSearchParams();
  if (options?.hideHeader) params.set("hideHeader", "1");
  if (options?.hideFooter) params.set("hideFooter", "1");

  const embedUrl = `${BASE_URL}/embed/configurator/${configuratorSlug}${params.toString() ? `?${params}` : ""}`;
  const hostedUrl = `${BASE_URL}/configure/${configuratorSlug}`;

  const iframe = `<iframe
  src="${embedUrl}"
  width="${width}"
  height="${height}"
  style="border: none; border-radius: ${borderRadius};${shadow ? " box-shadow: 0 4px 24px rgba(0,0,0,0.08);" : ""} max-width: 100%;"
  loading="lazy"
  allow="payment"
  title="Digitify Configurator"
></iframe>`;

  const jsSnippet = `<div id="digitify-configurator" data-slug="${configuratorSlug}"></div>
<script>
(function() {
  var d = document, s = d.createElement('script');
  s.src = '${BASE_URL}/embed/widget.js';
  s.async = true;
  s.dataset.type = 'configurator';
  s.dataset.slug = '${configuratorSlug}';
  s.dataset.width = '${width}';
  s.dataset.height = '${height}';
  ${options?.hideHeader ? "s.dataset.hideHeader = '1';" : ""}
  ${options?.hideFooter ? "s.dataset.hideFooter = '1';" : ""}
  d.head.appendChild(s);
})();
</script>`;

  return { iframe, jsSnippet, hostedUrl };
}

/**
 * Generate embed codes for a booking page.
 */
export function generateBookingEmbedCodes(
  bookingSlug: string,
  options?: {
    width?: string;
    height?: string;
  }
): EmbedCode {
  const width = options?.width ?? "100%";
  const height = options?.height ?? "600px";

  const embedUrl = `${BASE_URL}/embed/booking/${bookingSlug}`;
  const hostedUrl = `${BASE_URL}/book/${bookingSlug}`;

  const iframe = `<iframe
  src="${embedUrl}"
  width="${width}"
  height="${height}"
  style="border: none; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); max-width: 100%;"
  loading="lazy"
  title="Digitify Booking"
></iframe>`;

  const jsSnippet = `<div id="digitify-booking" data-slug="${bookingSlug}"></div>
<script>
(function() {
  var d = document, s = d.createElement('script');
  s.src = '${BASE_URL}/embed/widget.js';
  s.async = true;
  s.dataset.type = 'booking';
  s.dataset.slug = '${bookingSlug}';
  s.dataset.width = '${width}';
  s.dataset.height = '${height}';
  d.head.appendChild(s);
})();
</script>`;

  return { iframe, jsSnippet, hostedUrl };
}

/**
 * Validate that a request origin is allowed for an embed.
 */
export function isAllowedOrigin(
  origin: string | null,
  allowedDomains: string[]
): boolean {
  // No restrictions = allow all
  if (allowedDomains.length === 0) return true;
  if (!origin) return false;

  try {
    const url = new URL(origin);
    const hostname = url.hostname;

    return allowedDomains.some((domain) => {
      if (domain.startsWith("*.")) {
        const suffix = domain.slice(2);
        return hostname === suffix || hostname.endsWith(`.${suffix}`);
      }
      return hostname === domain;
    });
  } catch {
    return false;
  }
}

/**
 * Build the frame-ancestors CSP header for embed pages.
 */
export function buildFrameAncestorsCSP(allowedDomains: string[]): string {
  if (allowedDomains.length === 0) return "frame-ancestors *";
  const hosts = allowedDomains.map((d) =>
    d.startsWith("*.") ? `https://${d}` : `https://${d}`
  );
  return `frame-ancestors 'self' ${hosts.join(" ")}`;
}
