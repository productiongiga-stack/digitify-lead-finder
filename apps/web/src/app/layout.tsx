import type { Metadata } from "next";
import { headers } from "next/headers";
import { Poppins } from "next/font/google";
import "./globals.css";
import { TRPCProvider } from "@/lib/trpc/provider";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { ShellProvider } from "@/components/layout/shell-provider";
import { BrandingCssVariables } from "@/components/layout/branding-css-variables";
import { UiDensityProvider } from "@/components/layout/ui-density-provider";
import { ToastProvider } from "@/components/feedback/toast-provider";
import { AnalyticsScripts } from "@/components/analytics/analytics-scripts";
import { SessionProvider } from "@/components/layout/session-provider";
import { buildRootMetadata } from "@/lib/seo/build-metadata";
import { loadPublicSeoConfig } from "@/lib/seo/load-public-seo";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
  variable: "--font-poppins",
});

export async function generateMetadata(): Promise<Metadata> {
  const config = await loadPublicSeoConfig();
  return buildRootMetadata(config);
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-csp-nonce") ?? undefined;

  return (
    <html lang="nl" suppressHydrationWarning className={poppins.variable}>
      <body
        suppressHydrationWarning
        className="font-sans"
        style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif" }}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <TRPCProvider>
            <SessionProvider>
            <ToastProvider>
              <ShellProvider>
                <AnalyticsScripts nonce={nonce} />
                <BrandingCssVariables />
                <UiDensityProvider />
                {children}
              </ShellProvider>
            </ToastProvider>
            </SessionProvider>
          </TRPCProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
