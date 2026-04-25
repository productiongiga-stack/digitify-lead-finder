import Image from "next/image";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

const benefits = [
  "Automatisch leads zoeken en scoren",
  "E-mail outreach & opvolging op autopilot",
  "Offertes, boekingen & reviews in één platform",
  "100% Belgisch — AVG-conform & GDPR-ready",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#fffdf9]">
      {/* Left branding panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[520px] flex-col justify-between bg-[#0d1520] px-12 py-14 relative overflow-hidden">
        {/* Glow blobs */}
        <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[#f9ae5a] opacity-10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-[#f9ae5a] opacity-[0.06] blur-3xl" />

        {/* Logo */}
        <Link href="/" className="relative z-10 flex items-center gap-3">
          <Image src="/favicon.png" alt="Digitify" width={36} height={36} className="rounded-lg" />
          <span className="text-xl font-bold text-white tracking-tight">Digitify</span>
        </Link>

        {/* Center content */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#f9ae5a]">Lead Finder Suite</p>
            <h2 className="text-3xl font-bold leading-snug text-white">
              Groei sneller met<br />
              <span className="text-[#f9ae5a]">slimme lead generatie</span>
            </h2>
            <p className="text-sm leading-relaxed text-white/60">
              Vind, scoor en benader de juiste klanten automatisch — zodat jij je focust op afsluiten.
            </p>
          </div>

          <ul className="space-y-3">
            {benefits.map((b) => (
              <li key={b} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#f9ae5a]" />
                <span className="text-sm text-white/75">{b}</span>
              </li>
            ))}
          </ul>

          {/* Mini stat bar */}
          <div className="grid grid-cols-3 gap-4 rounded-xl border border-white/10 bg-white/5 p-5">
            {[
              { val: "8+", label: "modules" },
              { val: "100%", label: "Belgisch" },
              { val: "24/7", label: "automation" },
            ].map(({ val, label }) => (
              <div key={label} className="text-center">
                <p className="text-xl font-bold text-[#f9ae5a]">{val}</p>
                <p className="mt-0.5 text-xs text-white/50">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom disclaimer */}
        <p className="relative z-10 text-xs text-white/30">
          © {new Date().getFullYear()} Digitify · BTW BE0685.556.507
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* Mobile-only logo */}
        <Link href="/" className="mb-8 flex items-center gap-2 lg:hidden">
          <Image src="/favicon.png" alt="Digitify" width={28} height={28} className="rounded-md" />
          <span className="font-bold text-[#0d1520]">Digitify</span>
        </Link>

        <div className="w-full max-w-md">{children}</div>

        <p className="mt-8 text-center text-xs text-[#0d1520]/40">
          Terug naar{" "}
          <Link href="/" className="font-medium text-[#f9ae5a] hover:underline">
            de website
          </Link>
        </p>
      </div>
    </div>
  );
}
