"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState, useCallback } from "react";
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
  Menu,
  X,
} from "lucide-react";

type PageKey = "home" | "product" | "solutions" | "about" | "contact";

/* ─── SCROLL REVEAL HOOK ─── */
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal, .reveal-left, .reveal-right, .reveal-scale");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, i) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const delay = el.dataset.delay ?? "0";
            setTimeout(() => el.classList.add("in-view"), Number(delay));
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

/* ─── ANIMATED COUNTER ─── */
function AnimatedNumber({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      let start = 0;
      const step = () => {
        start += Math.ceil(target / 40);
        if (start >= target) { setVal(target); return; }
        setVal(start);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { threshold: 0.5 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);
  return <span ref={ref}>{val}{suffix}</span>;
}

/* ─── MAIN COMPONENT ─── */
export function MarketingPage({ page }: { page: PageKey }) {
  useReveal();
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7f8f6] text-[#0d1520]">
      <MarketingHeader activePage={page} />
      {page === "home"      && <HomePage />}
      {page === "product"   && <ProductPage />}
      {page === "solutions" && <SolutionsPage />}
      {page === "about"     && <AboutPage />}
      {page === "contact"   && <ContactPage />}
      <MarketingFooter />
    </main>
  );
}

/* ─── NAV ─── */
const navItems = [
  { label: "Product",     href: "/product" },
  { label: "Oplossingen", href: "/oplossingen" },
  { label: "Over ons",    href: "/over-ons" },
  { label: "Contact",     href: "/contact" },
];

function MarketingHeader({ activePage }: { activePage: PageKey }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const pageMap: Record<PageKey, string> = {
    home: "/", product: "/product", solutions: "/oplossingen",
    about: "/over-ons", contact: "/contact",
  };

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? "border-b border-[#dfe5df]/60 bg-white/90 shadow-[0_1px_24px_rgba(13,21,32,0.06)] backdrop-blur-xl" : "bg-transparent"}`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 animate-fade-in" aria-label="Digitify Lead Finder">
          <span className="relative flex h-9 w-9 items-center justify-center">
            <Image src="/favicon.ico" alt="Digitify" width={36} height={36} className="rounded-lg" priority />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-extrabold tracking-tight text-[#0d1520]">Digitify</span>
            <span className="block text-[11px] font-medium text-[#f9ae5a]">Lead Finder</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const isActive = pageMap[activePage] === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative rounded-lg px-3.5 py-2 text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? "text-[#f9ae5a]"
                    : "text-[#344052] hover:text-[#0d1520]"
                }`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute bottom-0.5 left-3.5 right-3.5 h-0.5 rounded-full bg-[#f9ae5a]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* CTA */}
        <div className="flex items-center gap-2">
          <Link href="/login" className="hidden h-9 items-center rounded-lg border border-[#dde3e8] bg-white px-4 text-sm font-semibold text-[#344052] shadow-sm transition hover:border-[#f9ae5a]/40 hover:text-[#f9ae5a] sm:inline-flex">
            Login
          </Link>
          <Link href="/contact" className="inline-flex h-9 items-center rounded-lg bg-[#f9ae5a] px-4 text-sm font-bold text-[#14100b] shadow-[0_4px_16px_rgba(249,174,90,0.5)] transition hover:bg-[#eca04e] hover:shadow-[0_6px_20px_rgba(249,174,90,0.6)]">
            Plan demo
          </Link>
          <button className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg border border-[#dde3e8] md:hidden" onClick={() => setOpen(!open)}>
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-[#dfe5df] bg-white px-5 pb-5 md:hidden animate-fade-in">
          <nav className="mt-4 space-y-1">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-[#344052] hover:bg-[#f9ae5a]/10 hover:text-[#f9ae5a]">
                {item.label}
              </Link>
            ))}
            <Link href="/login" onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-[#344052] hover:bg-[#f9ae5a]/10">
              Login
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

/* ══════════════════════════════════════════════
   HOME PAGE
══════════════════════════════════════════════ */
function HomePage() {
  return (
    <>
      {/* ── HERO ── */}
      <section className="relative min-h-[92vh] overflow-hidden border-b border-[#dfe5df]">
        {/* Animated gradient background */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#fffdf9] via-[#f7f8f6] to-[#eef3ef]" />
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-32 h-[600px] w-[600px] rounded-full bg-[#f9ae5a]/10 blur-[100px]" />
          <div className="absolute -right-20 top-20 h-[400px] w-[400px] rounded-full bg-[#12a66a]/8 blur-[80px]" />
          <div className="absolute bottom-0 left-1/2 h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-[#f9ae5a]/6 blur-[80px]" />
        </div>

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:py-28">
          {/* Text */}
          <div>
            <div className="animate-fade-in mb-7 inline-flex items-center gap-2 rounded-full border border-[#f9ae5a]/30 bg-gradient-to-r from-[#f9ae5a]/15 to-[#f9ae5a]/5 px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#c47c1a] shadow-sm">
              <Image src="/favicon.ico" alt="" width={16} height={16} className="rounded-sm" />
              Digitify Lead Finder · Made in Belgium
            </div>

            <h1 className="animate-fade-in delay-100 text-5xl font-extrabold leading-[1.01] tracking-tight text-[#0d1520] sm:text-6xl lg:text-[5rem]">
              Van lead naar klant,{" "}
              <br className="hidden sm:block" />
              <span className="gradient-text">zonder ruis.</span>
            </h1>

            <p className="animate-fade-in delay-200 mt-7 max-w-lg text-[1.1rem] leading-8 text-[#4d5b6b]">
              Vind betere leads, scoreer commerciële fit en zet elke kans om naar outreach, offerte, booking of review — vanuit één werkplek.
            </p>

            <div className="animate-fade-in delay-300 mt-9 flex flex-wrap gap-3">
              <Link href="/contact"
                className="group inline-flex h-13 items-center justify-center rounded-xl bg-[#f9ae5a] px-8 text-sm font-bold text-[#14100b] shadow-[0_8px_32px_rgba(249,174,90,0.5)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#eca04e] hover:shadow-[0_12px_40px_rgba(249,174,90,0.65)]">
                Plan een gratis demo
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link href="/product"
                className="group inline-flex h-13 items-center justify-center rounded-xl border border-[#cfd8d2] bg-white px-8 text-sm font-semibold text-[#172131] shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#f9ae5a]/40 hover:shadow-md">
                Ontdek het product
                <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            <div className="animate-fade-in delay-400 mt-10 flex flex-wrap gap-4">
              {[
                { icon: CheckCircle2, text: "Lead scoring & discovery" },
                { icon: CheckCircle2, text: "Outreach & campagnes" },
                { icon: CheckCircle2, text: "Offertes & bookings" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 text-sm font-medium text-[#5a6878]">
                  <Icon className="h-4 w-4 text-[#12a66a]" />
                  {text}
                </div>
              ))}
            </div>
          </div>

          {/* Mockup */}
          <div className="animate-slide-right delay-300 hidden lg:block">
            <div className="animate-pulse-glow rounded-2xl">
              <HomeDashboard />
            </div>
          </div>
        </div>

        {/* Scrolling badge row */}
        <div className="relative border-t border-[#dfe5df]/60 bg-white/50 py-4 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-6 px-5 sm:justify-between sm:px-8">
            {["Lead discovery", "Lead scoring", "Outreach", "Offertes", "Bookings", "Reviews", "AI Chatbot", "Rapportage"].map((t) => (
              <div key={t} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#5a6878]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#f9ae5a]" />
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              { n: 8,   suffix: "+", label: "Geïntegreerde modules" },
              { n: 100, suffix: "%", label: "Belgisch product" },
              { n: 6,   suffix: "+", label: "Groeiflows" },
              { n: 0,   suffix: " losse tools", label: "Nodig naast de app" },
            ].map(({ n, suffix, label }) => (
              <div key={label} className="reveal text-center" data-delay="0">
                <div className="text-4xl font-extrabold text-[#0d1520]">
                  <AnimatedNumber target={n} suffix={suffix} />
                </div>
                <div className="mt-2 text-sm text-[#6a7684]">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="bg-[#f7f8f6] py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="reveal mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-[#f9ae5a]">Alles in één app</p>
            <h2 className="mt-3 text-4xl font-extrabold leading-tight text-[#0d1520] sm:text-5xl">
              Een <span className="gradient-text">command center</span> voor commerciële groei.
            </h2>
            <p className="mt-5 text-lg leading-8 text-[#5a6878]">
              Lead Finder vervangt losse tools, spreadsheets en copy-paste workflows door één heldere operationele hub.
            </p>
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Search,       title: "Lead discovery",      copy: "Vind relevante bedrijven per regio of niche.", color: "#3b82f6" },
              { icon: Target,       title: "Lead scoring",        copy: "Meet website, SEO, reviews en social presence.", color: "#8b5cf6" },
              { icon: MailCheck,    title: "Outreach & campagnes",copy: "Templates, sequences en goedkeuringsflows.",     color: "#f9ae5a" },
              { icon: FileText,     title: "Offertes & rapporten",copy: "Professioneel presenteren vanuit leadcontext.",  color: "#10b981" },
              { icon: CalendarCheck,title: "Bookings",            copy: "Embed widget voor afspraken op je website.",    color: "#f43f5e" },
              { icon: Star,         title: "Review groei",        copy: "Verzamel reviews, toon widgets, volg score op.",color: "#f59e0b" },
              { icon: Bot,          title: "AI chatbot",          copy: "Getrainde assistent die leads kwalificeert.",   color: "#06b6d4" },
              { icon: Layers3,      title: "Cockpit & dashboards",copy: "Pipeline, KPI's en groeikansen in één oogopslag.",color: "#84cc16" },
            ].map(({ icon: Icon, title, copy, color }, i) => (
              <article
                key={title}
                className="reveal group relative overflow-hidden rounded-2xl border border-[#e2e8e3] bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-transparent hover:shadow-[0_20px_60px_rgba(13,21,32,0.1)]"
                data-delay={String(i * 60)}
              >
                <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{ background: `radial-gradient(circle at top left, ${color}10, transparent 60%)` }} />
                <div className="relative">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
                    style={{ backgroundColor: `${color}18` }}>
                    <Icon className="h-5 w-5" style={{ color }} />
                  </div>
                  <h3 className="mt-5 font-bold text-[#0d1520]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#5a6878]">{copy}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#fffbf5] to-[#fef3de] py-28">
        <div className="pointer-events-none absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-[#f9ae5a]/8 blur-[100px]" />
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
            <div className="reveal-left">
              <p className="text-sm font-bold uppercase tracking-widest text-[#b66d1e]">Hoe het werkt</p>
              <h2 className="mt-3 text-4xl font-extrabold leading-tight text-[#0d1520] sm:text-5xl">
                Van zoekopdracht naar opvolging <span className="gradient-text">in minuten.</span>
              </h2>
              <p className="mt-5 text-lg leading-8 text-[#5a6878]">
                Geen complexe onboarding. Zoek een niche, laat de app kansen scoren en stuur de beste leads direct naar je pipeline.
              </p>
              <div className="mt-10 space-y-4">
                {[
                  { n: "1", title: "Zoek & verrijk",           copy: "Kies regio, sector of type bedrijf. De app verzamelt prospects automatisch." },
                  { n: "2", title: "Scoreer commerciële fit",  copy: "Elke lead krijgt een score op website, SEO, reviews en social." },
                  { n: "3", title: "Actie & conversie",        copy: "Start outreach, maak een offerte of plan een demo vanuit dezelfde kaart." },
                  { n: "4", title: "Meet je resultaten",       copy: "Dashboard met pipeline, campagnes, bookings en groeikansen." },
                ].map(({ n, title, copy }, i) => (
                  <div key={title} className="reveal flex gap-4" data-delay={String(i * 80)}>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f9ae5a] font-extrabold text-[#14100b] shadow-[0_4px_12px_rgba(249,174,90,0.4)]">
                      {n}
                    </span>
                    <div>
                      <p className="font-bold text-[#0d1520]">{title}</p>
                      <p className="mt-1 text-sm leading-6 text-[#5a6878]">{copy}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-10">
                <Link href="/contact"
                  className="group inline-flex h-12 items-center rounded-xl bg-[#0d1520] px-7 text-sm font-bold text-white transition-all duration-300 hover:bg-[#1a2535] hover:shadow-lg">
                  Start met een demo
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>

            <div className="reveal-right grid grid-cols-2 gap-4">
              {[
                { icon: TrendingUp, label: "Pipeline waarde",   value: "€ 84.200", sub: "Dit kwartaal",     color: "#f9ae5a" },
                { icon: CheckCircle2,label: "Leads opgevolgd",  value: "147",       sub: "Actief in pipeline",color: "#12a66a" },
                { icon: Clock,       label: "Tijdsbesparing",   value: "~8u",       sub: "Per week vs losse tools",color: "#3b82f6" },
                { icon: Award,       label: "Gem. lead score",  value: "76/100",    sub: "Commerciële fit",  color: "#8b5cf6" },
              ].map(({ icon: Icon, label, value, sub, color }) => (
                <div key={label} className="group relative overflow-hidden rounded-2xl border border-[#edd5bb] bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(13,21,32,0.08)]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}18` }}>
                    <Icon className="h-5 w-5" style={{ color }} />
                  </div>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-[#9aafbe]">{label}</p>
                  <p className="mt-1 text-2xl font-extrabold text-[#0d1520]">{value}</p>
                  <p className="mt-0.5 text-xs text-[#b8c3cf]">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── DARK WHY ── */}
      <section className="relative overflow-hidden bg-[#0d1520] py-28 text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-40 top-1/2 h-[600px] w-[600px] -translate-y-1/2 rounded-full bg-[#f9ae5a]/5 blur-[120px]" />
          <div className="absolute -right-40 top-0 h-[400px] w-[400px] rounded-full bg-[#12a66a]/5 blur-[100px]" />
        </div>
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <div className="reveal mx-auto mb-14 max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-[#f9ae5a]">Waarom het werkt</p>
            <h2 className="mt-3 text-4xl font-extrabold leading-tight sm:text-5xl">
              Van commerciële intentie naar opvolging die blijft bewegen.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Target,     title: "Prioriteit",   copy: "Scores en statussen zetten de juiste leads bovenaan.",        color: "#f9ae5a" },
              { icon: ShieldCheck,title: "Consistentie", copy: "Templates en goedkeuringen houden je merk strak.",           color: "#12a66a" },
              { icon: TrendingUp, title: "Conversie",    copy: "Offertes en bookings zitten dicht bij de leadcontext.",      color: "#3b82f6" },
              { icon: BarChart3,  title: "Inzicht",      copy: "Rapporten tonen waar groei ontstaat en waar het hapert.",   color: "#8b5cf6" },
            ].map(({ icon: Icon, title, copy, color }, i) => (
              <div key={title} className="reveal group rounded-2xl border border-white/8 bg-white/[0.04] p-6 backdrop-blur-sm transition-all duration-300 hover:bg-white/[0.08] hover:border-white/15" data-delay={String(i * 80)}>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}20` }}>
                  <Icon className="h-5 w-5" style={{ color }} />
                </div>
                <h3 className="mt-5 font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#b8c3cf]">{copy}</p>
              </div>
            ))}
          </div>
          <div className="reveal mt-12 text-center">
            <Link href="/product"
              className="group inline-flex items-center text-sm font-bold text-[#f9ae5a] transition hover:text-[#eca04e]">
              Bekijk alle functies
              <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#f7f8f6] to-[#eef3ef] py-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_100%,rgba(249,174,90,0.1),transparent)]" />
        <div className="relative mx-auto max-w-3xl px-5 text-center sm:px-8">
          <div className="reveal">
            <p className="text-sm font-bold uppercase tracking-widest text-[#f9ae5a]">Klaar om te starten?</p>
            <h2 className="mt-3 text-4xl font-extrabold leading-tight text-[#0d1520] sm:text-5xl">
              Bekijk hoe Lead Finder in jouw proces past.
            </h2>
            <p className="mt-5 text-lg leading-8 text-[#5a6878]">
              We bekijken je huidige prospectieflow, tonen de app en bepalen welke modules meteen waarde leveren.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link href="/contact"
                className="group inline-flex h-13 w-full items-center justify-center rounded-xl bg-[#f9ae5a] px-10 text-sm font-bold text-[#14100b] shadow-[0_8px_32px_rgba(249,174,90,0.5)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#eca04e] hover:shadow-[0_12px_40px_rgba(249,174,90,0.65)] sm:w-auto">
                Plan een demo
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link href="/login"
                className="inline-flex h-13 w-full items-center justify-center rounded-xl border border-[#cfd8d2] bg-white px-10 text-sm font-semibold text-[#172131] shadow-sm transition-all hover:border-[#9fb4c8] sm:w-auto">
                Login
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/* ══════════════════════════════════════════════
   PRODUCT PAGE
══════════════════════════════════════════════ */
function ProductPage() {
  const modules = [
    { icon: Search,        title: "Lead Discovery",       color: "#3b82f6", summary: "Vind en verrijk prospects op schaal.", features: ["Zoek op regio, niche of type bedrijf","Automatische contactdata verrijking","Import vanuit eigen bestanden","Deduplicatie en kwaliteitsfilters"] },
    { icon: Target,        title: "Lead Scoring",         color: "#8b5cf6", summary: "Meet commerciële kans per lead.",       features: ["Website kwaliteitsanalyse","Local SEO score","Review aanwezigheid & reputatie","Social media aanwezigheid"] },
    { icon: MailCheck,     title: "Outreach & Campagnes", color: "#f9ae5a", summary: "Gestructureerde opvolging.",            features: ["E-mail templates met personalisatie","Drip-sequences en automatisering","Ingebouwde goedkeuringsflows","Campagne KPI tracking"] },
    { icon: FileText,      title: "Offertes & Rapporten", color: "#10b981", summary: "Professioneel presenteren.",            features: ["PDF-offertes vanuit leadcontext","Branded rapport templates","Klant-specifieke rapportage","E-mail delivery tracking"] },
    { icon: CalendarCheck, title: "Bookings",             color: "#f43f5e", summary: "Afspraken op je website.",             features: ["Embed widget voor elke site","Google Calendar sync","Automatische bevestigingsmails","Afspraaktypes configureerbaar"] },
    { icon: Star,          title: "Reviews & Reputatie",  color: "#f59e0b", summary: "Bouw vertrouwen actief op.",           features: ["Review uitnodigingen versturen","Embed widget voor je site","Score monitoring","Geïntegreerd in leadflow"] },
    { icon: Bot,           title: "AI Chatbot",           color: "#06b6d4", summary: "Getrainde assistent voor je site.",    features: ["Bedrijfsspecifieke training","Leadkwalificatie in gesprek","Embed op elke pagina","Gesprekslogs & analytics"] },
    { icon: BarChart3,     title: "Cockpit & Dashboards", color: "#84cc16", summary: "Overzicht op alles wat beweegt.",      features: ["Pipeline waarde & status","Campagne resultaten","Booking & review KPIs","Export naar PDF of CSV"] },
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#0d1520] py-28 text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-40 top-0 h-[600px] w-[600px] rounded-full bg-[#f9ae5a]/8 blur-[120px]" />
          <div className="absolute left-0 top-1/2 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-[#12a66a]/6 blur-[100px]" />
        </div>
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-3xl animate-fade-in">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#f9ae5a]">
              <Image src="/favicon.ico" alt="" width={16} height={16} className="rounded-sm" />
              Product overzicht
            </div>
            <h1 className="text-5xl font-extrabold leading-tight sm:text-6xl lg:text-7xl">
              Alles in één{" "}
              <span className="gradient-text">commerciële hub.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#b8c3cf]">
              Digitify Lead Finder brengt prospectie, communicatie en conversie samen. Je ziet waar elke lead staat, welke actie nodig is en hoe snel je team vooruitgaat.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/contact" className="group inline-flex h-12 items-center rounded-xl bg-[#f9ae5a] px-7 text-sm font-bold text-[#14100b] shadow-[0_8px_32px_rgba(249,174,90,0.4)] transition-all duration-300 hover:bg-[#eca04e]">
                Plan een demo <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link href="/login" className="inline-flex h-12 items-center rounded-xl border border-white/20 px-7 text-sm font-semibold text-white transition hover:bg-white/10">
                Login
              </Link>
            </div>
          </div>
          <div className="mt-16 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { value: "8",    label: "Geïntegreerde modules" },
              { value: "1",    label: "Werkplek voor je team" },
              { value: "100%", label: "Belgisch product" },
              { value: "0",    label: "Losse tools nodig" },
            ].map(({ value, label }) => (
              <div key={label} className="reveal rounded-2xl border border-white/8 bg-white/[0.05] p-5 text-center">
                <div className="text-3xl font-extrabold text-[#f9ae5a]">{value}</div>
                <div className="mt-1.5 text-sm text-[#b8c3cf]">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modules */}
      <section className="bg-[#f7f8f6] py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="reveal mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-[#f9ae5a]">Modules</p>
            <h2 className="mt-3 text-4xl font-extrabold text-[#0d1520] sm:text-5xl">
              Acht krachtige modules, <span className="gradient-text">één coherente flow.</span>
            </h2>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {modules.map(({ icon: Icon, title, color, summary, features }, i) => (
              <article key={title} className="reveal flex flex-col rounded-2xl border border-[#dfe5df] bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_60px_rgba(13,21,32,0.1)]" data-delay={String(i * 50)}>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}18` }}>
                  <Icon className="h-6 w-6" style={{ color }} />
                </div>
                <h3 className="mt-5 font-extrabold text-[#0d1520]">{title}</h3>
                <p className="mt-1 text-xs text-[#6a7684]">{summary}</p>
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
      <section className="bg-white py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
            <div className="reveal-left">
              <p className="text-sm font-bold uppercase tracking-widest text-[#f9ae5a]">Geïntegreerde workflow</p>
              <h2 className="mt-3 text-4xl font-extrabold leading-tight text-[#0d1520] sm:text-5xl">
                Alle modules werken samen als <span className="gradient-text">één systeem.</span>
              </h2>
              <p className="mt-5 leading-7 text-[#5a6878]">
                Een lead die je vindt in discovery gaat naadloos door scoring, outreach, offerte, booking en reviews — zonder context te verliezen.
              </p>
              <div className="mt-8 space-y-3">
                {[
                  { from: "Lead discovery", to: "Lead scoring",    copy: "Verrijkte leads krijgen automatisch een score." },
                  { from: "Lead scoring",   to: "Outreach",        copy: "Top-scored leads gaan meteen in je campagne." },
                  { from: "Outreach",       to: "Offerte & booking",copy: "Converteer geïnteresseerde leads in één klik." },
                  { from: "Offerte",        to: "Review flow",     copy: "Bouw aan je reputatie na elke deal." },
                ].map(({ from, to, copy }, i) => (
                  <div key={from} className="reveal flex items-start gap-4 rounded-xl border border-[#eef3ef] bg-[#f9fbfa] p-4" data-delay={String(i * 80)}>
                    <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-[#f9ae5a]" />
                    <div>
                      <p className="text-sm font-bold text-[#0d1520]">{from} → {to}</p>
                      <p className="mt-0.5 text-sm text-[#5a6878]">{copy}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="reveal-right">
              <div className="rounded-2xl border border-[#e2e8e3] bg-[#0d1520] p-6 shadow-[0_24px_80px_rgba(13,21,32,0.2)] sm:p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#f9ae5a]">Live pipeline</p>
                    <p className="mt-0.5 text-lg font-extrabold text-white">Lead Finder Suite</p>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-[#b8c3cf]">
                    <span className="h-2 w-2 rounded-full bg-[#12a66a]" />
                    Live
                  </div>
                </div>
                <div className="mt-5 space-y-2.5">
                  {[
                    { name: "Luma Dental",   score: 92, status: "Offerte verzonden", pct: 90 },
                    { name: "Atelier Noord", score: 84, status: "Demo gepland",      pct: 70 },
                    { name: "Vesta Solar",   score: 78, status: "Review gevraagd",  pct: 55 },
                    { name: "Studio Mars",   score: 71, status: "In outreach",       pct: 40 },
                  ].map(({ name, score, status, pct }) => (
                    <div key={name} className="rounded-xl border border-white/8 bg-white/[0.05] p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white">{name}</span>
                        <span className="rounded-lg bg-[#12a66a]/20 px-2 py-0.5 text-xs font-extrabold text-[#12a66a]">{score}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-gradient-to-r from-[#f9ae5a] to-[#eca04e]" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="shrink-0 text-xs text-[#b8c3cf]">{status}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {[
                    { label: "Open offertes",  value: "18" },
                    { label: "Chatgesprekken", value: "42" },
                    { label: "Review score",   value: "4.8 ⭐" },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-xl bg-white/[0.05] p-3 text-center">
                      <div className="text-xl font-extrabold text-[#f9ae5a]">{value}</div>
                      <div className="mt-1 text-[10px] text-[#b8c3cf]">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-b from-[#f7f8f6] to-[#eef3ef] py-20">
        <div className="reveal mx-auto max-w-3xl px-5 text-center sm:px-8">
          <h2 className="text-3xl font-extrabold text-[#0d1520]">Klaar om Lead Finder in actie te zien?</h2>
          <p className="mt-4 text-[#5a6878]">Plan een gepersonaliseerde demo en zie hoe alle modules in jouw workflow passen.</p>
          <Link href="/contact" className="group mt-8 inline-flex h-12 items-center rounded-xl bg-[#f9ae5a] px-8 text-sm font-bold text-[#14100b] shadow-[0_8px_32px_rgba(249,174,90,0.5)] transition-all duration-300 hover:bg-[#eca04e]">
            Plan demo nu <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </section>
    </>
  );
}

/* ══════════════════════════════════════════════
   SOLUTIONS PAGE
══════════════════════════════════════════════ */
function SolutionsPage() {
  const solutions = [
    {
      icon: Building2, title: "Voor digitale agencies", color: "#3b82f6",
      tagline: "Beheer prospectie en klantopvolging als een machine.",
      intro: "Als agency balanceer je meerdere klanten, prospectiedoelen en rapportage tegelijk. Lead Finder geeft je één hub voor leads, campagnes, offertes en reviews — per klantmandaat apart.",
      usecases: [
        { title: "White-label ervaring",     copy: "Klanten zien jouw naam en kleuren — niet Digitify." },
        { title: "Klant-specifieke rapporten",copy: "PDF-rapporten per klant met één klik." },
        { title: "Campagnegoedkeuring",      copy: "E-mails gaan pas uit na interne of klant-goedkeuring." },
        { title: "Multi-pipeline",           copy: "Alle prospects en statussen op één scherm." },
      ],
      results: ["Minder manueel werk per klant", "Professionelere presentatie", "Snellere time-to-first-outreach"],
    },
    {
      icon: Users2, title: "Voor sales teams", color: "#8b5cf6",
      tagline: "Minder administratie, meer focus op kansen die converteren.",
      intro: "Salesteams verliezen tijd aan handmatige opvolging, spreadsheets en losse e-mails. Lead Finder geeft elk teamlid een duidelijk beeld van hun pipeline en wat ze vandaag moeten doen.",
      usecases: [
        { title: "Lead scoring & prioriteit", copy: "Focus op leads met de hoogste commerciële fit — gesorteerd." },
        { title: "Gedeelde pipeline",         copy: "Teamleden zien elkaars leads, statussen en activiteiten." },
        { title: "E-mail opvolging",          copy: "Templates en drip-sequences verkorten de follow-up cyclus." },
        { title: "Quota rapportage",          copy: "Track voortgang per teamlid, per campagne of per periode." },
      ],
      results: ["Minder gemiste opvolgkansen", "Kortere salescyclus", "Meer omzet per teamlid"],
    },
    {
      icon: Globe2, title: "Voor lokale dienstverleners", color: "#10b981",
      tagline: "Combineer aanvragen, afspraken, reviews en offertes in één flow.",
      intro: "Lokale bedrijven hebben één platform nodig dat prospectie, bookings en reputatiegroei samenbrengt zonder dure marketingsoftware.",
      usecases: [
        { title: "Booking widget",     copy: "Klanten boeken rechtstreeks via je website." },
        { title: "Offerte aanvragen",  copy: "Ontvang aanvragen via embed en beantwoord in de app." },
        { title: "Review groei",       copy: "Automatische review-uitnodigingen na elke opdracht." },
        { title: "AI chatbot op site", copy: "Getrainde bot beantwoordt vragen en kwalificeert 24/7." },
      ],
      results: ["Meer bookings via je website", "Hogere Google-score", "Minder telefonisch contactbeheer"],
    },
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[#dfe5df] bg-gradient-to-br from-[#f0f7ff] via-[#f7f8f6] to-[#eef3ef] py-24">
        <div className="pointer-events-none absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-[#3b82f6]/6 blur-[100px]" />
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mx-auto max-w-3xl text-center animate-fade-in">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#3b82f6]/20 bg-[#3b82f6]/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#1d4ed8]">
              <Lightbulb className="h-3.5 w-3.5" />
              Oplossingen op maat
            </div>
            <h1 className="text-5xl font-extrabold leading-tight text-[#0d1520] sm:text-6xl">
              Groei-workflows voor teams die geen tijd{" "}
              <span className="gradient-text">willen verliezen.</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-[#4d5b6b]">
              Van agencies tot lokale dienstverleners: Lead Finder vormt zich rond concrete workflows zoals leadkwalificatie, campagne-opvolging, bookings en reviewgroei.
            </p>
            <Link href="/contact" className="group mt-8 inline-flex h-12 items-center rounded-xl bg-[#f9ae5a] px-8 text-sm font-bold text-[#14100b] shadow-[0_8px_32px_rgba(249,174,90,0.5)] transition-all hover:bg-[#eca04e]">
              Plan een demo <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* Solution cards */}
      <section className="bg-[#f7f8f6] py-24">
        <div className="mx-auto max-w-7xl space-y-8 px-5 sm:px-8">
          {solutions.map(({ icon: Icon, title, tagline, color, intro, usecases, results }, idx) => (
            <article key={title} className="reveal overflow-hidden rounded-2xl border border-[#dfe5df] bg-white shadow-sm transition-all duration-300 hover:shadow-[0_16px_60px_rgba(13,21,32,0.08)]" data-delay={String(idx * 100)}>
              <div className="flex items-center gap-5 border-b border-[#dfe5df] p-6 sm:p-8" style={{ background: `linear-gradient(135deg, ${color}08, transparent)` }}>
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-sm" style={{ backgroundColor: `${color}20` }}>
                  <Icon className="h-7 w-7" style={{ color }} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color }}>Oplossing {idx + 1}</p>
                  <h2 className="text-2xl font-extrabold text-[#0d1520]">{title}</h2>
                  <p className="mt-0.5 text-sm text-[#5a6878]">{tagline}</p>
                </div>
              </div>
              <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_1.5fr]">
                <div>
                  <p className="leading-7 text-[#4d5b6b]">{intro}</p>
                  <div className="mt-6">
                    <p className="text-sm font-bold text-[#0d1520]">Resultaten die je kunt verwachten:</p>
                    <ul className="mt-3 space-y-2">
                      {results.map((r) => (
                        <li key={r} className="flex items-center gap-2 text-sm text-[#344052]">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#12a66a]" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Link href="/contact" className="group mt-6 inline-flex items-center text-sm font-bold transition" style={{ color }}>
                    Plan demo voor {title.replace("Voor ", "")}
                    <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {usecases.map(({ title: t, copy }) => (
                    <div key={t} className="rounded-xl border border-[#e8eeea] bg-[#f9fbfa] p-4 transition hover:bg-white hover:shadow-sm">
                      <p className="font-bold text-[#0d1520]">{t}</p>
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
      <section className="bg-white py-24">
        <div className="mx-auto max-w-4xl px-5 sm:px-8">
          <div className="reveal text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-[#f9ae5a]">Lead Finder vs. losse tools</p>
            <h2 className="mt-3 text-3xl font-extrabold text-[#0d1520]">Waarom alles in één platform?</h2>
          </div>
          <div className="reveal mt-10 overflow-hidden rounded-2xl border border-[#dfe5df] shadow-sm">
            <div className="grid grid-cols-3 border-b border-[#dfe5df] bg-[#f9fbfa] px-6 py-4 text-sm font-bold text-[#344052]">
              <div>Functie</div>
              <div className="text-center text-[#f9ae5a]">✦ Lead Finder</div>
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
              <div key={String(feature)} className="grid grid-cols-3 border-b border-[#f0f4f1] px-6 py-4 text-sm last:border-0 hover:bg-[#fafcfa]">
                <div className="text-[#344052]">{feature}</div>
                <div className="text-center">
                  {ours === true ? <CheckCircle2 className="mx-auto h-5 w-5 text-[#12a66a]" /> : <span className="text-[#9aafbe]">{ours}</span>}
                </div>
                <div className="text-center text-[#d1d5db]">
                  {theirs === false ? "✕" : <span className="text-[#9aafbe]">{theirs}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#0d1520] py-20 text-white">
        <div className="reveal mx-auto max-w-3xl px-5 text-center sm:px-8">
          <h2 className="text-3xl font-extrabold">Welke oplossing past bij jouw team?</h2>
          <p className="mt-4 text-[#b8c3cf]">We configureren Lead Finder specifiek voor jouw use case.</p>
          <Link href="/contact" className="group mt-8 inline-flex h-12 items-center rounded-xl bg-[#f9ae5a] px-8 text-sm font-bold text-[#14100b] shadow-[0_8px_32px_rgba(249,174,90,0.4)] transition-all hover:bg-[#eca04e]">
            Plan een demo <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </section>
    </>
  );
}

/* ══════════════════════════════════════════════
   ABOUT PAGE
══════════════════════════════════════════════ */
function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[#dfe5df] bg-gradient-to-br from-[#f0fff7] via-[#f7f8f6] to-[#eef3ef] py-24">
        <div className="pointer-events-none absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-[#12a66a]/8 blur-[100px]" />
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
            <div className="animate-fade-in">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#12a66a]/20 bg-[#12a66a]/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#0b8354]">
                <Image src="/favicon.ico" alt="" width={16} height={16} className="rounded-sm" />
                Gemaakt door Digitify · België
              </div>
              <h1 className="text-5xl font-extrabold leading-tight text-[#0d1520] sm:text-6xl">
                Gebouwd door een team dat groei{" "}
                <span className="gradient-text-green">praktisch maakt.</span>
              </h1>
              <p className="mt-7 text-lg leading-8 text-[#4d5b6b]">
                Digitify bouwt websites, funnels en digitale systemen voor ondernemers die meetbare groei willen. Lead Finder is ons antwoord op een echte vraag: "Hoe haal je meer uit je leads, zonder meer tools?"
              </p>
              <Link href="/contact" className="group mt-9 inline-flex h-12 items-center rounded-xl bg-[#f9ae5a] px-7 text-sm font-bold text-[#14100b] shadow-[0_8px_32px_rgba(249,174,90,0.5)] transition-all hover:bg-[#eca04e]">
                Neem contact op <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
            <div className="space-y-4">
              {[
                { icon: Award,     title: "Belgisch team",    copy: "Opgericht en beheerd vanuit België, met lokale marktkennis.",      color: "#f9ae5a" },
                { icon: Lightbulb, title: "Praktisch eerst",  copy: "Elke feature begint met een echte vraag van een echte klant.",     color: "#12a66a" },
                { icon: TrendingUp,title: "Meetbaar resultaat",copy: "We bouwen voor teams die groei willen aantonen, niet alleen nastreven.", color: "#3b82f6" },
              ].map(({ icon: Icon, title, copy, color }, i) => (
                <div key={title} className="reveal flex gap-4 rounded-2xl border border-[#dfe5df] bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md" data-delay={String(i * 80)}>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}18` }}>
                    <Icon className="h-5 w-5" style={{ color }} />
                  </div>
                  <div>
                    <p className="font-bold text-[#0d1520]">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-[#5a6878]">{copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Story + Values */}
      <section className="bg-white py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-16 lg:grid-cols-2">
            <div className="reveal-left">
              <p className="text-sm font-bold uppercase tracking-widest text-[#f9ae5a]">Ons verhaal</p>
              <h2 className="mt-3 text-4xl font-extrabold leading-tight text-[#0d1520]">
                Waarom we Lead Finder <span className="gradient-text">gebouwd hebben.</span>
              </h2>
              <div className="mt-8 space-y-6 text-base leading-8 text-[#4d5b6b]">
                <p>Digitify werkt dagelijks met bedrijven die online willen groeien. We bouwden websites, automatiseerden funnels en hielpen teams met digitale strategie. Maar we zagen steeds dezelfde bottleneck: leads vinden was makkelijk, maar opvolgen was een chaos van spreadsheets en losse mails.</p>
                <p>Lead Finder is ontstaan uit die frustratie. We wilden één tool die het volledige commerciële pad dekt — van eerste contact tot klant — zonder dat je 5 verschillende abonnementen nodig hebt.</p>
                <p>Vandaag is Lead Finder een volledig uitgewerkt platform dat agencies, salesteams en lokale dienstverleners helpt om professioneler en sneller te groeien.</p>
              </div>
              <Link href="https://www.digitify.be" target="_blank" rel="noopener noreferrer"
                className="group mt-8 inline-flex items-center gap-2 text-sm font-bold text-[#f9ae5a] transition hover:text-[#eca04e]">
                Bezoek www.digitify.be
                <ExternalLink className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            <div className="reveal-right space-y-4">
              <p className="text-sm font-bold uppercase tracking-widest text-[#f9ae5a]">Onze waarden</p>
              {[
                { icon: Target,     title: "Resultaat boven features",  copy: "Elke toevoeging moet een concrete verbetering brengen voor de eindgebruiker.", color: "#f9ae5a" },
                { icon: ShieldCheck,title: "Eerlijk en transparant",    copy: "Geen verborgen kosten, geen complexe contracten. Wat je ziet, is wat je krijgt.", color: "#12a66a" },
                { icon: Heart,      title: "Gebouwd met zorg",         copy: "Elk scherm en elke workflow is doordacht. Slechte UX tolereert niemand.", color: "#f43f5e" },
                { icon: TrendingUp, title: "Groei is meetbaar",        copy: "Als je Lead Finder gebruikt, moet je resultaten kunnen aantonen.", color: "#3b82f6" },
              ].map(({ icon: Icon, title, copy, color }, i) => (
                <div key={title} className="reveal flex gap-4 rounded-xl border border-[#e8eeea] bg-[#f9fbfa] p-5 transition-all duration-300 hover:bg-white hover:shadow-sm" data-delay={String(i * 60)}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}18` }}>
                    <Icon className="h-5 w-5" style={{ color }} />
                  </div>
                  <div>
                    <p className="font-bold text-[#0d1520]">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-[#5a6878]">{copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Dark ecosystem */}
      <section className="relative overflow-hidden bg-[#0d1520] py-24 text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-0 top-0 h-[400px] w-[400px] rounded-full bg-[#f9ae5a]/5 blur-[100px]" />
          <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-[#12a66a]/5 blur-[100px]" />
        </div>
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            <div className="reveal-left">
              <p className="text-sm font-bold uppercase tracking-widest text-[#8bbdff]">Digitify ecosystem</p>
              <h2 className="mt-3 text-4xl font-extrabold leading-tight">
                Lead Finder is deel van <span className="gradient-text">iets groters.</span>
              </h2>
              <p className="mt-5 leading-7 text-[#b8c3cf]">
                Naast Lead Finder bouwt Digitify op maat: websites, funnels, e-commerce, automatiseringen en digitale strategie. We zijn een one-stop-shop voor bedrijven die serieus digitaal willen groeien.
              </p>
              <Link href="https://www.digitify.be" target="_blank" rel="noopener noreferrer"
                className="group mt-8 inline-flex h-11 items-center gap-2 rounded-xl border border-white/20 px-5 text-sm font-bold text-white transition hover:bg-white/10">
                Bezoek digitify.be <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
            <div className="reveal-right grid grid-cols-2 gap-3">
              {[
                { label: "Websites",      sub: "Op maat gebouwd",  color: "#3b82f6" },
                { label: "Funnels",       sub: "Conversiegericht", color: "#8b5cf6" },
                { label: "Automatisering",sub: "Tijdbesparend",    color: "#12a66a" },
                { label: "Lead Finder",   sub: "Dit platform",     color: "#f9ae5a" },
              ].map(({ label, sub, color }) => (
                <div key={label} className="rounded-xl border border-white/8 bg-white/[0.05] p-5 transition hover:bg-white/[0.1]">
                  <div className="h-2 w-8 rounded-full" style={{ backgroundColor: color }} />
                  <div className="mt-4 font-extrabold text-white">{label}</div>
                  <div className="mt-1 text-xs text-[#b8c3cf]">{sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-b from-[#f7f8f6] to-[#eef3ef] py-20">
        <div className="reveal mx-auto max-w-3xl px-5 text-center sm:px-8">
          <h2 className="text-3xl font-extrabold text-[#0d1520]">Wil je samenwerken met Digitify?</h2>
          <p className="mt-4 text-[#5a6878]">Plan een gesprek over Lead Finder of een breder digitaal groeiraject.</p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/contact" className="group inline-flex h-12 items-center rounded-xl bg-[#f9ae5a] px-8 text-sm font-bold text-[#14100b] shadow-[0_8px_32px_rgba(249,174,90,0.5)] transition-all hover:bg-[#eca04e]">
              Neem contact op <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="https://www.digitify.be" target="_blank" rel="noopener noreferrer"
              className="inline-flex h-12 items-center rounded-xl border border-[#cfd8d2] bg-white px-8 text-sm font-semibold text-[#172131] shadow-sm transition hover:border-[#9fb4c8]">
              www.digitify.be <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

/* ══════════════════════════════════════════════
   CONTACT PAGE
══════════════════════════════════════════════ */
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
      <section className="relative overflow-hidden border-b border-[#dfe5df] bg-gradient-to-br from-[#faf5ff] via-[#f7f8f6] to-[#eef3ef] py-20">
        <div className="pointer-events-none absolute right-0 top-0 h-[400px] w-[400px] rounded-full bg-[#8b5cf6]/8 blur-[100px]" />
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center animate-fade-in">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#8b5cf6]/20 bg-[#8b5cf6]/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#6d28d9]">
              <MessageSquareText className="h-3.5 w-3.5" />
              Demo aanvragen
            </div>
            <h1 className="text-5xl font-extrabold leading-tight text-[#0d1520] sm:text-6xl">
              Bekijk hoe Lead Finder in jouw{" "}
              <span className="gradient-text">proces past.</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-[#4d5b6b]">
              Plan een demo, bespreek je huidige leadflow en ontdek welke modules meteen waarde kunnen leveren voor je team.
            </p>
          </div>
        </div>
      </section>

      {/* Main */}
      <section className="bg-[#f7f8f6] py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">

            {/* Form */}
            <div className="reveal-left rounded-2xl border border-[#dfe5df] bg-white p-8 shadow-sm sm:p-10">
              {sent ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#12a66a]/15 animate-scale-in">
                    <CheckCircle2 className="h-10 w-10 text-[#12a66a]" />
                  </div>
                  <h2 className="mt-7 text-2xl font-extrabold text-[#0d1520]">Bericht verzonden!</h2>
                  <p className="mt-3 text-[#5a6878]">We nemen zo snel mogelijk contact met je op — meestal binnen 1 werkdag.</p>
                  <button onClick={() => setSent(false)} className="mt-6 text-sm font-semibold text-[#f9ae5a] hover:text-[#eca04e]">
                    Nieuw bericht sturen
                  </button>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-extrabold text-[#0d1520]">Stuur ons een bericht</h2>
                  <p className="mt-2 text-sm text-[#5a6878]">We reageren doorgaans binnen 1 werkdag.</p>
                  <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {[
                        { id: "name",    label: "Naam *",   type: "text",  placeholder: "Jouw naam",       required: true  },
                        { id: "email",   label: "E-mail *", type: "email", placeholder: "jij@bedrijf.be",  required: true  },
                      ].map(({ id, label, type, placeholder, required }) => (
                        <div key={id}>
                          <label className="mb-2 block text-sm font-bold text-[#344052]">{label}</label>
                          <input
                            type={type}
                            required={required}
                            value={(form as any)[id]}
                            onChange={(e) => setForm({ ...form, [id]: e.target.value })}
                            placeholder={placeholder}
                            className="w-full rounded-xl border border-[#dde3e8] bg-[#f9fbfa] px-4 py-3 text-sm outline-none transition-all duration-200 focus:border-[#f9ae5a] focus:bg-white focus:ring-3 focus:ring-[#f9ae5a]/20 placeholder:text-[#b0bcca]"
                          />
                        </div>
                      ))}
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-bold text-[#344052]">Bedrijf</label>
                      <input
                        type="text"
                        value={form.company}
                        onChange={(e) => setForm({ ...form, company: e.target.value })}
                        placeholder="Bedrijfsnaam"
                        className="w-full rounded-xl border border-[#dde3e8] bg-[#f9fbfa] px-4 py-3 text-sm outline-none transition-all duration-200 focus:border-[#f9ae5a] focus:bg-white focus:ring-3 focus:ring-[#f9ae5a]/20 placeholder:text-[#b0bcca]"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-bold text-[#344052]">Bericht *</label>
                      <textarea
                        required
                        rows={5}
                        value={form.message}
                        onChange={(e) => setForm({ ...form, message: e.target.value })}
                        placeholder="Vertel ons over je huidige leadflow en wat je wil verbeteren..."
                        className="w-full resize-none rounded-xl border border-[#dde3e8] bg-[#f9fbfa] px-4 py-3 text-sm outline-none transition-all duration-200 focus:border-[#f9ae5a] focus:bg-white focus:ring-3 focus:ring-[#f9ae5a]/20 placeholder:text-[#b0bcca]"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={sending}
                      className="group inline-flex h-13 w-full items-center justify-center rounded-xl bg-[#f9ae5a] text-sm font-bold text-[#14100b] shadow-[0_8px_32px_rgba(249,174,90,0.5)] transition-all duration-300 hover:bg-[#eca04e] hover:shadow-[0_12px_40px_rgba(249,174,90,0.65)] disabled:opacity-60"
                    >
                      {sending ? (
                        <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-[#14100b]/30 border-t-[#14100b]" />Verzenden...</span>
                      ) : (
                        <span className="flex items-center gap-2">Stuur bericht <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
                      )}
                    </button>
                  </form>
                </>
              )}
            </div>

            {/* Sidebar */}
            <div className="reveal-right space-y-5">
              <div className="rounded-2xl border border-[#f9ae5a]/25 bg-gradient-to-br from-[#fffbf5] to-[#fff8ee] p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <Image src="/favicon.ico" alt="Digitify" width={32} height={32} className="rounded-lg" />
                  <p className="text-sm font-bold uppercase tracking-wider text-[#c47c1a]">Wat je krijgt in de demo</p>
                </div>
                <ul className="mt-5 space-y-4">
                  {[
                    { icon: Users2,         copy: "Een korte analyse van je huidige prospectieproces." },
                    { icon: MessageSquareText,copy: "Walkthrough van leads, campagnes, offertes, bookings en reviews." },
                    { icon: Bot,            copy: "Advies over welke modules je best eerst activeert." },
                    { icon: TrendingUp,     copy: "Schatting van de tijdsbesparing voor jouw team." },
                  ].map(({ icon: Icon, copy }) => (
                    <li key={copy} className="flex gap-3 text-sm text-[#4d5b6b]">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#12a66a]" />
                      {copy}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-[#dfe5df] bg-white p-6 shadow-sm">
                <p className="font-bold text-[#0d1520]">Contactgegevens</p>
                <div className="mt-4 space-y-3">
                  {[
                    { icon: Mail,   label: "hello@digitify.be",    href: "mailto:hello@digitify.be" },
                    { icon: Phone,  label: "+32 (0) 486 51 57 73", href: "tel:+3248651573" },
                    { icon: MapPin, label: "België",               href: undefined },
                    { icon: Globe2, label: "www.digitify.be",      href: "https://www.digitify.be" },
                  ].map(({ icon: Icon, label, href }) => (
                    <div key={label} className="flex items-center gap-3 text-sm text-[#4d5b6b]">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f9ae5a]/10">
                        <Icon className="h-3.5 w-3.5 text-[#f9ae5a]" />
                      </div>
                      {href ? (
                        <a href={href} className="transition hover:text-[#f9ae5a]" target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">{label}</a>
                      ) : (
                        <span>{label}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[#dfe5df] bg-[#f9fbfa] p-6">
                <p className="font-bold text-[#0d1520]">Veelgestelde vragen</p>
                <div className="mt-4 space-y-5">
                  {[
                    { q: "Hoe lang duurt een demo?",      a: "Doorgaans 30–45 minuten, online of telefonisch." },
                    { q: "Is Lead Finder voor grote bedrijven?", a: "Nee, perfect voor KMO's, agencies en freelancers." },
                    { q: "Kan ik proberen voor ik koop?", a: "Ja, we bespreken dat in de demo." },
                  ].map(({ q, a }) => (
                    <div key={q}>
                      <p className="text-sm font-bold text-[#0d1520]">{q}</p>
                      <p className="mt-1 text-sm leading-6 text-[#5a6878]">{a}</p>
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

/* ─── HOME DASHBOARD MOCKUP ─── */
function HomeDashboard() {
  return (
    <div className="relative w-full">
      <div className="absolute -bottom-6 -left-6 h-full w-full rounded-2xl bg-[#f9ae5a]/10" />
      <div className="relative rounded-2xl border border-[#dde3e8] bg-[#0d1520] p-2.5 shadow-[0_32px_80px_rgba(13,21,32,0.25)]">
        <div className="rounded-xl border border-white/8 bg-[#f9fbfa]">
          {/* Top bar */}
          <div className="flex items-center justify-between border-b border-[#e2e8e3] p-4">
            <div className="flex items-center gap-3">
              <Image src="/favicon.ico" alt="Digitify" width={24} height={24} className="rounded-md" />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#f9ae5a]">Pipeline vandaag</div>
                <div className="text-sm font-extrabold text-[#0d1520]">Lead Finder Suite</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-[#dfe5df] bg-white px-3 py-1.5 text-xs font-bold text-[#344052]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#12a66a]" />
              Live
            </div>
          </div>

          {/* Leads */}
          <div className="p-4 space-y-2.5">
            {[
              { name: "Luma Dental",   score: 92, status: "Offerte klaar",  pct: 90, tag: "bg-[#eaf6f0] text-[#0b8354]" },
              { name: "Atelier Noord", score: 84, status: "Demo gepland",   pct: 70, tag: "bg-[#eef4ff] text-[#1d4ed8]" },
              { name: "Vesta Solar",   score: 78, status: "Review flow",    pct: 55, tag: "bg-[#fff8ee] text-[#c47c1a]" },
            ].map(({ name, score, status, pct, tag }) => (
              <div key={name} className="rounded-xl border border-[#e8eeea] bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#172131]">{name}</span>
                  <span className={`rounded-lg px-2 py-0.5 text-xs font-extrabold ${tag}`}>{score}</span>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e6ebe7]">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#f9ae5a] to-[#eca04e] transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="shrink-0 text-[10px] text-[#6a7684]">{status}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom tiles */}
          <div className="grid grid-cols-3 gap-2.5 border-t border-[#e8eeea] p-4">
            {[
              { icon: Bot,   label: "Chatbot", value: "42 gesprekken" },
              { icon: Quote, label: "Quotes",  value: "7 klaar" },
              { icon: Star,  label: "Reviews", value: "4.8 ⭐" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-xl border border-[#e8eeea] bg-white p-3 shadow-sm">
                <Icon className="h-4 w-4 text-[#f9ae5a]" />
                <div className="mt-2 text-xs font-extrabold text-[#0d1520]">{label}</div>
                <div className="mt-0.5 text-[10px] text-[#6a7684]">{value}</div>
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
    <footer className="border-t border-[#1a1510] bg-[#0d1117] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr]">
        <div>
          <div className="flex items-center gap-3">
            <Image src="/favicon.ico" alt="Digitify" width={40} height={40} className="rounded-xl" />
            <div>
              <div className="font-extrabold">Digitify Lead Finder</div>
              <div className="text-xs text-[#9d948b]">Partner in Digital Solutions</div>
            </div>
          </div>
          <p className="mt-6 max-w-xs text-sm leading-7 text-[#b8b0a6]">
            Premium lead discovery en opvolging, gemaakt door Digitify voor bedrijven die digitale groei praktisch willen organiseren.
          </p>
          <div className="mt-5 space-y-2">
            {[
              { icon: Mail,   text: "hello@digitify.be",    href: "mailto:hello@digitify.be" },
              { icon: Phone,  text: "+32 (0) 486 51 57 73", href: "tel:+3248651573" },
              { icon: MapPin, text: "België",               href: undefined },
            ].map(({ icon: Icon, text, href }) => (
              <div key={text} className="flex items-center gap-2 text-sm text-[#9d948b]">
                <Icon className="h-3.5 w-3.5 text-[#f9ae5a]" />
                {href ? <a href={href} className="hover:text-[#f9ae5a]">{text}</a> : text}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-4 text-xs font-extrabold uppercase tracking-widest text-[#f9ae5a]">Website</div>
          <div className="space-y-3 text-sm text-[#b8b0a6]">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="block transition hover:text-[#f9ae5a]">{item.label}</Link>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-4 text-xs font-extrabold uppercase tracking-widest text-[#f9ae5a]">Actie</div>
          <div className="space-y-3 text-sm text-[#b8b0a6]">
            <Link href="/login" className="block transition hover:text-[#f9ae5a]">Login</Link>
            <Link href="/register" className="block transition hover:text-[#f9ae5a]">Toegang aanvragen</Link>
            <a href="https://www.digitify.be" target="_blank" rel="noopener noreferrer" className="block transition hover:text-[#f9ae5a]">www.digitify.be</a>
          </div>
        </div>
        <div>
          <div className="mb-4 text-xs font-extrabold uppercase tracking-widest text-[#f9ae5a]">Juridisch</div>
          <div className="space-y-3 text-sm text-[#9d948b]">
            <div>BTW BE0685.556.507</div>
            <div>© {new Date().getFullYear()} Digitify</div>
          </div>
        </div>
      </div>
      <div className="border-t border-white/[0.06] px-5 py-5 text-center text-xs text-[#5a5450]">
        © {new Date().getFullYear()} Digitify. Webdesign, media en marketing voor digitale groei. · Alle rechten voorbehouden.
      </div>
    </footer>
  );
}
