"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, BarChart3, CheckCircle2, FileText, Globe2, MailCheck, Search, Star } from "lucide-react";
import { MARKETING_BUNDLES, type MarketingBundleSlug } from "@/lib/marketing/marketing-bundles";

const BUNDLE_UI: Record<MarketingBundleSlug, { icon: typeof Search; accent: string; purpose: string; preview: string[] }> = {
  "lead-engine": { icon: Search, accent: "#f9ae5a", purpose: "Leads vinden & scoren", preview: ["Studio Noord", "Pixel Office", "Nova Dental"] },
  "outreach-hub": { icon: MailCheck, accent: "#06b6d4", purpose: "Opvolging & outreach", preview: ["AI draft", "Wacht op goedkeuring", "Klaar om te verzenden"] },
  "sales-workspace": { icon: FileText, accent: "#e85d3a", purpose: "Verkoop & uitvoering", preview: ["Offerte klaar", "Demo gepland", "Project gestart"] },
  "marketing-studio": { icon: Star, accent: "#10b981", purpose: "Content & campagnes", preview: ["Social Planner", "Creative Studio", "Meta & Google Ads"] },
  "website-growth": { icon: Globe2, accent: "#3b82f6", purpose: "Website & inbound", preview: ["SEO-signalen", "Formulieraanvragen", "Website-audits"] },
  "customer-experience": { icon: Star, accent: "#ec4899", purpose: "Bookings & reputatie", preview: ["Booking bevestigd", "Chatbot actief", "Review gevraagd"] },
  "automation-insights": { icon: BarChart3, accent: "#8b5cf6", purpose: "Automatisering & inzicht", preview: ["Rapportage", "Workflow actief", "Activiteitenlog"] },
};

export function MarketingHomeHeroTabs() {
  const [activeSlug, setActiveSlug] = useState<MarketingBundleSlug>("lead-engine");
  const active = MARKETING_BUNDLES.find((bundle) => bundle.slug === activeSlug) ?? MARKETING_BUNDLES[0];
  const ui = BUNDLE_UI[active.slug];
  const ActiveIcon = ui.icon;
  const activeIndex = MARKETING_BUNDLES.findIndex((bundle) => bundle.slug === active.slug);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#dfe6e1] bg-white shadow-[0_22px_56px_rgba(13,21,32,0.14)]">
      <div className="border-b border-[#edf1ee] bg-[#f9fbfa] p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between px-1">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b66d1e]">7 modules in één flow</p>
            <p className="mt-1 text-xs font-semibold text-[#5a6878]">Kies waar je vandaag mee wilt starten</p>
          </div>
          <span className="rounded-full border border-[#dfe6e1] bg-white px-2.5 py-1 text-[10px] font-bold text-[#7a8898]">{String(activeIndex + 1).padStart(2, "0")} / 07</span>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-2">
          {MARKETING_BUNDLES.map((bundle) => {
            const Icon = BUNDLE_UI[bundle.slug].icon;
            const bundleUi = BUNDLE_UI[bundle.slug];
            const selected = bundle.slug === activeSlug;
            return (
              <button key={bundle.slug} type="button" onClick={() => setActiveSlug(bundle.slug)} aria-pressed={selected} className={`inline-flex min-h-[48px] items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition sm:px-3 ${selected ? "border-transparent text-[#14100b] shadow-sm" : "border-[#e2e8e3] bg-white text-[#344052] hover:border-[#f9ae5a]/40 hover:bg-[#fffdf9]"}`} style={selected ? { backgroundColor: bundleUi.accent } : undefined}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-white/25" : "bg-[#f4f7f5]"}`}>
                  <Icon className="h-3.5 w-3.5" style={{ color: selected ? "currentColor" : bundleUi.accent }} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[10px] font-extrabold sm:text-[11px]">{bundle.label}</span>
                  <span className={`mt-0.5 hidden truncate text-[9px] font-medium sm:block ${selected ? "text-[#14100b]/70" : "text-[#8b98a4]"}`}>{bundleUi.purpose}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#f9ae5a]/30 bg-[#fff8ee] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#b66d1e]"><ActiveIcon className="h-3 w-3" />Actieve module</div>
          <Link href={`/oplossingen/${active.slug}`} className="inline-flex items-center gap-1 text-xs font-bold text-[#b66d1e]">Bekijk bundel <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
        <div className="rounded-xl border border-[#e2e8e3] bg-[#f9fbfa] p-4">
          <div className="border-b border-[#e2e8e3] pb-3"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: ui.accent }}>{active.eyebrow}</p><p className="mt-1 text-sm font-extrabold text-[#0d1520]">{active.shortLabel}</p></div><span className="rounded-md bg-white px-2 py-1 text-[10px] font-bold text-[#5a6878]">{active.monthly}/m</span></div><p className="mt-2 text-xs leading-5 text-[#5a6878]">{active.description}</p></div>
          <div className="mt-3 space-y-2">{ui.preview.map((item, index) => <div key={item} className="flex items-center gap-2 rounded-lg border border-[#e2e8e3] bg-white px-3 py-2.5 text-xs font-semibold text-[#344052]"><CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: ui.accent }} />{item}<span className="ml-auto text-[10px] text-[#9aafbe]">{index === 0 ? "Actief" : "Klaar"}</span></div>)}</div>
        </div>
      </div>
    </div>
  );
}
