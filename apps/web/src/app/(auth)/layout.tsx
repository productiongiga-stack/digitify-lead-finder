import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CheckCircle2 } from "lucide-react";
import { AuthFormSkeleton } from "@/components/auth/auth-form-skeleton";
import { AuthLogo } from "@/components/auth/auth-logo";
import { NOINDEX_METADATA } from "@/lib/seo/build-metadata";

export const metadata: Metadata = NOINDEX_METADATA;

const benefits = [
  "Automatisch leads zoeken en scoren",
  "E-mail outreach & opvolging op autopilot",
  "Offertes, boekingen & reviews in één platform",
  "100% Belgisch — AVG-conform & GDPR-ready",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Left branding panel — hidden on mobile */}
      <div className="relative hidden overflow-hidden border-r border-border/60 bg-card/95 px-12 py-14 shadow-xl lg:flex lg:w-[480px] xl:w-[520px] flex-col justify-between">
        {/* Glow blobs */}
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />

        {/* Logo */}
        <Link href="/" className="relative z-10 flex items-center gap-3">
          <AuthLogo size="sm" showText />
        </Link>

        {/* Center content */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Lead Finder Suite</p>
            <h2 className="text-3xl font-bold leading-snug text-foreground">
              Groei sneller met<br />
              <span className="text-primary">slimme lead generatie</span>
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Vind, scoor en benader de juiste klanten automatisch — zodat jij je focust op afsluiten.
            </p>
          </div>

          <ul className="space-y-3">
            {benefits.map((b) => (
              <li key={b} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="text-sm text-muted-foreground">{b}</span>
              </li>
            ))}
          </ul>

          {/* Mini stat bar */}
          <div className="grid grid-cols-3 gap-4 rounded-2xl border border-border/60 bg-muted/35 p-5">
            {[
              { val: "8+", label: "modules" },
              { val: "100%", label: "Belgisch" },
              { val: "24/7", label: "automation" },
            ].map(({ val, label }) => (
              <div key={label} className="text-center">
                <p className="text-xl font-bold text-primary">{val}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom disclaimer */}
        <p className="relative z-10 text-xs text-muted-foreground" suppressHydrationWarning>
          © {new Date().getFullYear()} Digitify · BTW BE0685.556.507
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* Mobile-only logo */}
        <Link href="/" className="mb-8 flex items-center gap-2 lg:hidden">
          <AuthLogo size="sm" showText />
        </Link>

        <div className="w-full max-w-md">
          <Suspense fallback={<AuthFormSkeleton />}>{children}</Suspense>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Terug naar{" "}
          <Link href="/" className="font-medium text-primary hover:underline">
            de website
          </Link>
        </p>
      </div>
    </div>
  );
}
