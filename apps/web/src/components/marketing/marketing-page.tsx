"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  FileText,
  Globe2,
  Mail,
  MailCheck,
  MapPin,
  MessageSquareText,
  Phone,
  Quote,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Users2,
  Zap,
  Target,
  Layers3,
  TrendingUp,
  Clock,
  Award,
  Building2,
  Lightbulb,
  Heart,
  ExternalLink,
} from "lucide-react";

type MarketingPageKey = "home" | "product" | "solutions" | "about" | "contact";

type MarketingPageProps = {
  page: MarketingPageKey;
};

const navItems = [
  { label: "Product", href: "/product" },
  { label: "Oplossingen", href: "/oplossingen" },
  { label: "Over ons", href: "/over-ons" },
  { label: "Contact", href: "/contact" },
];

export function MarketingPage({ page }: MarketingPageProps) {
  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#0d1520]">
      <MarketingHeader activePage={page} />
      {page === "home" && <HomePage />}
      {page === "product" && <ProductPage />}
      {page === "solutions" && <SolutionsPage />}
      {page === "about" && <AboutPage />}
      {page === "contact" && <ContactPage />}
      <MarketingFooter />
    </main>
  );
}

/* ─── HEADER ─── */

function MarketingHeader({ activePage }: { activePage: MarketingPageKey }) {
  return (
    <header className="sticky top-0 z-50 border-b border-[#dfe5df]/80 bg-[#f7f8f6]/92 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="Digitify Lead Finder home">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f9ae5a] text-[#14100b] shadow-sm">
            <Zap className="h-4 w-4" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-bold tracking-tight">Digitify</span>
            <span className="block text-xs text-[#5a6878]">Lead Finder</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Hoofdnavigatie">
          {navItems.map((item) => {
            const isActive = (activePage === "product" && item.href === "/product") ||
              (activePage === "solutions" && item.href === "/oplossingen") ||
              (activePage === "about" && item.href === "/over-ons") ||
              (activePage === "contact" && item.href === "/contact");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-[#f9ae5a]/15 text-[#f9ae5a]"
                    : "text-[#344052] hover:bg-black/5 hover:text-[#0d1520]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="inline-flex h-9 items-center justify-center rounded-md border border-[#cfd8d2] bg-white px-3 text-sm font-semibold text-[#172131] shadow-sm transition hover:border-[#f9ae5a]/50 hover:text-[#f9ae5a]"
          >
            Login
          </Link>
          <Link
            href="/contact"
            className="hidden h-9 items-center justify-center rounded-md bg-[#f9ae5a] px-4 text-sm font-semibold text-[#14100b] shadow-[0_4px_14px_rgba(249,174,90,0.4)] transition hover:bg-[#eca04e] sm:inline-flex"
          >
            Plan demo
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ─── HOME PAGE ─── */

function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[#dfe5df] bg-gradient-to-b from-[#fbfcfb] to-[#eef3ef]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_60%_-10%,rgba(249,174,90,0.12),transparent)]" />
        <div className="mx-auto grid min-h-[calc(88vh-4rem)] max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_1.1fr] lg:py-20">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#f9ae5a]/30 bg-[#f9ae5a]/10 px-3.5 py-1.5 text-xs font-semibold text-[#c47c1a]">
              <Sparkles className="h-3 w-3" />
              Digitify Lead Finder · Belgische groeitool
            </div>
            <h1 className="text-5xl font-bold leading-[1.02] tracking-tight text-[#0d1520] sm:text-6xl lg:text-[4.5rem]">
              Van lead naar klant,{" "}
              <span className="relative whitespace-nowrap">
                <span className="relative z-10">zonder ruis.</span>
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 320 12" fill="none" aria-hidden>
                  <path d="M4 8 Q160 0 316 8" stroke="#f9ae5a" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </span>
            </h1>
            <p className="mt-7 max-w-lg text-lg leading-8 text-[#4d5b6b]">
              Vind betere leads, scoreer commerciële fit en zet elke kans om naar outreach, offerte, booking of review — vanuit één werkplek.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/contact"
                className="inline-flex h-12 items-center justify-center rounded-lg bg-[#f9ae5a] px-7 text-sm font-bold text-[#14100b] shadow-[0_8px_30px_rgba(249,174,90,0.45)] transition hover:bg-[#eca04e] hover:shadow-[0_8px_30px_rgba(249,174,90,0.6)]"
              >
                Plan een demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="/product"
                className="inline-flex h-12 items-center justify-center rounded-lg border border-[#cfd8d2] bg-white px-7 text-sm font-semibold text-[#172131] shadow-sm transition hover:border-[#9fb4c8]"
              >
                Ontdek het product
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
            <div className="mt-10 grid max-w-sm grid-cols-3 gap-3">
              {[
                { value: "6+", label: "Groeiflows" },
                { value: "BE", label: "Belgisch team" },
                { value: "∞", label: "Leads zoeken" },
              ].map(({ value, label }) => (
                <div key={label} className="rounded-lg border border-[#dfe5df] bg-white/80 p-3 text-center">
                  <div className="text-2xl font-bold text-[#0d1520]">{value}</div>
                  <div className="mt-1 text-xs text-[#6a7684]">{label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="hidden lg:block">
            <HomeMockup />
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-b border-[#dfe5df] bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-6 px-5 py-5 sm:px-8 md:justify-between">
          {[
            { icon: Search, label: "Lead discovery" },
            { icon: MailCheck, label: "Outreach management" },
            { icon: FileText, label: "Quote automation" },
            { icon: Star, label: "Review growth" },
            { icon: Bot, label: "AI chatbot" },
            { icon: BarChart3, label: "Rapportage" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-sm font-medium text-[#5a6878]">
              <Icon className="h-4 w-4 text-[#12a66a]" />
              {label}
            </div>
          ))}
        </div>
      </section>

      {/* Feature grid */}
      <section className="bg-[#f7f8f6] py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#f9ae5a]">Alles in één app</p>
            <h2 className="mt-3 text-4xl font-bold leading-tight text-[#0d1520]">
              Een command center voor commerciële groei.
            </h2>
            <p className="mt-4 text-base leading-7 text-[#5a6878]">
              Lead Finder vervangt losse tools, spreadsheets en copy-paste workflows door één heldere operationele hub.
            </p>
          </div>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Search, title: "Lead discovery", copy: "Vind relevante bedrijven per regio of niche en verrijk contactdata automatisch.", color: "#3b82f6" },
              { icon: Target, title: "Lead scoring", copy: "Meet website, SEO, reviews en social presence. Zie wie klaar is voor outreach.", color: "#8b5cf6" },
              { icon: MailCheck, title: "Outreach & campagnes", copy: "Templates, drip-sequences en goedkeuringsflows zonder losse spreadsheets.", color: "#f9ae5a" },
              { icon: FileText, title: "Offertes & rapporten", copy: "Professionele offertes en rapporten vanuit dezelfde leadcontext.", color: "#10b981" },
              { icon: CalendarCheck, title: "Bookings", copy: "Laat prospects afspraken boeken via embed widgets op je website.", color: "#f43f5e" },
              { icon: Star, title: "Review groei", copy: "Verzamel reviews, toon widgets en volg reputatiegroei op.", color: "#f59e0b" },
              { icon: Bot, title: "AI chatbot", copy: "Zet een getrainde chatbot op je site die leads kwalificeert.", color: "#06b6d4" },
              { icon: Layers3, title: "Cockpit & insights", copy: "Pipeline, actiepunten en KPI's in één operationeel overzicht.", color: "#84cc16" },
            ].map(({ icon: Icon, title, copy, color }) => (
              <article
                key={title}
                className="group rounded-xl border border-[#dfe5df] bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(13,21,32,0.1)]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}18` }}>
                  <Icon className="h-5 w-5" style={{ color }} />
                </div>
                <h3 className="mt-5 font-bold text-[#0d1520]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#5a6878]">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section className="bg-gradient-to-b from-[#fbf7f0] to-[#fdf5e8] py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-[#b66d1e]">Hoe het werkt</p>
              <h2 className="mt-3 text-4xl font-bold leading-tight text-[#0d1520]">
                Van zoekopdracht naar opvolging in minuten.
              </h2>
              <p className="mt-5 text-base leading-7 text-[#5a6878]">
                Geen complexe onboarding. Zoek een niche, laat de app kansen scoren en stuur de beste leads direct naar je pipeline.
              </p>
              <div className="mt-8 space-y-4">
                {[
                  { n: "1", title: "Zoek & verrijk", copy: "Kies regio, sector of type bedrijf. De app verzamelt en verrijkt prospects automatisch." },
                  { n: "2", title: "Scoreer commerciële fit", copy: "Elke lead krijgt een score op basis van website, SEO, reviews en social." },
                  { n: "3", title: "Actie & opvolging", copy: "Start outreach, maak een offerte of plan een demo vanuit dezelfde leadkaart." },
                  { n: "4", title: "Meet je resultaten", copy: "Dashboard met pipeline, campagnes, bookings en groeikansen." },
                ].map(({ n, title, copy }) => (
                  <div key={title} className="flex gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f9ae5a] font-bold text-[#14100b]">{n}</span>
                    <div>
                      <p className="font-semibold text-[#0d1520]">{title}</p>
                      <p className="mt-1 text-sm leading-6 text-[#5a6878]">{copy}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8">
                <Link href="/contact" className="inline-flex h-11 items-center justify-center rounded-lg bg-[#0d1520] px-6 text-sm font-semibold text-white transition hover:bg-[#1a2535]">
                  Start nu met een demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { icon: TrendingUp, label: "Pipeline waarde", value: "€ 84.200", sub: "Dit kwartaal" },
                { icon: CheckCircle2, label: "Leads opgevolgd", value: "147", sub: "Actief in pipeline" },
                { icon: Clock, label: "Tijdsbesparing", value: "~8u/week", sub: "Vs. losse tools" },
                { icon: Award, label: "Gemiddelde score", value: "76 / 100", sub: "Commerciële fit" },
              ].map(({ icon: Icon, label, value, sub }) => (
                <div key={label} className="rounded-xl border border-[#edd5bb] bg-white p-5 shadow-sm">
                  <Icon className="h-5 w-5 text-[#f9ae5a]" />
                  <p className="mt-3 text-xs font-medium text-[#6a7684]">{label}</p>
                  <p className="mt-1 text-2xl font-bold text-[#0d1520]">{value}</p>
                  <p className="mt-1 text-xs text-[#9aafbe]">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Dark benefits */}
      <section className="bg-[#0d1520] py-24 text-white">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-[#8bbdff]">Waarom het werkt</p>
              <h2 className="mt-3 text-4xl font-bold leading-tight">
                Van commerciële intentie naar opvolging die blijft bewegen.
              </h2>
              <p className="mt-5 leading-7 text-[#b8c3cf]">
                De app toont niet alleen data — ze maakt duidelijk welke actie vandaag nodig is.
              </p>
              <Link href="/product" className="mt-8 inline-flex items-center text-sm font-semibold text-[#f9ae5a] hover:text-[#eca04e]">
                Bekijk alle functies
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { title: "Prioriteit", copy: "Scores en statussen zetten de juiste leads bovenaan je lijst.", icon: Target },
                { title: "Consistentie", copy: "Templates, campagnes en goedkeuringen houden je merk strak.", icon: ShieldCheck },
                { title: "Conversie", copy: "Offertes, bookings en reviews zitten dicht bij de leadcontext.", icon: TrendingUp },
                { title: "Inzicht", copy: "Rapporten tonen waar groei ontstaat en waar opvolging hapert.", icon: BarChart3 },
              ].map(({ title, copy, icon: Icon }) => (
                <div key={title} className="rounded-xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur-sm transition hover:bg-white/[0.1]">
                  <Icon className="h-5 w-5 text-[#f9ae5a]" />
                  <h3 className="mt-4 font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#b8c3cf]">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gradient-to-b from-[#f7f8f6] to-[#eef3ef] py-24">
        <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#f9ae5a]">Klaar om te starten?</p>
          <h2 className="mt-3 text-4xl font-bold leading-tight text-[#0d1520]">
            Bekijk hoe Lead Finder in jouw proces past.
          </h2>
          <p className="mt-5 text-base leading-7 text-[#5a6878]">
            We bekijken je huidige prospectieflow, tonen de app en bepalen welke modules meteen waarde leveren.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/contact" className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-[#f9ae5a] px-8 text-sm font-bold text-[#14100b] shadow-[0_8px_30px_rgba(249,174,90,0.4)] transition hover:bg-[#eca04e] sm:w-auto">
              Plan een demo
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link href="/login" className="inline-flex h-12 w-full items-center justify-center rounded-lg border border-[#cfd8d2] bg-white px-8 text-sm font-semibold text-[#172131] shadow-sm transition hover:border-[#9fb4c8] sm:w-auto">
              Login
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

/* ─── PRODUCT PAGE ─── */

function ProductPage() {
  const modules = [
    {
      icon: Search,
      title: "Lead Discovery",
      color: "#3b82f6",
      summary: "Vind en verrijk prospects op schaal.",
      features: [
        "Zoek op regio, niche of type bedrijf",
        "Automatische contactdata verrijking",
        "Importeer vanuit eigen bestanden",
        "Dedupliciatie en kwaliteitsfilters",
      ],
    },
    {
      icon: Target,
      title: "Lead Scoring",
      color: "#8b5cf6",
      summary: "Meet commerciële kans per lead.",
      features: [
        "Website kwaliteitsanalyse",
        "Local SEO score",
        "Review aanwezigheid & reputatie",
        "Social media aanwezigheid",
      ],
    },
    {
      icon: MailCheck,
      title: "Outreach & Campagnes",
      color: "#f9ae5a",
      summary: "Gestructureerde opvolging zonder chaos.",
      features: [
        "E-mail templates met personalisatie",
        "Drip-sequences en automatisering",
        "Ingebouwde goedkeuringsflows",
        "Campagne KPI tracking",
      ],
    },
    {
      icon: FileText,
      title: "Offertes & Rapporten",
      color: "#10b981",
      summary: "Professioneel presenteren in seconden.",
      features: [
        "PDF-offertes vanuit leadcontext",
        "Branded rapport templates",
        "Klant-specifieke rapportage",
        "E-mail delivery tracking",
      ],
    },
    {
      icon: CalendarCheck,
      title: "Bookings",
      color: "#f43f5e",
      summary: "Afspraken rechtstreeks op je website.",
      features: [
        "Embed widget voor elke site",
        "Google Calendar sync",
        "Automatische bevestigingsmails",
        "Afspraaktypes configureerbaar",
      ],
    },
    {
      icon: Star,
      title: "Reviews & Reputatie",
      color: "#f59e0b",
      summary: "Bouw vertrouwen actief op.",
      features: [
        "Review uitnodigingen sturen",
        "Embed widget voor je site",
        "Score monitoring",
        "Geïntegreerd in leadflow",
      ],
    },
    {
      icon: Bot,
      title: "AI Chatbot",
      color: "#06b6d4",
      summary: "Getrainde assistent voor je website.",
      features: [
        "Bedrijfsspecifieke training",
        "Leadkwalificatie in gesprek",
        "Embed op elke pagina",
        "Gesprekslogs & analytics",
      ],
    },
    {
      icon: BarChart3,
      title: "Cockpit & Dashboards",
      color: "#84cc16",
      summary: "Overzicht op alles wat beweegt.",
      features: [
        "Pipeline waarde & status",
        "Campagne resultaten",
        "Booking & review KPIs",
        "Export naar PDF of CSV",
      ],
    },
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[#dfe5df] bg-gradient-to-br from-[#0d1520] via-[#111c2d] to-[#0d1520] py-24 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_80%_50%,rgba(249,174,90,0.08),transparent)]" />
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3.5 py-1.5 text-xs font-semibold text-[#f9ae5a]">
              <Sparkles className="h-3 w-3" />
              Product overzicht
            </div>
            <h1 className="text-5xl font-bold leading-tight sm:text-6xl">
              Alles wat je nodig hebt om kansen{" "}
              <span className="text-[#f9ae5a]">commercieel op te volgen.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#b8c3cf]">
              Digitify Lead Finder brengt prospectie, communicatie en conversie samen in één werkplek. Je ziet waar elke lead staat, welke actie nodig is en hoe snel je team vooruitgaat.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/contact" className="inline-flex h-12 items-center justify-center rounded-lg bg-[#f9ae5a] px-7 text-sm font-bold text-[#14100b] shadow-[0_8px_30px_rgba(249,174,90,0.3)] transition hover:bg-[#eca04e]">
                Plan een demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link href="/login" className="inline-flex h-12 items-center justify-center rounded-lg border border-white/20 px-7 text-sm font-semibold text-white transition hover:bg-white/10">
                Login
              </Link>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-16 max-w-7xl px-5 sm:px-8">
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { value: "8", label: "Geïntegreerde modules" },
              { value: "100%", label: "Belgiëgericht" },
              { value: "1", label: "Werkplek voor je team" },
              { value: "0", label: "Losse tools nodig" },
            ].map(({ value, label }) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/[0.05] p-5 text-center">
                <div className="text-3xl font-bold text-[#f9ae5a]">{value}</div>
                <div className="mt-1 text-sm text-[#b8c3cf]">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Module deep-dive */}
      <section className="bg-[#f7f8f6] py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#f9ae5a]">Modules</p>
            <h2 className="mt-3 text-4xl font-bold text-[#0d1520]">Acht krachtige modules, één coherente flow.</h2>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {modules.map(({ icon: Icon, title, color, summary, features }) => (
              <article key={title} className="group flex flex-col rounded-xl border border-[#dfe5df] bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-lg">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}18` }}>
                  <Icon className="h-6 w-6" style={{ color }} />
                </div>
                <h3 className="mt-5 font-bold text-[#0d1520]">{title}</h3>
                <p className="mt-1 text-sm text-[#6a7684]">{summary}</p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-[#344052]">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#12a66a]" />
                      {f}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Integration flow */}
      <section className="border-y border-[#dfe5df] bg-white py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-[#f9ae5a]">Geïntegreerde workflow</p>
              <h2 className="mt-3 text-4xl font-bold leading-tight text-[#0d1520]">
                Alle modules werken samen als één systeem.
              </h2>
              <p className="mt-5 leading-7 text-[#5a6878]">
                Een lead die je vindt in de discovery module, gaat naadloos door scoring, outreach, offerte, booking en reviews — zonder context te verliezen.
              </p>
              <div className="mt-8 space-y-4">
                {[
                  { from: "Lead discovery", to: "Lead scoring", copy: "Verrijkte leads krijgen automatisch een score." },
                  { from: "Lead scoring", to: "Outreach", copy: "Top-scored leads gaan meteen in je campagne." },
                  { from: "Outreach", to: "Offerte & booking", copy: "Converteer geïnteresseerde leads in één klik." },
                  { from: "Offerte", to: "Review flow", copy: "Bouw aan je reputatie na elke succesvolle deal." },
                ].map(({ from, to, copy }) => (
                  <div key={from} className="flex items-start gap-4 rounded-lg border border-[#eef3ef] bg-[#f9fbfa] p-4">
                    <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-[#f9ae5a]" />
                    <div>
                      <p className="text-sm font-semibold text-[#0d1520]">
                        {from} → {to}
                      </p>
                      <p className="mt-0.5 text-sm text-[#5a6878]">{copy}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-[#dfe5df] bg-[#0d1520] p-8 text-white">
              <div className="text-xs font-semibold uppercase tracking-widest text-[#8bbdff]">Live workspace</div>
              <div className="mt-4 text-2xl font-bold">Lead Finder Suite</div>
              <div className="mt-6 space-y-3">
                {[
                  { name: "Luma Dental", score: 92, status: "Offerte verzonden", pct: 90 },
                  { name: "Atelier Noord", score: 84, status: "Demo gepland", pct: 70 },
                  { name: "Vesta Solar", score: 78, status: "Review gevraagd", pct: 55 },
                  { name: "Studio Mars", score: 71, status: "In outreach", pct: 40 },
                ].map(({ name, score, status, pct }) => (
                  <div key={name} className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{name}</span>
                      <span className="rounded-md bg-[#12a66a]/20 px-2 py-0.5 text-xs font-bold text-[#12a66a]">{score}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-[#f9ae5a]" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="shrink-0 text-xs text-[#b8c3cf]">{status}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-white/[0.05] p-3 text-center">
                  <div className="text-xl font-bold text-[#f9ae5a]">18</div>
                  <div className="mt-1 text-xs text-[#b8c3cf]">Open offertes</div>
                </div>
                <div className="rounded-lg bg-white/[0.05] p-3 text-center">
                  <div className="text-xl font-bold text-[#f9ae5a]">42</div>
                  <div className="mt-1 text-xs text-[#b8c3cf]">Chatgesprekken</div>
                </div>
                <div className="rounded-lg bg-white/[0.05] p-3 text-center">
                  <div className="text-xl font-bold text-[#f9ae5a]">4.8</div>
                  <div className="mt-1 text-xs text-[#b8c3cf]">Review score</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#f7f8f6] py-20">
        <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
          <h2 className="text-3xl font-bold text-[#0d1520]">Klaar om Lead Finder in actie te zien?</h2>
          <p className="mt-4 text-base text-[#5a6878]">Plan een gepersonaliseerde demo en zie hoe de modules in jouw workflow passen.</p>
          <Link href="/contact" className="mt-8 inline-flex h-12 items-center justify-center rounded-lg bg-[#f9ae5a] px-8 text-sm font-bold text-[#14100b] shadow-[0_8px_30px_rgba(249,174,90,0.4)] transition hover:bg-[#eca04e]">
            Plan demo nu
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}

/* ─── SOLUTIONS PAGE ─── */

function SolutionsPage() {
  const solutions = [
    {
      icon: Building2,
      title: "Voor digitale agencies",
      tagline: "Beheer prospectie en klantopvolging als een machine.",
      color: "#3b82f6",
      intro:
        "Als agency balanceer je meerdere klanten, prospectiedoelen en rapportage tegelijk. Lead Finder geeft je één hub voor leads, campagnes, offertes en reviews — voor elk klantmandaat apart.",
      usecases: [
        { title: "White-label ervaring", copy: "Stel je eigen branding in. Klanten zien jouw naam, jouw kleuren." },
        { title: "Klant-specifieke rapporten", copy: "Genereer rapporten per klant en stuur ze met één klik als PDF." },
        { title: "Campagnegoedkeuring", copy: "E-mails worden pas verstuurd na interne of klant-goedkeuring." },
        { title: "Multi-pipeline overzicht", copy: "Zie alle prospects, statussen en actiepunten op één scherm." },
      ],
      results: ["Minder manueel werk per klant", "Professionelere klantpresentatie", "Kortere time-to-first-outreach"],
    },
    {
      icon: Users2,
      title: "Voor sales teams",
      tagline: "Minder administratie, meer focus op kansen die converteren.",
      color: "#8b5cf6",
      intro:
        "Salesteams verliezen dagelijks tijd aan handmatige opvolging, spreadsheets en losse e-mails. Lead Finder geeft elk teamlid een duidelijk beeld van hun pipeline en wat ze vandaag moeten doen.",
      usecases: [
        { title: "Lead scoring & prioriteit", copy: "Focus op leads met de hoogste commerciële fit — automatisch gesorteerd." },
        { title: "Gedeelde pipeline", copy: "Teamleden zien elkaars leads, statussen en activiteiten." },
        { title: "E-mail opvolging", copy: "Templates en drip-sequenties verkorten de follow-up cyclus." },
        { title: "Quota rapportage", copy: "Track voortgang per teamlid, per campagne of per periode." },
      ],
      results: ["Minder gemiste opvolgkansen", "Kortere salescyclus", "Meer omzet per teamlid"],
    },
    {
      icon: Globe2,
      title: "Voor lokale dienstverleners",
      tagline: "Combineer aanvragen, afspraken, reviews en offertes in één flow.",
      color: "#10b981",
      intro:
        "Lokale bedrijven — van kinesisten tot bouwbedrijven — hebben één platform nodig dat prospectie, bookings en reputatiegroei samenbrengt zonder dure marketingsoftware.",
      usecases: [
        { title: "Booking widget", copy: "Zet een afsprakenplanner op je website. Klanten boeken rechtstreeks." },
        { title: "Offerte aanvragen", copy: "Ontvang offerteaanvragen via embed en beantwoord ze in de app." },
        { title: "Review groei", copy: "Stuur automatisch review-uitnodigingen na elke afgeronde opdracht." },
        { title: "Chatbot op je site", copy: "Getrainde AI beantwoordt vragen en kwalificeert bezoekers 24/7." },
      ],
      results: ["Meer bookings via je website", "Hogere Google-score", "Minder telefonisch contactbeheer"],
    },
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[#dfe5df] bg-gradient-to-b from-[#f0f7ff] to-[#eef3ef] py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#3b82f6]/20 bg-[#3b82f6]/10 px-3.5 py-1.5 text-xs font-semibold text-[#1d4ed8]">
              <Lightbulb className="h-3 w-3" />
              Oplossingen op maat
            </div>
            <h1 className="text-5xl font-bold leading-tight text-[#0d1520] sm:text-6xl">
              Groei-workflows voor teams die geen tijd willen verliezen.
            </h1>
            <p className="mt-6 text-lg leading-8 text-[#4d5b6b]">
              Van agencies tot lokale dienstverleners: Lead Finder vormt zich rond concrete workflows zoals leadkwalificatie, campagne-opvolging, bookings en reviewgroei.
            </p>
          </div>
        </div>
      </section>

      {/* Solution cards */}
      <section className="bg-[#f7f8f6] py-24">
        <div className="mx-auto max-w-7xl space-y-10 px-5 sm:px-8">
          {solutions.map(({ icon: Icon, title, tagline, color, intro, usecases, results }, idx) => (
            <article key={title} className={`overflow-hidden rounded-2xl border border-[#dfe5df] bg-white shadow-sm`}>
              <div className={`flex items-center gap-4 border-b border-[#dfe5df] p-6 sm:p-8`} style={{ backgroundColor: `${color}0c` }}>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}20` }}>
                  <Icon className="h-6 w-6" style={{ color }} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color }}>Oplossing {idx + 1}</p>
                  <h2 className="text-2xl font-bold text-[#0d1520]">{title}</h2>
                  <p className="mt-1 text-sm text-[#5a6878]">{tagline}</p>
                </div>
              </div>
              <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_1.4fr]">
                <div>
                  <p className="leading-7 text-[#4d5b6b]">{intro}</p>
                  <div className="mt-6">
                    <p className="text-sm font-semibold text-[#0d1520]">Resultaten die je kunt verwachten:</p>
                    <ul className="mt-3 space-y-2">
                      {results.map((r) => (
                        <li key={r} className="flex items-center gap-2 text-sm text-[#344052]">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#12a66a]" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Link href="/contact" className="mt-6 inline-flex items-center text-sm font-semibold" style={{ color }}>
                    Plan een demo voor {title.replace("Voor ", "")}
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {usecases.map(({ title: t, copy }) => (
                    <div key={t} className="rounded-lg border border-[#dfe5df] bg-[#f9fbfa] p-4">
                      <p className="font-semibold text-[#0d1520]">{t}</p>
                      <p className="mt-1.5 text-sm leading-6 text-[#5a6878]">{copy}</p>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section className="border-t border-[#dfe5df] bg-white py-24">
        <div className="mx-auto max-w-4xl px-5 sm:px-8">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#f9ae5a]">Lead Finder vs. losse tools</p>
            <h2 className="mt-3 text-3xl font-bold text-[#0d1520]">Waarom alles in één platform?</h2>
          </div>
          <div className="mt-10 overflow-hidden rounded-xl border border-[#dfe5df]">
            <div className="grid grid-cols-3 border-b border-[#dfe5df] bg-[#f9fbfa] px-6 py-3 text-sm font-semibold text-[#344052]">
              <div>Functie</div>
              <div className="text-center text-[#f9ae5a]">Lead Finder</div>
              <div className="text-center text-[#9aafbe]">Losse tools</div>
            </div>
            {[
              ["Lead discovery + scoring", true, false],
              ["Outreach + campagnes", true, "Deels"],
              ["Offertes + rapporten", true, false],
              ["Booking widgets", true, false],
              ["Review management", true, false],
              ["AI chatbot", true, false],
              ["Geïntegreerde pipeline", true, false],
              ["Belgisch support team", true, false],
            ].map(([feature, ours, theirs]) => (
              <div key={String(feature)} className="grid grid-cols-3 border-b border-[#dfe5df] px-6 py-4 text-sm last:border-0">
                <div className="text-[#344052]">{feature}</div>
                <div className="text-center">
                  {ours === true ? (
                    <CheckCircle2 className="mx-auto h-5 w-5 text-[#12a66a]" />
                  ) : (
                    <span className="text-[#9aafbe]">{ours}</span>
                  )}
                </div>
                <div className="text-center">
                  {theirs === false ? (
                    <span className="text-[#e5e7eb] text-lg">✕</span>
                  ) : (
                    <span className="text-[#9aafbe]">{theirs}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#0d1520] py-20 text-white">
        <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
          <h2 className="text-3xl font-bold">Welke oplossing past bij jouw team?</h2>
          <p className="mt-4 text-[#b8c3cf]">Vraag een demo aan en we configureren Lead Finder specifiek voor jouw use case.</p>
          <Link href="/contact" className="mt-8 inline-flex h-12 items-center justify-center rounded-lg bg-[#f9ae5a] px-8 text-sm font-bold text-[#14100b] shadow-[0_8px_30px_rgba(249,174,90,0.3)] transition hover:bg-[#eca04e]">
            Plan een demo
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}

/* ─── ABOUT PAGE ─── */

function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[#dfe5df] bg-gradient-to-b from-[#f0fff4] to-[#eef3ef] py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#12a66a]/20 bg-[#12a66a]/10 px-3.5 py-1.5 text-xs font-semibold text-[#0b8354]">
                <Heart className="h-3 w-3" />
                Gemaakt door Digitify · België
              </div>
              <h1 className="text-5xl font-bold leading-tight text-[#0d1520] sm:text-6xl">
                Gebouwd door een digitaal team dat groei{" "}
                <span className="text-[#12a66a]">praktisch maakt.</span>
              </h1>
              <p className="mt-7 text-lg leading-8 text-[#4d5b6b]">
                Digitify bouwt websites, funnels en digitale systemen voor ondernemers die meetbare groei willen. Lead Finder is ons antwoord op de vraag: "Hoe haal je meer uit je leads, zonder meer tools?"
              </p>
            </div>
            <div className="grid gap-4">
              {[
                { icon: Award, title: "Belgisch team", copy: "Opgericht en beheerd vanuit België, met lokale kennis van de markt." },
                { icon: Lightbulb, title: "Praktisch eerst", copy: "Elke feature begint met een echte vraag van een echte klant." },
                { icon: TrendingUp, title: "Meetbaar resultaat", copy: "We bouwen voor teams die groei willen aantonen, niet alleen nastreven." },
              ].map(({ icon: Icon, title, copy }) => (
                <div key={title} className="flex gap-4 rounded-xl border border-[#dfe5df] bg-white p-5 shadow-sm">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#12a66a]/10">
                    <Icon className="h-5 w-5 text-[#12a66a]" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#0d1520]">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-[#5a6878]">{copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-16 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-[#f9ae5a]">Ons verhaal</p>
              <h2 className="mt-3 text-4xl font-bold leading-tight text-[#0d1520]">
                Waarom we Lead Finder gebouwd hebben.
              </h2>
              <div className="mt-8 space-y-6 text-base leading-8 text-[#4d5b6b]">
                <p>
                  Digitify werkt dagelijks met bedrijven die online willen groeien. We bouwden websites, automatiseerden funnels en hielpen teams met digitale strategie. Maar we zagen steeds dezelfde bottleneck: leads vinden was makkelijk, maar opvolgen was een chaos van spreadsheets, losse mails en geen duidelijke context.
                </p>
                <p>
                  Lead Finder is ontstaan uit die frustratie. We wilden één tool die het volledige commerciële pad dekt — van eerste contact tot klant — zonder dat je 5 verschillende abonnementen nodig hebt.
                </p>
                <p>
                  Vandaag is Lead Finder een volledig uitgewerkt platform dat agencies, salesteams en lokale dienstverleners helpt om professioneler en sneller te groeien.
                </p>
              </div>
              <Link href="https://www.digitify.be" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#f9ae5a] hover:text-[#eca04e]" target="_blank" rel="noopener noreferrer">
                Bezoek www.digitify.be
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="space-y-6">
              <p className="text-sm font-semibold uppercase tracking-widest text-[#f9ae5a]">Onze waarden</p>
              {[
                {
                  icon: Target,
                  title: "Resultaat boven features",
                  copy: "We bouwen geen functies omwille van de functie. Elke toevoeging moet een concrete verbetering brengen voor de eindgebruiker.",
                },
                {
                  icon: ShieldCheck,
                  title: "Eerlijk en transparant",
                  copy: "Geen verborgen kosten, geen complexe contracten. Wat je ziet, is wat je krijgt.",
                },
                {
                  icon: Heart,
                  title: "Gebouwd met zorg",
                  copy: "Elk scherm, elke tekst en elke workflow is doordacht. Wij haten slechte UX net zo erg als onze klanten.",
                },
                {
                  icon: TrendingUp,
                  title: "Groei is meetbaar",
                  copy: "Als je Lead Finder gebruikt, moet je resultaten kunnen aantonen. Dashboards, rapporten en exports zitten er altijd in.",
                },
              ].map(({ icon: Icon, title, copy }) => (
                <div key={title} className="flex gap-4 rounded-xl border border-[#dfe5df] bg-[#f9fbfa] p-5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f9ae5a]/15">
                    <Icon className="h-4 w-4 text-[#f9ae5a]" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#0d1520]">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-[#5a6878]">{copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Digitify ecosystem */}
      <section className="bg-[#0d1520] py-20 text-white">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-[#8bbdff]">Digitify ecosystem</p>
              <h2 className="mt-3 text-4xl font-bold leading-tight">
                Lead Finder is deel van iets groters.
              </h2>
              <p className="mt-5 leading-7 text-[#b8c3cf]">
                Naast Lead Finder bouwt Digitify op maat: websites, funnels, e-commerce, automatiseringen en digitale strategie. We zijn een één-team-stop voor bedrijven die serieus digitaal willen groeien.
              </p>
              <Link href="https://www.digitify.be" target="_blank" rel="noopener noreferrer" className="mt-8 inline-flex h-11 items-center gap-2 rounded-lg border border-white/20 px-5 text-sm font-semibold text-white transition hover:bg-white/10">
                Bezoek digitify.be
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Websites", sub: "Op maat gebouwd" },
                { label: "Funnels", sub: "Conversiegericht" },
                { label: "Automatisering", sub: "Tijdbesparend" },
                { label: "Lead Finder", sub: "Dit platform" },
              ].map(({ label, sub }) => (
                <div key={label} className="rounded-xl border border-white/10 bg-white/[0.06] p-5">
                  <div className="font-bold text-white">{label}</div>
                  <div className="mt-1 text-xs text-[#b8c3cf]">{sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#f7f8f6] py-20">
        <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
          <h2 className="text-3xl font-bold text-[#0d1520]">Wil je samenwerken met Digitify?</h2>
          <p className="mt-4 text-[#5a6878]">Plan een gesprek over Lead Finder of over een breder digitaal groeiraject.</p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/contact" className="inline-flex h-12 items-center justify-center rounded-lg bg-[#f9ae5a] px-8 text-sm font-bold text-[#14100b] shadow-[0_8px_30px_rgba(249,174,90,0.4)] transition hover:bg-[#eca04e]">
              Neem contact op
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link href="https://www.digitify.be" target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center justify-center rounded-lg border border-[#cfd8d2] bg-white px-8 text-sm font-semibold text-[#172131] shadow-sm transition hover:border-[#9fb4c8]">
              www.digitify.be
              <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

/* ─── CONTACT PAGE ─── */

function ContactPage() {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    await new Promise((r) => setTimeout(r, 800));
    setSending(false);
    setSent(true);
  }

  return (
    <>
      {/* Hero */}
      <section className="border-b border-[#dfe5df] bg-gradient-to-b from-[#faf5ff] to-[#eef3ef] py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#8b5cf6]/20 bg-[#8b5cf6]/10 px-3.5 py-1.5 text-xs font-semibold text-[#6d28d9]">
              <MessageSquareText className="h-3 w-3" />
              Demo aanvragen
            </div>
            <h1 className="text-5xl font-bold leading-tight text-[#0d1520]">
              Bekijk hoe Lead Finder in jouw proces past.
            </h1>
            <p className="mt-6 text-lg leading-8 text-[#4d5b6b]">
              Plan een demo, bespreek je huidige leadflow en ontdek welke modules meteen waarde kunnen leveren voor je team.
            </p>
          </div>
        </div>
      </section>

      {/* Contact grid */}
      <section className="bg-[#f7f8f6] py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">

            {/* Form */}
            <div className="rounded-2xl border border-[#dfe5df] bg-white p-8 shadow-sm">
              {sent ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#12a66a]/15">
                    <CheckCircle2 className="h-8 w-8 text-[#12a66a]" />
                  </div>
                  <h2 className="mt-6 text-2xl font-bold text-[#0d1520]">Bericht verzonden!</h2>
                  <p className="mt-3 text-[#5a6878]">We nemen zo snel mogelijk contact met je op — meestal binnen 1 werkdag.</p>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-[#0d1520]">Stuur ons een bericht</h2>
                  <p className="mt-2 text-sm text-[#5a6878]">We reageren doorgaans binnen 1 werkdag.</p>
                  <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-[#344052]">Naam *</label>
                        <input
                          type="text"
                          required
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          className="w-full rounded-lg border border-[#cfd8d2] bg-[#f9fbfa] px-3.5 py-2.5 text-sm outline-none transition focus:border-[#f9ae5a] focus:ring-2 focus:ring-[#f9ae5a]/20"
                          placeholder="Jouw naam"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-[#344052]">E-mail *</label>
                        <input
                          type="email"
                          required
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          className="w-full rounded-lg border border-[#cfd8d2] bg-[#f9fbfa] px-3.5 py-2.5 text-sm outline-none transition focus:border-[#f9ae5a] focus:ring-2 focus:ring-[#f9ae5a]/20"
                          placeholder="jij@bedrijf.be"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-[#344052]">Bedrijf</label>
                      <input
                        type="text"
                        value={form.company}
                        onChange={(e) => setForm({ ...form, company: e.target.value })}
                        className="w-full rounded-lg border border-[#cfd8d2] bg-[#f9fbfa] px-3.5 py-2.5 text-sm outline-none transition focus:border-[#f9ae5a] focus:ring-2 focus:ring-[#f9ae5a]/20"
                        placeholder="Bedrijfsnaam"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-[#344052]">Bericht *</label>
                      <textarea
                        required
                        rows={5}
                        value={form.message}
                        onChange={(e) => setForm({ ...form, message: e.target.value })}
                        className="w-full resize-none rounded-lg border border-[#cfd8d2] bg-[#f9fbfa] px-3.5 py-2.5 text-sm outline-none transition focus:border-[#f9ae5a] focus:ring-2 focus:ring-[#f9ae5a]/20"
                        placeholder="Vertel ons over je huidige leadflow en wat je wil verbeteren..."
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={sending}
                      className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#f9ae5a] text-sm font-bold text-[#14100b] shadow-[0_4px_14px_rgba(249,174,90,0.4)] transition hover:bg-[#eca04e] disabled:opacity-60"
                    >
                      {sending ? "Verzenden..." : "Stuur bericht"}
                      {!sending && <ArrowRight className="ml-2 h-4 w-4" />}
                    </button>
                  </form>
                </>
              )}
            </div>

            {/* Info sidebar */}
            <div className="space-y-5">
              {/* Demo info */}
              <div className="rounded-2xl border border-[#f9ae5a]/30 bg-[#fffbf5] p-6">
                <p className="text-sm font-semibold uppercase tracking-widest text-[#c47c1a]">Wat je krijgt in de demo</p>
                <ul className="mt-4 space-y-4">
                  {[
                    { icon: Users2, copy: "Een korte analyse van je huidige prospectieproces." },
                    { icon: MessageSquareText, copy: "Een walkthrough van leads, campagnes, offertes, bookings en reviews." },
                    { icon: Bot, copy: "Advies over de modules die je best eerst activeert." },
                    { icon: TrendingUp, copy: "Een schatting van de tijdsbesparing voor jouw team." },
                  ].map(({ icon: Icon, copy }) => (
                    <li key={copy} className="flex gap-3 text-sm text-[#4d5b6b]">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#12a66a]" />
                      {copy}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Contact details */}
              <div className="rounded-2xl border border-[#dfe5df] bg-white p-6">
                <p className="text-sm font-semibold text-[#0d1520]">Directe contactgegevens</p>
                <div className="mt-4 space-y-3">
                  {[
                    { icon: Mail, label: "hello@digitify.be", href: "mailto:hello@digitify.be" },
                    { icon: Phone, label: "+32 (0) 486 51 57 73", href: "tel:+3248651573" },
                    { icon: MapPin, label: "België", href: undefined },
                    { icon: Globe2, label: "www.digitify.be", href: "https://www.digitify.be" },
                  ].map(({ icon: Icon, label, href }) => (
                    <div key={label} className="flex items-center gap-3 text-sm text-[#4d5b6b]">
                      <Icon className="h-4 w-4 shrink-0 text-[#f9ae5a]" />
                      {href ? (
                        <a href={href} className="hover:text-[#f9ae5a]" target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">{label}</a>
                      ) : (
                        <span>{label}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* FAQ */}
              <div className="rounded-2xl border border-[#dfe5df] bg-[#f9fbfa] p-6">
                <p className="text-sm font-semibold text-[#0d1520]">Veelgestelde vragen</p>
                <div className="mt-4 space-y-4">
                  {[
                    { q: "Hoe lang duurt een demo?", a: "Doorgaans 30–45 minuten, online of telefonisch." },
                    { q: "Is Lead Finder voor grote bedrijven?", a: "Nee, het is perfect voor KMO's, agencies en freelancers." },
                    { q: "Kan ik proberen voor ik koop?", a: "Ja, we bespreken dat in de demo." },
                  ].map(({ q, a }) => (
                    <div key={q}>
                      <p className="text-sm font-semibold text-[#0d1520]">{q}</p>
                      <p className="mt-1 text-sm text-[#5a6878]">{a}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/* ─── HOME MOCKUP ─── */

function HomeMockup() {
  return (
    <div className="relative">
      <div className="rounded-2xl border border-[#cfd8d2] bg-[#101821] p-2 shadow-[0_32px_80px_rgba(13,21,32,0.2)]">
        <div className="rounded-xl border border-white/10 bg-[#f9fbfa] p-4">
          <div className="flex items-center justify-between border-b border-[#e2e8e3] pb-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-[#f9ae5a]">Pipeline vandaag</div>
              <div className="mt-0.5 font-bold text-[#0d1520]">Lead Finder Suite</div>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-[#dfe5df] bg-white px-3 py-1.5 text-xs font-semibold text-[#344052]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#12a66a]" />
              Live workspace
            </div>
          </div>
          <div className="mt-4 space-y-2.5">
            {[
              { name: "Luma Dental", score: 92, status: "Offerte klaar", pct: 90 },
              { name: "Atelier Noord", score: 84, status: "Demo gepland", pct: 70 },
              { name: "Vesta Solar", score: 78, status: "Review flow", pct: 55 },
            ].map(({ name, score, status, pct }) => (
              <div key={name} className="rounded-lg border border-[#dfe5df] bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#172131]">{name}</span>
                  <span className="rounded-md bg-[#eaf6f0] px-2 py-0.5 text-xs font-bold text-[#0b8354]">{score}</span>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e6ebe7]">
                    <div className="h-full rounded-full bg-[#f9ae5a]" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="shrink-0 text-xs text-[#6a7684]">{status}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {[
              { icon: Bot, label: "Chatbot", value: "42 gesprekken" },
              { icon: Quote, label: "Quotes", value: "7 klaar" },
              { icon: Star, label: "Reviews", value: "4.8 ⭐" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-lg border border-[#dfe5df] bg-white p-3 shadow-sm">
                <Icon className="h-4 w-4 text-[#f9ae5a]" />
                <div className="mt-2 text-xs font-semibold text-[#0d1520]">{label}</div>
                <div className="mt-0.5 text-xs text-[#6a7684]">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── FOOTER ─── */

function MarketingFooter() {
  return (
    <footer className="border-t border-[#2a2118] bg-[#0d1117] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr]">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f9ae5a] text-[#14100b]">
              <Zap className="h-5 w-5" />
            </span>
            <div>
              <div className="font-bold">Digitify Lead Finder</div>
              <div className="text-xs text-[#9d948b]">Partner in Digital Solutions</div>
            </div>
          </div>
          <p className="mt-6 max-w-xs text-sm leading-7 text-[#b8b0a6]">
            Premium lead discovery en opvolging, gemaakt door Digitify voor bedrijven die digitale groei praktisch willen organiseren.
          </p>
          <div className="mt-5 space-y-2 text-sm text-[#9d948b]">
            <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> hello@digitify.be</div>
            <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> +32 (0) 486 51 57 73</div>
            <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> België</div>
          </div>
        </div>
        <div>
          <div className="mb-4 text-xs font-bold uppercase tracking-widest text-[#f9ae5a]">Website</div>
          <div className="space-y-3 text-sm text-[#b8b0a6]">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="block hover:text-[#f9ae5a]">{item.label}</Link>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-4 text-xs font-bold uppercase tracking-widest text-[#f9ae5a]">Actie</div>
          <div className="space-y-3 text-sm text-[#b8b0a6]">
            <Link href="/login" className="block hover:text-[#f9ae5a]">Login</Link>
            <Link href="/register" className="block hover:text-[#f9ae5a]">Toegang aanvragen</Link>
            <Link href="https://www.digitify.be" className="block hover:text-[#f9ae5a]">www.digitify.be</Link>
          </div>
        </div>
        <div>
          <div className="mb-4 text-xs font-bold uppercase tracking-widest text-[#f9ae5a]">Juridisch</div>
          <div className="space-y-3 text-sm text-[#9d948b]">
            <div>BTW BE0685.556.507</div>
            <div>© {new Date().getFullYear()} Digitify</div>
          </div>
        </div>
      </div>
      <div className="border-t border-white/[0.06] px-5 py-4 text-center text-xs text-[#6b6560]">
        © {new Date().getFullYear()} Digitify. Webdesign, media en marketing voor digitale groei. · Alle rechten voorbehouden.
      </div>
    </footer>
  );
}
