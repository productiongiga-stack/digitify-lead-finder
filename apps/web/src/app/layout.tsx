import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { TRPCProvider } from "@/lib/trpc/provider";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { DynamicFavicon } from "@/components/layout/dynamic-favicon";
import { BrandingCssVariables } from "@/components/layout/branding-css-variables";
import { UiDensityProvider } from "@/components/layout/ui-density-provider";
import { ToastProvider } from "@/components/feedback/toast-provider";
import { buildRootMetadata } from "@/lib/seo/build-metadata";
import { loadPublicSeoConfig } from "@/lib/seo/load-public-seo";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-poppins",
});

export async function generateMetadata(): Promise<Metadata> {
  const config = await loadPublicSeoConfig();
  return buildRootMetadata(config);
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" suppressHydrationWarning className={poppins.variable}>
      <body
        suppressHydrationWarning
        className="font-sans"
        style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif" }}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <TRPCProvider>
            <ToastProvider>
              <BrandingCssVariables />
              <UiDensityProvider />
              <DynamicFavicon />
              {children}
            </ToastProvider>
          </TRPCProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
