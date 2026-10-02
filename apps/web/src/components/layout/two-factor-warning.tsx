"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
export function TwoFactorWarning() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    const check = () => fetch("/api/two-factor/status", { cache: "no-store" }).then(async (response) => { if (!response.ok) throw new Error(); return response.json(); }).then((value) => { if (active) setEnabled(value.enabled === true); }).catch(() => { if (active) setEnabled(null); });
    void check();
    const timer = setInterval(check, 60000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  if (enabled === true) return null;
  const label = enabled === false ? "2FA niet ingesteld" : "2FA-status controleren";
  return <Link href="/settings/account?tab=security" title={label} aria-label={label + " — open persoonlijke beveiliging"} className="inline-flex min-h-9 min-w-9 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-2 text-xs font-semibold text-amber-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"><ShieldAlert className="h-4 w-4 shrink-0" /><span className="hidden lg:inline">{label}</span></Link>;
}
