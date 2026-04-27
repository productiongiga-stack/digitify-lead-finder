import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { TRPCProvider } from "@/lib/trpc/provider";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { SessionProvider } from "@/components/layout/session-provider";
import { DynamicFavicon } from "@/components/layout/dynamic-favicon";
import { BrandingCssVariables } from "@/components/layout/branding-css-variables";
import { UiDensityProvider } from "@/components/layout/ui-density-provider";
import { ToastProvider } from "@/components/feedback/toast-provider";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-poppins",
});

const appName = process.env.NEXT_PUBLIC_APP_NAME || "Lead Finder Suite";

export const metadata: Metadata = {
  title: {
    default: appName,
    template: `%s | ${appName}`,
  },
  description: "Slimme lead generation en outreach tool",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" suppressHydrationWarning className={poppins.variable}>
      <body className="font-sans" style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif" }}>
        <SessionProvider>
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
        </SessionProvider>
      </body>
    </html>
  );
}
