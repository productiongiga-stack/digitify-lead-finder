"use client";

/**
 * Embed Shell — wrapper for all embedded widgets.
 *
 * Provides:
 * - CSS isolation (scoped styles that don't leak to host page)
 * - Consistent base styling
 * - Font loading
 * - Responsive container
 *
 * Used by: /embed/configurator/[slug], /embed/booking/[slug]
 */
export function EmbedShell({
  children,
  backgroundColor = "#ffffff",
  fontFamily,
}: {
  children: React.ReactNode;
  backgroundColor?: string;
  fontFamily?: string | null;
}) {
  return (
    <div
      className="digitify-embed-root"
      style={{
        backgroundColor,
        fontFamily: fontFamily ?? '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        minHeight: "100vh",
        // CSS isolation: prevent host page styles from leaking in
        all: "initial",
        display: "block",
        color: "#1a1a2e",
        fontSize: "14px",
        lineHeight: "1.5",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
      }}
    >
      {/* Reset stylesheet for embed context */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .digitify-embed-root * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            .digitify-embed-root button {
              cursor: pointer;
              border: none;
              background: none;
              font: inherit;
              color: inherit;
            }
            .digitify-embed-root input,
            .digitify-embed-root textarea,
            .digitify-embed-root select {
              font: inherit;
              color: inherit;
            }
            .digitify-embed-root a {
              color: inherit;
              text-decoration: none;
            }
            .digitify-embed-root img {
              max-width: 100%;
              height: auto;
            }
          `,
        }}
      />
      {children}
    </div>
  );
}
