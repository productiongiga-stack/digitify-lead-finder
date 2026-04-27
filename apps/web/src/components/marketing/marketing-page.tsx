"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { trpc } from "@/lib/trpc/client";
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
  Send,
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
  ChevronDown,
  Circle,
  Tag,
  Filter,
  Palette,
  type LucideIcon,
} from "lucide-react";

type PageKey = "home" | "product" | "solutions" | "about" | "contact";

/* ─── SCROLL REVEAL ─── */
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal, .reveal-left, .reveal-right, .reveal-scale");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          setTimeout(() => el.classList.add("in-view"), Number(el.dataset.delay ?? 0));
          io.unobserve(el);
        });
      },
      { threshold: 0.1 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/* ─── ANIMATED NUMBER ─── */
function AnimatedNumber({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      let n = 0;
      const step = () => {
        n = Math.min(n + Math.ceil(target / 35), target);
        setVal(n);
        if (n < target) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { threshold: 0.5 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [target]);
  return <span ref={ref}>{val}{suffix}</span>;
}

const navItems = [
  { label: "Product",     href: "/product" },
  { label: "Oplossingen", href: "/oplossingen" },
  { label: "Over ons",    href: "/over-ons" },
  { label: "Contact",     href: "/contact" },
];

export type SolutionSlug =
  | "lead-search"
  | "outreach-ai"
  | "rapporten"
  | "white-label"
  | "offerte-configurator"
  | "booking-agenda"
  | "chatbot-widget"
  | "reviewsysteem";

type SolutionModule = {
  slug: SolutionSlug;
  icon: LucideIcon;
  label: string;
  title: string;
  description: string;
  bullets: string[];
  chipClass: string;
  mockup: ReactNode;
  detailIntro: string;
  detailSteps: string[];
  detailImpact: string[];
};

export const SOLUTION_MODULES: SolutionModule[] = [
  {
    slug: "lead-search",
    icon: Search,
    label: "Lead Search",
    title: "Vind en kwalificeer leads vanuit kaartdata.",
    description: "Zoek lokaal op niche en regio, score automatisch op potentieel en zet interessante profielen direct door naar je pipeline.",
    bullets: [
      "Zoeken op niche, stad en regio in enkele seconden.",
      "Directe scoring op commerciële fit en prioriteit.",
      "Leads meteen doorzetten naar campagne of CRM flow.",
    ],
    chipClass: "border-[#f9ae5a]/30 bg-[#fff8ee] text-[#b66d1e]",
    mockup: <SolutionsLeadSearchMockup />,
    detailIntro: "Lead Search geeft je team een snelle prospectielijn vanuit lokale kaartdata, met directe focus op leadkwaliteit in plaats van ruwe volume-lijsten.",
    detailSteps: [
      "Selecteer niche, regio en zoekfilters per campagne.",
      "Laat de app automatisch profielen ophalen en verrijken.",
      "Gebruik score + tags om direct je prioriteiten te bepalen.",
      "Stuur warme leads meteen door naar outreach of CRM.",
    ],
    detailImpact: ["Sneller prospecteren zonder manueel opzoekwerk.", "Hogere relevantie in je eerste contactmoment.", "Minder ruis in de pipeline door directe kwalificatie."],
  },
  {
    slug: "outreach-ai",
    icon: MailCheck,
    label: "Outreach met AI",
    title: "Laat AI je outreachflow versnellen.",
    description: "Stel mails op in jouw tone of voice, werk met goedkeuringsflows en verstuur rechtstreeks vanuit je eigen merkidentiteit.",
    bullets: [
      "Automatische drafts per doelgroep en intentie.",
      "Goedkeuringsflow voor teamcontrole en kwaliteitsniveau.",
      "Versturen in jouw branding zonder extra tools.",
    ],
    chipClass: "border-[#06b6d4]/25 bg-[#06b6d4]/10 text-[#0f7b8f]",
    mockup: <SolutionsOutreachMockup />,
    detailIntro: "Outreach met AI combineert snelheid en consistentie: je team vertrekt van sterke drafts, maar behoudt controle via approvals en branding.",
    detailSteps: [
      "Kies doelgroep, template en gewenste intentie.",
      "Genereer AI-drafts met context uit leaddata.",
      "Laat mails valideren in de interne goedkeuringsstap.",
      "Verstuur en volg replies op vanuit dezelfde flow.",
    ],
    detailImpact: ["Kortere tijd van lead naar eerste contact.", "Consistente tone of voice per account.", "Betere opvolging dankzij centrale campagnecontext."],
  },
  {
    slug: "rapporten",
    icon: BarChart3,
    label: "Rapporten",
    title: "Verkooprapporten die meteen sturen op prioriteit.",
    description: "Zet lead score, pipeline-status en opvolgacties om in duidelijke rapporten die klanten en teams in één oogopslag begrijpen.",
    bullets: [
      "Leadscore, status en actiepunten in 1 rapport.",
      "Realtime zicht op pipeline-gezondheid en kansen.",
      "Klaar voor klantpresentatie of intern overleg.",
    ],
    chipClass: "border-[#8b5cf6]/25 bg-[#8b5cf6]/10 text-[#6d3dc2]",
    mockup: <SolutionsReportsMockup />,
    detailIntro: "Rapporten maken prestaties leesbaar voor team en klant, met focus op scoringslogica, opvolging en concrete prioriteiten.",
    detailSteps: [
      "Bundel score, status en activiteit per leadsegment.",
      "Toon trends over pipelinewaarde en conversiemomenten.",
      "Export in een white-label presentatieformat.",
      "Gebruik rapporten als vaste ritmiek in opvolgmeetings.",
    ],
    detailImpact: ["Snellere beslissingen op basis van heldere data.", "Betere klantcommunicatie over voortgang.", "Meer grip op commerciële bottlenecks."],
  },
  {
    slug: "white-label",
    icon: ShieldCheck,
    label: "White-labelbaar",
    title: "Volledig in je eigen branding, zonder compromissen.",
    description: "Van login tot widgets en exports: kleuren, logo, stijl en communicatie lopen consistent door in elke flow van de app.",
    bullets: [
      "Eigen logo, kleurpalet en tone of voice per account.",
      "Consistente ervaring in login, app en embeds.",
      "Branding blijft uniform tot de gebruiker die wijzigt.",
    ],
    chipClass: "border-[#10b981]/25 bg-[#10b981]/10 text-[#0f7f5b]",
    mockup: <SolutionsWhiteLabelMockup />,
    detailIntro: "White-label houdt je merk centraal in elke gebruikersstap, zodat klanten en prospects altijd jouw identiteit ervaren in plaats van een generieke tool.",
    detailSteps: [
      "Stel primaire kleur, logo en merkaccenten per account in.",
      "Pas widget- en exportstijlen aan op je huisstijl.",
      "Beheer branding-consistentie over alle modules.",
      "Schaal dit model naar meerdere teams of klanten.",
    ],
    detailImpact: ["Professionelere klantervaring end-to-end.", "Meer vertrouwen door consistente merkpresentatie.", "Minder design-frictie bij groei van het team."],
  },
  {
    slug: "offerte-configurator",
    icon: FileText,
    label: "Offerte configurator",
    title: "Configureer, bereken en verstuur in één flow.",
    description: "De configurator begeleidt bezoekers stap voor stap van dienstkeuze tot aanvraag. Prijzen, opties en totalen worden live opgebouwd zodat je team meteen een volledige draft-offerte heeft.",
    bullets: [
      "Duidelijke stappen: dienst, product, specificaties en gegevens.",
      "Live prijsopbouw met subtotalen, btw en totaal.",
      "Aanvraag komt direct per account in je eigen offerteflow.",
    ],
    chipClass: "border-[#e85d3a]/25 bg-[#e85d3a]/10 text-[#b94d2f]",
    mockup: <SolutionsQuoteMockup />,
    detailIntro: "De offerteconfigurator reduceert heen-en-weer tussen sales en prospect door duidelijke stappen en realtime prijsopbouw in één gebruikersflow.",
    detailSteps: [
      "Laat bezoekers diensten en opties selecteren.",
      "Bereken live subtotaal, btw en totaalprijs.",
      "Capture contactgegevens en context direct in de app.",
      "Start opvolging meteen vanuit je offertepipeline.",
    ],
    detailImpact: ["Minder manuele offerte-opmaak.", "Snellere reactie op inkomende aanvragen.", "Betere kwaliteit van offertebriefings."],
  },
  {
    slug: "booking-agenda",
    icon: CalendarCheck,
    label: "Booking agenda",
    title: "Planning die meteen werkt op je website.",
    description: "Bezoekers kiezen rechtstreeks een beschikbaar slot. De agenda respecteert je ingestelde uren, blokkeert overlap en kan synchroniseren met Google Calendar voor realtime beschikbaarheid.",
    bullets: [
      "Week- en dagbeschikbaarheid met configureerbare slotduur.",
      "Conflictcheck tegen bestaande afspraken en kalenderblokkeringen.",
      "Automatische bevestiging voor klant en team.",
    ],
    chipClass: "border-[#f59e0b]/25 bg-[#f59e0b]/10 text-[#b66d1e]",
    mockup: <SolutionsBookingMockup />,
    detailIntro: "Booking agenda zet interesse om in concrete afspraken via een snelle, conflictvrije flow die direct met je planning meeloopt.",
    detailSteps: [
      "Definieer beschikbaarheid en slotlengtes per account.",
      "Toon enkel vrije momenten op je website of landingspagina.",
      "Voer automatische conflictchecks uit bij boeking.",
      "Verzend bevestigingen en synchroniseer met agenda's.",
    ],
    detailImpact: ["Meer afspraken zonder manuele planning.", "Minder no-shows door duidelijke bevestigingen.", "Efficiëntere intake over alle teams."],
  },
  {
    slug: "chatbot-widget",
    icon: Bot,
    label: "Chatbot widget",
    title: "AI-gesprekken die leads meteen kwalificeren.",
    description: "De chatbot draait in je branding, geeft directe antwoorden en stuurt elk gesprek door naar je inbox. Zo blijft support snel en worden commerciële kansen automatisch vastgelegd.",
    bullets: [
      "Gebaseerd op account-specifieke settings en kenniscontext.",
      "Slimme intentdetectie voor afspraak, offerte of support.",
      "Gesprekken direct bruikbaar in opvolging en pipeline.",
    ],
    chipClass: "border-[#06b6d4]/25 bg-[#06b6d4]/10 text-[#0f7b8f]",
    mockup: <SolutionsChatbotMockup />,
    detailIntro: "De chatbot widget combineert support en saleskwalificatie in één branded kanaal, zodat gesprekken niet verloren gaan tussen inboxen en losse tools.",
    detailSteps: [
      "Configureer kenniscontext per account.",
      "Detecteer intentie zoals offerte, booking of supportvraag.",
      "Stuur relevante gesprekken direct naar opvolging.",
      "Gebruik gespreksdata voor betere leadprioritering.",
    ],
    detailImpact: ["Snellere antwoorden buiten kantooruren.", "Meer gekwalificeerde inbound leads.", "Minder gemiste commerciële kansen."],
  },
  {
    slug: "reviewsysteem",
    icon: Star,
    label: "Reviewsysteem",
    title: "Van interne feedback naar publieke reviewgroei.",
    description: "Het systeem splitst automatisch op basis van score: lagere scores gaan naar interne feedback, hogere scores sturen klanten door naar jouw reviewplatforms om reputatie actief te versterken.",
    bullets: [
      "Tweeledige flow voor kwaliteitsopvolging en reputatie-opbouw.",
      "Platformkeuze per account: Google, Trustpilot of Facebook.",
      "Heldere statusopvolging van ingestuurde reviews.",
    ],
    chipClass: "border-[#ec4899]/25 bg-[#ec4899]/10 text-[#b93c79]",
    mockup: <SolutionsReviewMockup />,
    detailIntro: "Het reviewsysteem structureert reputatiemanagement met een duidelijke split tussen interne kwaliteitsfeedback en publieke reviewgroei.",
    detailSteps: [
      "Verzamel score en korte feedback na oplevering.",
      "Route lage scores intern voor snelle opvolging.",
      "Route hoge scores naar publieke reviewplatforms.",
      "Volg status en impact op reputatie per account op.",
    ],
    detailImpact: ["Hogere reviewscore op publieke platformen.", "Snellere correctie van kwaliteitsissues.", "Meer geloofwaardigheid in nieuwe salesgesprekken."],
  },
];

export function getSolutionModuleBySlug(slug: string) {
  return SOLUTION_MODULES.find((module) => module.slug === slug);
}

/* ─── MAIN ─── */
export function MarketingPage({ page }: { page: PageKey }) {
  useReveal();
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7f8f6] pt-16 text-[#0d1520]">
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

/* ══════════════════════════════════════════════
   HEADER
══════════════════════════════════════════════ */
function MarketingHeader({ activePage }: { activePage: PageKey }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const pageHrefs: Record<PageKey, string> = {
    home: "/", product: "/product", solutions: "/oplossingen",
    about: "/over-ons", contact: "/contact",
  };

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? "border-b border-[#e2e8e3] bg-white/95 shadow-[0_1px_20px_rgba(13,21,32,0.06)] backdrop-blur-xl" : "border-b border-[#e9ece9]/80 bg-white/90 backdrop-blur-xl"}`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 animate-fade-in">
          <span className="flex h-9 w-9 items-center justify-center">
            <Image src="/favicon.ico" alt="Digitify" width={36} height={36} className="rounded-xl" priority />
          </span>
          <span className="leading-tight">
            <span className="block text-[13px] font-extrabold tracking-tight text-[#0d1520]">Digitify</span>
            <span className="block text-[11px] font-semibold text-[#f9ae5a]">Lead Finder</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex">
          {navItems.map((item) => {
            const isActive = pageHrefs[activePage] === item.href;
            if (item.href === "/oplossingen") {
              return (
                <div key={item.href} className="group relative">
                  <Link
                    href={item.href}
                    className={`relative inline-flex items-center gap-1 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all duration-200 ${isActive ? "text-[#f9ae5a]" : "text-[#4a5568] hover:text-[#0d1520]"}`}
                  >
                    {item.label}
                    <ChevronDown className="h-3.5 w-3.5" />
                    {isActive && <span className="absolute bottom-1 left-3.5 right-3.5 h-0.5 rounded-full bg-[#f9ae5a]" />}
                  </Link>
                  <div className="invisible absolute left-0 top-[calc(100%+8px)] z-30 w-[270px] translate-y-2 rounded-xl border border-[#e2e8e3] bg-white p-2 opacity-0 shadow-[0_14px_34px_rgba(13,21,32,0.12)] transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                    {SOLUTION_MODULES.map((module) => (
                      <Link
                        key={module.slug}
                        href={`/oplossingen/${module.slug}`}
                        className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-semibold text-[#4a5568] transition hover:bg-[#fff8ee] hover:text-[#b66d1e]"
                      >
                        <module.icon className="h-3.5 w-3.5 text-[#f9ae5a]" />
                        {module.label}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            }
            return (
              <Link key={item.href} href={item.href}
                className={`relative rounded-lg px-3.5 py-2 text-sm font-semibold transition-all duration-200 ${isActive ? "text-[#f9ae5a]" : "text-[#4a5568] hover:text-[#0d1520]"}`}>
                {item.label}
                {isActive && <span className="absolute bottom-1 left-3.5 right-3.5 h-0.5 rounded-full bg-[#f9ae5a]" />}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/login" className="hidden h-9 items-center rounded-lg border border-[#dde3e8] bg-white px-4 text-sm font-semibold text-[#344052] shadow-sm transition hover:border-[#f9ae5a]/50 hover:text-[#f9ae5a] sm:inline-flex">
            Login
          </Link>
          <Link href="/register" className="inline-flex h-9 items-center rounded-lg bg-[#f9ae5a] px-4 text-sm font-bold text-[#14100b] shadow-[0_4px_16px_rgba(249,174,90,0.45)] transition hover:bg-[#eca04e] hover:shadow-[0_6px_20px_rgba(249,174,90,0.6)]">
            Aanmelden
          </Link>
          <button className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg border border-[#dde3e8] md:hidden" onClick={() => setOpen(!open)}>
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-[#e2e8e3] bg-white px-5 pb-5 md:hidden animate-fade-in">
          <nav className="mt-4 space-y-1">
            {navItems.map((item) => {
              if (item.href === "/oplossingen") {
                return (
                  <div key={item.href} className="rounded-lg border border-[#edf1ee] bg-[#fbfcfb]">
                    <button
                      type="button"
                      onClick={() => setSolutionsOpen((value) => !value)}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-[#344052]"
                    >
                      <span>{item.label}</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${solutionsOpen ? "rotate-180" : ""}`} />
                    </button>
                    {solutionsOpen && (
                      <div className="space-y-1 pb-2">
                        <Link href="/oplossingen" onClick={() => setOpen(false)} className="mx-1.5 block rounded-md px-2.5 py-2 text-sm font-semibold text-[#4a5568] hover:bg-[#fff8ee] hover:text-[#b66d1e]">
                          Overzicht Oplossingen
                        </Link>
                        {SOLUTION_MODULES.map((module) => (
                          <Link
                            key={module.slug}
                            href={`/oplossingen/${module.slug}`}
                            onClick={() => setOpen(false)}
                            className="mx-1.5 flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-semibold text-[#4a5568] hover:bg-[#fff8ee] hover:text-[#b66d1e]"
                          >
                            <module.icon className="h-3.5 w-3.5 text-[#f9ae5a]" />
                            {module.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-[#344052] hover:bg-[#fff8ee] hover:text-[#f9ae5a]">
                  {item.label}
                </Link>
              );
            })}
            <Link href="/login" onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-[#344052] hover:bg-[#f7f8f6]">
              Login
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

/* ══════════════════════════════════════════════
   HOME
══════════════════════════════════════════════ */
function HomePage() {
  return (
    <>
      {/* HERO */}
      <section className="relative min-h-[90vh] overflow-hidden border-b border-[#e2e8e3]">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#fffdf9] via-[#faf7f2] to-[#f0ede7]" />
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-40 -top-40 h-[700px] w-[700px] rounded-full bg-[#f9ae5a]/10 blur-[120px]" />
          <div className="absolute -right-20 top-10 h-[500px] w-[500px] rounded-full bg-[#f9ae5a]/6 blur-[100px]" />
        </div>

        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:py-28">
          <div>
            <div className="animate-fade-in mb-6 inline-flex items-center gap-2 rounded-full border border-[#f9ae5a]/30 bg-[#f9ae5a]/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[#b66d1e]">
              <Image src="/favicon.ico" alt="" width={14} height={14} className="rounded-sm" />
              Digitify Lead Finder · Made in Belgium
            </div>

            <h1 className="animate-fade-in delay-100 text-[2.75rem] font-extrabold leading-[1.05] tracking-tight text-[#0d1520] sm:text-5xl lg:text-[3.5rem]">
              Van lead naar klant,{" "}
              <span className="gradient-text">zonder ruis.</span>
            </h1>

            <p className="animate-fade-in delay-200 mt-6 max-w-md text-base leading-7 text-[#4d5b6b]">
              Vind betere leads, scoreer commerciële fit en zet elke kans om naar outreach, offerte, booking of review — vanuit één werkplek.
            </p>

            <div className="animate-fade-in delay-300 mt-8 flex flex-wrap gap-3">
              <Link href="/register"
                className="group inline-flex h-11 items-center rounded-xl bg-[#f9ae5a] px-7 text-sm font-bold text-[#14100b] shadow-[0_6px_24px_rgba(249,174,90,0.5)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#eca04e] hover:shadow-[0_10px_32px_rgba(249,174,90,0.6)]">
                Gratis aanmelden
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link href="/product"
                className="group inline-flex h-11 items-center rounded-xl border border-[#cfd8d2] bg-white px-7 text-sm font-semibold text-[#172131] shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#f9ae5a]/40 hover:shadow-md">
                Ontdek het product
                <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            <div className="animate-fade-in delay-400 mt-8 flex flex-wrap gap-4">
              {[
                "Lead Search",
                "Outreach met AI",
                "Rapporten",
                "White-labelbaar",
                "Offerte configurator",
                "Booking agenda",
                "Chatbot widget",
                "Reviewsysteem",
              ].map((t) => (
                <div key={t} className="flex items-center gap-1.5 text-xs font-medium text-[#5a6878]">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#12a66a]" />
                  {t}
                </div>
              ))}
            </div>
          </div>

          <div className="animate-slide-right delay-200">
            <div className="animate-pulse-glow rounded-2xl">
              <HomeHeroModuleTabs />
            </div>
          </div>
        </div>

        <div className="relative border-t border-[#e2e8e3]/60 bg-white/40 py-3.5 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-5 px-5 sm:justify-between sm:px-8">
            {[
              "Lead Search",
              "Outreach met AI",
              "Rapporten",
              "White-labelbaar",
              "Offerte configurator",
              "Booking agenda",
              "Chatbot widget",
              "Reviewsysteem",
            ].map((t) => (
              <div key={t} className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#7a8898]">
                <span className="h-1 w-4 rounded-full bg-[#f9ae5a]" />
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="bg-white py-14">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            {[
              { n: 8,   s: "+", label: "Geïntegreerde modules" },
              { n: 100, s: "%", label: "Belgisch product" },
              { n: 6,   s: "+", label: "Groeiflows" },
              { n: 0,   s: "",  label: "Losse tools nodig" },
            ].map(({ n, s, label }) => (
              <div key={label} className="reveal text-center">
                <div className="text-3xl font-extrabold text-[#0d1520]">
                  <AnimatedNumber target={n} suffix={s} />
                </div>
                <div className="mt-1.5 text-sm text-[#6a7684]">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="bg-[#f7f8f6] py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="reveal mx-auto max-w-xl text-center">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#f9ae5a]">Alles in één app</p>
            <h2 className="mt-3 text-3xl font-extrabold leading-tight text-[#0d1520] sm:text-4xl">
              Een <span className="gradient-text">command center</span> voor commerciële groei.
            </h2>
            <p className="mt-4 text-base leading-7 text-[#5a6878]">
              Lead Finder vervangt losse tools, spreadsheets en copy-paste workflows door één heldere hub.
            </p>
          </div>

          <div className="mt-12 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Search,        title: "Lead Search",          copy: "Vind snel lokale kansen met directe kwalificatie.", color: "#3b82f6" },
              { icon: MailCheck,     title: "Outreach met AI",      copy: "Genereer en verstuur outreach in je eigen tone of voice.", color: "#f9ae5a" },
              { icon: BarChart3,     title: "Rapporten",            copy: "Toon score, status en actiepunten in duidelijke rapporten.", color: "#8b5cf6" },
              { icon: ShieldCheck,   title: "White-labelbaar",      copy: "Laat alles lopen in jouw branding, van app tot widgets.", color: "#10b981" },
              { icon: FileText,      title: "Offerte configurator", copy: "Bouw live offertes met prijzen, opties en directe opvolging.", color: "#e85d3a" },
              { icon: CalendarCheck, title: "Booking agenda",       copy: "Laat bezoekers meteen een vrij slot boeken zonder overlap.", color: "#f59e0b" },
              { icon: Bot,           title: "Chatbot widget",       copy: "Kwalificeer gesprekken automatisch en stuur door naar pipeline.", color: "#06b6d4" },
              { icon: Star,          title: "Reviewsysteem",        copy: "Zet feedback slim om naar publieke reviewgroei.", color: "#ec4899" },
            ].map(({ icon: Icon, title, copy, color }, i) => (
              <article key={title} className="reveal group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[#e2e8e3] bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_16px_40px_rgba(13,21,32,0.1)]" data-delay={String(i * 50)}>
                <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: `radial-gradient(circle at top left, ${color}10, transparent 60%)` }} />
                <div className="relative flex h-full flex-col">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: `${color}18` }}>
                    <Icon className="h-5 w-5" style={{ color }} />
                  </div>
                  <h3 className="mt-4 text-[15px] font-bold text-[#0d1520]">{title}</h3>
                  <p className="mt-1.5 flex-1 text-sm leading-6 text-[#5a6878]">{copy}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="relative overflow-hidden bg-[#fffbf5] py-24">
        <div className="pointer-events-none absolute right-0 top-0 h-[400px] w-[400px] rounded-full bg-[#f9ae5a]/8 blur-[100px]" />
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
            <div className="reveal-left">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#b66d1e]">Hoe het werkt</p>
              <h2 className="mt-3 text-3xl font-extrabold leading-tight text-[#0d1520] sm:text-4xl">
                Van zoekopdracht naar opvolging <span className="gradient-text">in minuten.</span>
              </h2>
              <p className="mt-4 text-base leading-7 text-[#5a6878]">
                Geen complexe onboarding. Zoek een niche, laat de app kansen scoren en stuur de beste leads direct naar je pipeline.
              </p>
              <div className="mt-8 space-y-4">
                {[
                  { n: "1", t: "Zoek & verrijk",          c: "Kies regio, sector of type bedrijf. De app verzamelt prospects automatisch." },
                  { n: "2", t: "Scoreer commerciële fit",  c: "Elke lead krijgt een score op website, SEO, reviews en social." },
                  { n: "3", t: "Actie & conversie",        c: "Start outreach, maak een offerte of plan een demo vanuit dezelfde kaart." },
                  { n: "4", t: "Meet je resultaten",       c: "Dashboard met pipeline, campagnes, bookings en groeikansen." },
                ].map(({ n, t, c }, i) => (
                  <div key={t} className="reveal flex gap-4" data-delay={String(i * 70)}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f9ae5a] text-sm font-extrabold text-[#14100b] shadow-[0_4px_10px_rgba(249,174,90,0.4)]">{n}</span>
                    <div>
                      <p className="text-[15px] font-bold text-[#0d1520]">{t}</p>
                      <p className="mt-0.5 text-sm leading-6 text-[#5a6878]">{c}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/register" className="group mt-8 inline-flex h-11 items-center rounded-xl bg-[#0d1520] px-6 text-sm font-bold text-white transition-all hover:bg-[#1a2535] hover:shadow-lg">
                Start vandaag
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
            <div className="reveal-right grid grid-cols-2 gap-3.5">
              {[
                { icon: TrendingUp,  label: "Pipeline waarde",  value: "€ 84.200", sub: "Dit kwartaal",         color: "#f9ae5a" },
                { icon: CheckCircle2,label: "Leads opgevolgd",  value: "147",       sub: "Actief in pipeline",   color: "#12a66a" },
                { icon: Clock,       label: "Tijdsbesparing",   value: "~8u",       sub: "Per week vs losse tools",color: "#3b82f6" },
                { icon: Award,       label: "Gem. lead score",  value: "76/100",    sub: "Commerciële fit",      color: "#8b5cf6" },
              ].map(({ icon: Icon, label, value, sub, color }) => (
                <div key={label} className="group rounded-2xl border border-[#edd5bb] bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(13,21,32,0.08)]">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}18` }}>
                    <Icon className="h-4 w-4" style={{ color }} />
                  </div>
                  <p className="mt-3.5 text-[11px] font-semibold uppercase tracking-wider text-[#9aafbe]">{label}</p>
                  <p className="mt-1 text-xl font-extrabold text-[#0d1520]">{value}</p>
                  <p className="mt-0.5 text-xs text-[#b8c3cf]">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* DARK WHY */}
      <section className="relative overflow-hidden bg-[#0d1520] py-24 text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-40 top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full bg-[#f9ae5a]/5 blur-[120px]" />
          <div className="absolute -right-40 top-0 h-[400px] w-[400px] rounded-full bg-[#f9ae5a]/4 blur-[100px]" />
        </div>
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-7 lg:grid-cols-[1fr_1.35fr] lg:items-start">
            <div className="reveal rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_18px_44px_rgba(0,0,0,0.2)]">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#f9ae5a]">Waarom het werkt</p>
              <h2 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">
                Van commerciële intentie naar opvolging die blijft bewegen.
              </h2>
              <p className="mt-4 text-sm leading-7 text-[#b8c3cf]">
                Lead Finder verbindt prioritering, kwaliteit en uitvoering in één ritme zodat je team minder schakelt en sneller converteert.
              </p>
              <Link href="/product" className="group mt-6 inline-flex items-center text-sm font-bold text-[#f9ae5a] transition hover:text-[#eca04e]">
                Bekijk alle functies <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
            <div className="grid gap-3.5 sm:grid-cols-2">
              {[
                { icon: Target, title: "Prioriteit", copy: "Scores en statussen zetten de juiste leads bovenaan." },
                { icon: ShieldCheck, title: "Consistentie", copy: "Templates en goedkeuringen houden je merk strak." },
                { icon: TrendingUp, title: "Conversie", copy: "Offertes en bookings zitten dicht bij de leadcontext." },
                { icon: BarChart3, title: "Inzicht", copy: "Rapporten tonen waar groei ontstaat en waar het hapert." },
              ].map(({ icon: Icon, title, copy }, i) => (
                <div key={title} className="reveal flex h-full flex-col rounded-2xl border border-white/8 bg-white/[0.04] p-5 backdrop-blur-sm transition-all hover:bg-white/[0.08]" data-delay={String(i * 70)}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f9ae5a]/15">
                    <Icon className="h-5 w-5 text-[#f9ae5a]" />
                  </div>
                  <h3 className="mt-4 text-[15px] font-bold">{title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-6 text-[#b8c3cf]">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-[#fffbf5] py-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_50%_100%,rgba(249,174,90,0.12),transparent)]" />
        <div className="relative reveal mx-auto max-w-2xl px-5 text-center sm:px-8">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#f9ae5a]">Klaar om te starten?</p>
          <h2 className="mt-3 text-3xl font-extrabold leading-tight text-[#0d1520] sm:text-4xl">
            Bekijk hoe Lead Finder in jouw proces past.
          </h2>
          <p className="mt-4 text-base leading-7 text-[#5a6878]">
            We bekijken je huidige prospectieflow, tonen de app en bepalen welke modules meteen waarde leveren.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/register" className="group inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#f9ae5a] px-9 text-sm font-bold text-[#14100b] shadow-[0_6px_24px_rgba(249,174,90,0.5)] transition-all hover:-translate-y-0.5 hover:bg-[#eca04e] sm:w-auto">
              Gratis aanmelden <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/login" className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-[#cfd8d2] bg-white px-9 text-sm font-semibold text-[#172131] shadow-sm transition hover:border-[#9fb4c8] sm:w-auto">
              Login
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

/* ══════════════════════════════════════════════
   PRODUCT PAGE — lichte hero met app UI
══════════════════════════════════════════════ */
function ProductPage() {
  const modules = [
    { slug: "lead-search" as SolutionSlug, icon: Search, title: "Lead Search", color: "#3b82f6", summary: "Lokale prospectie met directe kwalificatie.", features: ["Zoek op regio, niche of bedrijfstype", "Automatische verrijking van bedrijfsdata", "Lead fit score direct in de lijst", "Snelle doorstroom naar pipeline"] },
    { slug: "outreach-ai" as SolutionSlug, icon: MailCheck, title: "Outreach met AI", color: "#f9ae5a", summary: "Sneller outreach schrijven en versturen.", features: ["AI-drafts per segment en intentie", "Goedkeuringsflow voor teams", "Verzenden in eigen merkidentiteit", "Opvolging vanuit één workflow"] },
    { slug: "rapporten" as SolutionSlug, icon: BarChart3, title: "Rapporten", color: "#8b5cf6", summary: "Inzicht in score, status en progressie.", features: ["Lead score in elk rapport", "Pipeline-overzicht met prioriteiten", "White-label presentatieflow", "Heldere export voor klantupdates"] },
    { slug: "white-label" as SolutionSlug, icon: ShieldCheck, title: "White-labelbaar", color: "#10b981", summary: "Volledig in jouw branding.", features: ["Eigen kleuren, logo en stijl", "Consistent in app en embeds", "Merkidentiteit per account", "Uniforme ervaring voor klanten"] },
    { slug: "offerte-configurator" as SolutionSlug, icon: FileText, title: "Offerte configurator", color: "#e85d3a", summary: "Van selectie naar offerte in één flow.", features: ["Stap-voor-stap configuratie", "Live prijsopbouw inclusief btw", "Aanvragen direct in je offerteflow", "Snellere opvolging na aanvraag"] },
    { slug: "booking-agenda" as SolutionSlug, icon: CalendarCheck, title: "Booking agenda", color: "#f59e0b", summary: "Realtime planning op je website.", features: ["Beschikbaarheid per dag en slot", "Conflictcheck op bestaande afspraken", "Automatische bevestigingen", "Google Calendar synchronisatie"] },
    { slug: "chatbot-widget" as SolutionSlug, icon: Bot, title: "Chatbot widget", color: "#06b6d4", summary: "Directe antwoorden en leadkwalificatie.", features: ["Intentdetectie voor sales en support", "Context op basis van accountinstellingen", "Gesprekken direct in opvolging", "Altijd in je eigen branding"] },
    { slug: "reviewsysteem" as SolutionSlug, icon: Star, title: "Reviewsysteem", color: "#ec4899", summary: "Feedback structureren en reputatie verhogen.", features: ["Split-flow op basis van score", "Interne opvolging bij lage scores", "Doorsturen naar publieke platformen", "Statustracking per review"] },
  ];

  return (
    <>
      {/* LICHTE HERO — zelfde sfeer als home */}
      <section className="relative overflow-hidden border-b border-[#e2e8e3]">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#fffdf9] via-[#faf7f2] to-[#f0ede7]" />
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-[#f9ae5a]/10 blur-[120px]" />
          <div className="absolute right-0 top-0 h-[400px] w-[400px] rounded-full bg-[#f9ae5a]/6 blur-[80px]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-5 sm:px-8 pt-20 pb-0">
          <div className="mx-auto max-w-2xl text-center animate-fade-in">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#f9ae5a]/30 bg-[#f9ae5a]/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[#b66d1e]">
              <Image src="/favicon.ico" alt="" width={14} height={14} className="rounded-sm" />
              Product overzicht
            </div>
            <h1 className="text-[2.6rem] font-extrabold leading-tight text-[#0d1520] sm:text-5xl">
              Alles in één <span className="gradient-text">commerciële hub.</span>
            </h1>
            <p className="mt-5 text-base leading-7 text-[#4d5b6b]">
              Digitify Lead Finder brengt prospectie, communicatie en conversie samen. Je ziet waar elke lead staat, welke actie nodig is en hoe snel je team vooruitgaat.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link href="/register" className="group inline-flex h-11 items-center rounded-xl bg-[#f9ae5a] px-7 text-sm font-bold text-[#14100b] shadow-[0_6px_24px_rgba(249,174,90,0.5)] transition-all hover:-translate-y-0.5 hover:bg-[#eca04e]">
                Gratis aanmelden <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link href="/contact" className="inline-flex h-11 items-center rounded-xl border border-[#cfd8d2] bg-white px-7 text-sm font-semibold text-[#172131] shadow-sm transition hover:border-[#f9ae5a]/40">
                Plan een demo
              </Link>
            </div>
          </div>

          {/* App UI preview */}
          <div className="relative mt-14 animate-fade-in delay-300">
            <div className="overflow-hidden rounded-t-2xl border border-b-0 border-[#dde3e8] bg-[#0d1520] shadow-[0_-8px_40px_rgba(13,21,32,0.15)]">
              {/* Window bar */}
              <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
                <span className="h-3 w-3 rounded-full bg-[#28c840]" />
                <div className="ml-4 flex-1 rounded-md bg-white/[0.06] px-3 py-1 text-xs text-[#b8c3cf]">
                  leads.digitify.be/app/leads
                </div>
              </div>
              <div className="flex h-[340px]">
                {/* Sidebar */}
                <div className="hidden w-48 shrink-0 border-r border-white/8 bg-[#0a1018] p-3 sm:block">
                  <div className="mb-3 flex items-center gap-2 px-2">
                    <Image src="/favicon.ico" alt="" width={20} height={20} className="rounded-md" />
                    <span className="text-xs font-bold text-white">Lead Finder</span>
                  </div>
                  {[
                    { icon: Layers3,  label: "Dashboard",  active: false },
                    { icon: Search,   label: "Leads",      active: true  },
                    { icon: MailCheck,label: "Outreach",   active: false },
                    { icon: FileText, label: "Offertes",   active: false },
                    { icon: CalendarCheck, label: "Bookings", active: false },
                    { icon: Star,     label: "Reviews",    active: false },
                    { icon: Bot,      label: "Chatbot",    active: false },
                    { icon: BarChart3,label: "Rapporten",  active: false },
                  ].map(({ icon: Icon, label, active }) => (
                    <div key={label} className={`mb-0.5 flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold ${active ? "bg-[#f9ae5a]/15 text-[#f9ae5a]" : "text-[#8a9ab0] hover:text-white"}`}>
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {label}
                    </div>
                  ))}
                </div>

                {/* Main content */}
                <div className="flex-1 overflow-hidden bg-[#f9fbfa] p-4">
                  {/* Toolbar */}
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-bold text-[#0d1520]">Leads <span className="ml-1 rounded-md bg-[#f0f4f1] px-1.5 py-0.5 text-xs font-semibold text-[#5a6878]">247</span></div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 rounded-lg border border-[#dde3e8] bg-white px-2.5 py-1.5 text-xs text-[#5a6878]">
                        <Filter className="h-3 w-3" /> Filter
                      </div>
                      <div className="rounded-lg bg-[#f9ae5a] px-3 py-1.5 text-xs font-bold text-[#14100b]">+ Lead toevoegen</div>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-hidden rounded-xl border border-[#e2e8e3] bg-white shadow-sm">
                    <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 border-b border-[#f0f4f1] bg-[#f9fbfa] px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#9aafbe]">
                      <div>Bedrijf</div>
                      <div>Score</div>
                      <div>Status</div>
                      <div>Actie</div>
                    </div>
                    {[
                      { name: "Luma Dental",   score: 92, status: "Offerte klaar", statusColor: "bg-[#eaf6f0] text-[#0b8354]", action: "Bekijk" },
                      { name: "Atelier Noord", score: 84, status: "Demo gepland",  statusColor: "bg-[#eef4ff] text-[#1d4ed8]", action: "Opvolgen" },
                      { name: "Vesta Solar",   score: 78, status: "In outreach",   statusColor: "bg-[#fff8ee] text-[#b66d1e]", action: "E-mail" },
                      { name: "Studio Mars",   score: 71, status: "Nieuw",         statusColor: "bg-[#f7f8f6] text-[#5a6878]", action: "Scoren" },
                      { name: "Apex Design",   score: 65, status: "Nieuw",         statusColor: "bg-[#f7f8f6] text-[#5a6878]", action: "Scoren" },
                    ].map(({ name, score, status, statusColor, action }) => (
                      <div key={name} className="grid grid-cols-[2fr_1fr_1fr_1fr] items-center gap-2 border-b border-[#f7f8f6] px-4 py-2.5 text-xs last:border-0 hover:bg-[#fafcfa]">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#f9ae5a]/15 text-[10px] font-bold text-[#b66d1e]">
                            {name[0]}
                          </div>
                          <span className="font-semibold text-[#0d1520]">{name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-12 overflow-hidden rounded-full bg-[#e6ebe7]">
                            <div className="h-full rounded-full bg-[#f9ae5a]" style={{ width: `${score}%` }} />
                          </div>
                          <span className="font-bold text-[#0d1520]">{score}</span>
                        </div>
                        <div><span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${statusColor}`}>{status}</span></div>
                        <div><button className="rounded-md border border-[#e2e8e3] bg-white px-2 py-1 text-[10px] font-semibold text-[#344052] hover:border-[#f9ae5a]/40">{action}</button></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-b border-[#e2e8e3] bg-white py-10">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            {[
              { v: "8",    l: "Geïntegreerde modules" },
              { v: "1",    l: "Werkplek voor je team" },
              { v: "100%", l: "Belgisch product" },
              { v: "0",    l: "Losse tools nodig" },
            ].map(({ v, l }) => (
              <div key={l} className="reveal text-center">
                <div className="text-2xl font-extrabold text-[#f9ae5a]">{v}</div>
                <div className="mt-1 text-xs text-[#6a7684]">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MODULES */}
      <section className="bg-[#f7f8f6] py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="reveal mx-auto max-w-xl text-center">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#f9ae5a]">Modules</p>
            <h2 className="mt-3 text-3xl font-extrabold text-[#0d1520] sm:text-4xl">
              Acht krachtige modules, <span className="gradient-text">één coherente flow.</span>
            </h2>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {modules.map(({ slug, icon: Icon, title, color, summary, features }, i) => (
              <article key={title} className="reveal group flex h-full flex-col overflow-hidden rounded-2xl border border-[#e2e8e3] bg-white shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_16px_40px_rgba(13,21,32,0.1)]" data-delay={String(i * 45)}>
                <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${color}, #f9ae5a)` }} />
                <div className="p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}18` }}>
                  <Icon className="h-5 w-5" style={{ color }} />
                </div>
                <h3 className="mt-4 text-[15px] font-extrabold text-[#0d1520]">{title}</h3>
                <p className="mt-0.5 text-xs text-[#6a7684]">{summary}</p>
                <ul className="mt-4 flex-1 space-y-2">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-[#344052]">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#12a66a]" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={`/oplossingen/${slug}`} className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#b66d1e] transition hover:text-[#8d5110]">
                  Lees meer
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* PIPELINE PREVIEW */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="reveal-left">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#f9ae5a]">Geïntegreerde workflow</p>
              <h2 className="mt-3 text-3xl font-extrabold leading-tight text-[#0d1520] sm:text-4xl">
                Alle modules werken samen als <span className="gradient-text">één systeem.</span>
              </h2>
              <p className="mt-4 text-base leading-7 text-[#5a6878]">
                Een lead die je vindt in discovery gaat naadloos door scoring, outreach, offerte, booking en reviews — zonder context te verliezen.
              </p>
              <div className="relative mt-7 space-y-3 before:absolute before:bottom-3 before:left-[11px] before:top-3 before:w-px before:bg-[#f2d7b2]">
                {[
                  { from: "Lead discovery", to: "Lead scoring",     c: "Verrijkte leads krijgen automatisch een score." },
                  { from: "Lead scoring",   to: "Outreach",         c: "Top-scored leads gaan meteen in je campagne." },
                  { from: "Outreach",       to: "Offerte & booking",c: "Converteer geïnteresseerde leads in één klik." },
                  { from: "Offerte",        to: "Review flow",      c: "Bouw aan je reputatie na elke deal." },
                ].map(({ from, to, c }, i) => (
                  <div key={from} className="reveal relative flex items-start gap-3 rounded-xl border border-[#f0f4f1] bg-[#f9fbfa] p-4" data-delay={String(i * 70)}>
                    <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#f9ae5a] ring-4 ring-[#fff5e8]" />
                    <div>
                      <p className="text-sm font-bold text-[#0d1520]">{from} <ChevronRight className="mx-1 inline h-3.5 w-3.5 text-[#f9ae5a]" /> {to}</p>
                      <p className="mt-0.5 text-sm text-[#5a6878]">{c}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="reveal-right">
              <div className="rounded-2xl border border-[#e2e8e3] bg-[#0d1520] p-5 shadow-[0_20px_60px_rgba(13,21,32,0.18)] sm:p-7">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#f9ae5a]">Live pipeline</p>
                    <p className="text-sm font-extrabold text-white">Lead Finder Suite</p>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold text-[#b8c3cf]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#12a66a]" /> Live
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    { name: "Luma Dental",   score: 92, status: "Offerte verzonden", pct: 90 },
                    { name: "Atelier Noord", score: 84, status: "Demo gepland",      pct: 70 },
                    { name: "Vesta Solar",   score: 78, status: "Review gevraagd",  pct: 55 },
                    { name: "Studio Mars",   score: 71, status: "In outreach",       pct: 40 },
                  ].map(({ name, score, status, pct }) => (
                    <div key={name} className="rounded-xl border border-white/8 bg-white/[0.05] p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white">{name}</span>
                        <span className="rounded-lg bg-[#12a66a]/20 px-2 py-0.5 text-[10px] font-extrabold text-[#12a66a]">{score}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-gradient-to-r from-[#f9ae5a] to-[#eca04e]" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="shrink-0 text-[10px] text-[#b8c3cf]">{status}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2.5">
                  {[
                    { l: "Open offertes", v: "18" },
                    { l: "Chatgesprekken", v: "42" },
                    { l: "Review score", v: "4.8 ⭐" },
                  ].map(({ l, v }) => (
                    <div key={l} className="rounded-xl bg-white/[0.05] p-3 text-center">
                      <div className="text-lg font-extrabold text-[#f9ae5a]">{v}</div>
                      <div className="mt-0.5 text-[9px] text-[#b8c3cf]">{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#fffbf5] py-20">
        <div className="reveal mx-auto max-w-2xl px-5 text-center sm:px-8">
          <h2 className="text-3xl font-extrabold text-[#0d1520]">Klaar om Lead Finder in actie te zien?</h2>
          <p className="mt-4 text-base text-[#5a6878]">Plan een gepersonaliseerde demo en zie hoe alle modules in jouw workflow passen.</p>
          <Link href="/register" className="group mt-8 inline-flex h-11 items-center rounded-xl bg-[#f9ae5a] px-8 text-sm font-bold text-[#14100b] shadow-[0_6px_24px_rgba(249,174,90,0.5)] transition-all hover:bg-[#eca04e]">
            Gratis aanmelden <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </section>
    </>
  );
}

/* ══════════════════════════════════════════════
   SOLUTIONS
══════════════════════════════════════════════ */
function SolutionsPage() {
  const [activePreviewTab, setActivePreviewTab] = useState<SolutionSlug>("lead-search");
  const solutions = [
    { icon: Building2, title: "Voor digitale agencies",     color: "#f9ae5a", tagline: "Beheer prospectie en klantopvolging als een machine.",             intro: "Als agency balanceer je meerdere klanten, prospectiedoelen en rapportage tegelijk. Lead Finder geeft je één hub — per klantmandaat apart.", usecases: [{ t: "White-label ervaring", c: "Klanten zien jouw naam en kleuren." }, { t: "Klant-specifieke rapporten", c: "PDF-rapporten per klant met één klik." }, { t: "Campagnegoedkeuring", c: "E-mails gaan pas uit na goedkeuring." }, { t: "Multi-pipeline", c: "Alle prospects op één scherm." }], results: ["Minder manueel werk per klant", "Professionelere presentatie", "Snellere time-to-first-outreach"] },
    { icon: Users2,    title: "Voor sales teams",           color: "#8b5cf6", tagline: "Minder administratie, meer focus op kansen die converteren.",       intro: "Salesteams verliezen tijd aan handmatige opvolging en losse mails. Lead Finder geeft elk teamlid een duidelijk beeld van hun pipeline.", usecases: [{ t: "Lead scoring & prioriteit", c: "Focus op leads met de hoogste fit." }, { t: "Gedeelde pipeline", c: "Teamleden zien elkaars leads en activiteiten." }, { t: "E-mail opvolging", c: "Templates verkorten de follow-up cyclus." }, { t: "Quota rapportage", c: "Track voortgang per teamlid of periode." }], results: ["Minder gemiste opvolgkansen", "Kortere salescyclus", "Meer omzet per teamlid"] },
    { icon: Globe2,    title: "Voor lokale dienstverleners",color: "#e85d3a", tagline: "Combineer aanvragen, afspraken, reviews en offertes in één flow.", intro: "Lokale bedrijven hebben één platform nodig dat prospectie, bookings en reputatiegroei samenbrengt zonder dure marketingsoftware.", usecases: [{ t: "Booking widget", c: "Klanten boeken rechtstreeks via je website." }, { t: "Offerte aanvragen", c: "Ontvang aanvragen en beantwoord in de app." }, { t: "Review groei", c: "Automatische review-uitnodigingen na opdrachten." }, { t: "AI chatbot op site", c: "Kwalificeert bezoekers 24/7 automatisch." }], results: ["Meer bookings via je website", "Hogere Google-score", "Minder telefonisch contactbeheer"] },
  ];
  const activePreview = SOLUTION_MODULES.find((item) => item.slug === activePreviewTab) ?? SOLUTION_MODULES[0];
  const ActivePreviewIcon = activePreview.icon;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[#e2e8e3]">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#fffdf9] via-[#faf7f2] to-[#f0ede7]" />
        <div className="pointer-events-none absolute -right-20 -top-20 h-[500px] w-[500px] rounded-full bg-[#f9ae5a]/8 blur-[100px]" />
        <div className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-2xl text-center animate-fade-in">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#f9ae5a]/30 bg-[#f9ae5a]/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[#b66d1e]">
              <Lightbulb className="h-3 w-3" />
              Oplossingen op maat
            </div>
            <h1 className="text-[2.6rem] font-extrabold leading-tight text-[#0d1520] sm:text-5xl">
              Groei-workflows voor teams die geen tijd <span className="gradient-text">willen verliezen.</span>
            </h1>
            <p className="mt-5 text-base leading-7 text-[#4d5b6b]">
              Alles is white-labelbaar: van lead search en outreach tot offertes, bookings, chatbot en rapportering met lead score — volledig in jouw branding.
            </p>
            <Link href="/register" className="group mt-8 inline-flex h-11 items-center rounded-xl bg-[#f9ae5a] px-7 text-sm font-bold text-[#14100b] shadow-[0_6px_24px_rgba(249,174,90,0.5)] transition-all hover:bg-[#eca04e]">
              Gratis aanmelden <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* Premium tabbed previews */}
      <section className="bg-[#f7f8f6] py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="reveal mx-auto max-w-3xl text-center">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#f9ae5a]">Premium product previews</p>
            <h2 className="mt-3 text-3xl font-extrabold leading-tight text-[#0d1520] sm:text-4xl">
              8 tabflows, telkens één complete module in beeld.
            </h2>
            <p className="mt-4 text-base leading-7 text-[#5a6878]">
              Open per tab de echte gebruikersflow: links de context en voordelen, rechts de live UI-mockup zoals je team die in de app gebruikt.
            </p>
          </div>

          <article className="reveal mt-10 overflow-hidden rounded-2xl border border-[#e2e8e3] bg-white shadow-sm">
            <div className="border-b border-[#eef2ee] bg-[#f9fbfa] px-5 py-4 sm:px-7">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#b66d1e]">Letterlijke UI mockups + groeiflows</p>
            </div>
            <div className="p-5 sm:p-7">
              <div className="rounded-xl border border-[#e2e8e3] bg-white p-1">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {SOLUTION_MODULES.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = tab.slug === activePreviewTab;
                    return (
                      <button
                        key={tab.slug}
                        type="button"
                        onClick={() => setActivePreviewTab(tab.slug)}
                        className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-bold transition-colors ${
                          isActive
                            ? "bg-[#f9ae5a] text-[#14100b]"
                            : "text-[#5a6878] hover:bg-[#fff8ee] hover:text-[#b66d1e]"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 grid gap-7 rounded-2xl border border-[#e2e8e3] bg-white p-5 shadow-sm lg:grid-cols-[1fr_1.25fr] lg:items-center">
                <div>
                  <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${activePreview.chipClass}`}>
                    <ActivePreviewIcon className="h-3 w-3" />
                    {activePreview.label}
                  </div>
                  <h3 className="mt-4 text-2xl font-extrabold text-[#0d1520]">{activePreview.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#5a6878]">{activePreview.description}</p>
                  <ul className="mt-4 space-y-2.5 text-sm text-[#344052]">
                    {activePreview.bullets.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#12a66a]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href={`/oplossingen/${activePreview.slug}`} className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#b66d1e] transition hover:text-[#8d5110]">
                    Lees meer over {activePreview.label.toLowerCase()}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                {activePreview.mockup}
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* Comparison */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-3xl px-5 sm:px-8">
          <div className="reveal text-center">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#f9ae5a]">Vergelijking</p>
            <h2 className="mt-2 text-2xl font-extrabold text-[#0d1520]">Lead Finder vs. losse tools</h2>
          </div>
          <div className="reveal mt-8 overflow-hidden rounded-2xl border border-[#e2e8e3]">
            <div className="grid grid-cols-3 border-b border-[#e2e8e3] bg-[#f9fbfa] px-5 py-3 text-xs font-bold text-[#344052]">
              <div>Functie</div>
              <div className="text-center text-[#f9ae5a]">✦ Lead Finder</div>
              <div className="text-center text-[#9aafbe]">Losse tools</div>
            </div>
            {[
              ["Google Maps lead search", true, false],
              ["AI outreach mails opmaken + versturen", true, "Deels"],
              ["Rapporten met lead score", true, false],
              ["Volledige white-label branding", true, false],
              ["Booking widgets", true, false],
              ["Review management", true, false],
              ["AI chatbot", true, false],
              ["Geïntegreerde pipeline", true, false],
            ].map(([f, o, t]) => (
              <div key={String(f)} className="grid grid-cols-3 border-b border-[#f7f8f6] px-5 py-3.5 text-sm last:border-0 hover:bg-[#fafcfa]">
                <div className="text-[#344052]">{f}</div>
                <div className="text-center">{o === true ? <CheckCircle2 className="mx-auto h-4 w-4 text-[#12a66a]" /> : <span className="text-[#9aafbe]">{o}</span>}</div>
                <div className="text-center text-[#d1d5db]">{t === false ? "✕" : <span className="text-[#9aafbe]">{t}</span>}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cards */}
      <section className="bg-[#f7f8f6] py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="reveal mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#f9ae5a]">Voor wie</p>
            <h2 className="mt-2 text-3xl font-extrabold text-[#0d1520] sm:text-4xl">Kies de oplossing die past bij je team.</h2>
          </div>
          <div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {solutions.map(({ icon: Icon, title, tagline, color, intro, usecases, results }, idx) => (
              <article key={title} className="reveal overflow-hidden rounded-2xl border border-[#e2e8e3] bg-white shadow-sm transition-all hover:shadow-[0_12px_28px_rgba(13,21,32,0.08)]" data-delay={String(idx * 70)}>
                <div className="flex items-center gap-3 border-b border-[#f0f4f1] p-4" style={{ background: `linear-gradient(135deg, ${color}08, transparent)` }}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}18` }}>
                    <Icon className="h-5 w-5" style={{ color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>Oplossing {idx + 1}</p>
                    <h2 className="truncate text-base font-extrabold text-[#0d1520]">{title}</h2>
                    <p className="mt-0.5 text-xs text-[#5a6878]">{tagline}</p>
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  <p className="text-xs leading-6 text-[#4d5b6b]">{intro}</p>
                  <ul className="space-y-1.5">
                    {results.map((r) => (
                      <li key={r} className="flex items-center gap-2 text-xs text-[#344052]">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#12a66a]" />
                        {r}
                      </li>
                    ))}
                  </ul>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {usecases.map(({ t, c }) => (
                      <div key={t} className="rounded-xl border border-[#e8eee8] bg-[#f9fbfa] p-2.5 transition hover:bg-white hover:shadow-sm">
                        <p className="text-xs font-bold text-[#0d1520]">{t}</p>
                        <p className="mt-1 text-[11px] leading-5 text-[#5a6878]">{c}</p>
                      </div>
                    ))}
                  </div>
                  <Link href="/register" className="group inline-flex items-center pt-1 text-xs font-bold transition" style={{ color }}>
                    Aanmelden voor {title.replace("Voor ", "")} <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#0d1520] py-18 text-white">
        <div className="reveal mx-auto max-w-2xl px-5 py-16 text-center sm:px-8">
          <h2 className="text-2xl font-extrabold">Welke oplossing past bij jouw team?</h2>
          <p className="mt-3 text-[#b8c3cf] text-sm">We configureren Lead Finder specifiek voor jouw use case.</p>
          <Link href="/register" className="group mt-7 inline-flex h-11 items-center rounded-xl bg-[#f9ae5a] px-7 text-sm font-bold text-[#14100b] shadow-[0_6px_24px_rgba(249,174,90,0.4)] transition-all hover:bg-[#eca04e]">
            Gratis aanmelden <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </section>
    </>
  );
}

export function SolutionDetailMarketingPage({ slug }: { slug: SolutionSlug }) {
  useReveal();
  const module = getSolutionModuleBySlug(slug) ?? SOLUTION_MODULES[0];
  const ModuleIcon = module.icon;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7f8f6] pt-16 text-[#0d1520]">
      <MarketingHeader activePage="solutions" />

      <section className="relative overflow-hidden border-b border-[#e2e8e3]">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#fffdf9] via-[#faf7f2] to-[#f0ede7]" />
        <div className="pointer-events-none absolute -right-20 -top-20 h-[420px] w-[420px] rounded-full bg-[#f9ae5a]/10 blur-[90px]" />
        <div className="relative mx-auto max-w-7xl px-5 py-16 sm:px-8">
          <div className="reveal">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#f9ae5a]/30 bg-[#f9ae5a]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[#b66d1e]">
              <ModuleIcon className="h-3.5 w-3.5" />
              Oplossing detail
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-tight text-[#0d1520] sm:text-5xl">{module.label}</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-[#4d5b6b]">{module.detailIntro}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/register" className="inline-flex h-10 items-center rounded-xl bg-[#f9ae5a] px-5 text-sm font-bold text-[#14100b] shadow-[0_6px_20px_rgba(249,174,90,0.45)] transition hover:bg-[#eca04e]">
                Start met deze module
              </Link>
              <Link href="/oplossingen" className="inline-flex h-10 items-center rounded-xl border border-[#d5ddd7] bg-white px-5 text-sm font-semibold text-[#344052] transition hover:border-[#f9ae5a]/40 hover:text-[#b66d1e]">
                Terug naar oplossingen
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f7f8f6] py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="reveal grid gap-7 lg:grid-cols-[1fr_1.2fr] lg:items-start">
            <div className="rounded-2xl border border-[#e2e8e3] bg-white p-5 shadow-sm">
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${module.chipClass}`}>
                <ModuleIcon className="h-3 w-3" />
                {module.label}
              </div>
              <h2 className="mt-4 text-2xl font-extrabold text-[#0d1520]">{module.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[#5a6878]">{module.description}</p>
              <ul className="mt-4 space-y-2.5 text-sm text-[#344052]">
                {module.bullets.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#12a66a]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-[#e2e8e3] bg-white p-4 shadow-sm sm:p-5">
              {module.mockup}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-6 lg:grid-cols-2">
            <article className="reveal rounded-2xl border border-[#e2e8e3] bg-[#f9fbfa] p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#f9ae5a]">Werking</p>
              <h3 className="mt-2 text-xl font-extrabold text-[#0d1520]">Van setup tot dagelijkse flow</h3>
              <div className="mt-4 space-y-3">
                {module.detailSteps.map((step, index) => (
                  <div key={step} className="flex items-start gap-3 rounded-xl border border-[#edf1ee] bg-white p-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#f9ae5a] text-[11px] font-extrabold text-[#14100b]">{index + 1}</span>
                    <p className="text-sm text-[#344052]">{step}</p>
                  </div>
                ))}
              </div>
            </article>
            <article className="reveal rounded-2xl border border-[#e2e8e3] bg-[#0d1520] p-5 text-white shadow-[0_14px_40px_rgba(13,21,32,0.18)]">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#f9ae5a]">Impact</p>
              <h3 className="mt-2 text-xl font-extrabold">Wat dit oplevert voor je team</h3>
              <ul className="mt-4 space-y-3">
                {module.detailImpact.map((impact) => (
                  <li key={impact} className="flex items-start gap-2.5 text-sm text-[#c1cad5]">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#f9ae5a]" />
                    {impact}
                  </li>
                ))}
              </ul>
              <Link href="/contact" className="mt-6 inline-flex items-center gap-1 text-sm font-bold text-[#f9ae5a] transition hover:text-[#ffd19a]">
                Plan een demo voor deze flow
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className="bg-[#fffbf5] py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="reveal rounded-2xl border border-[#e7ddd2] bg-white p-5 shadow-sm sm:p-7">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#b66d1e]">Meer modules</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {SOLUTION_MODULES.map((item) => (
                <Link key={item.slug} href={`/oplossingen/${item.slug}`} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  item.slug === module.slug
                    ? "border-[#f9ae5a]/50 bg-[#fff8ee] text-[#b66d1e]"
                    : "border-[#e2e8e3] bg-white text-[#4d5b6b] hover:border-[#f9ae5a]/40 hover:text-[#b66d1e]"
                }`}>
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}

function SolutionsLeadSearchMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#dde5df] bg-[#f9fbfa] shadow-[0_16px_40px_rgba(13,21,32,0.08)]">
      <div className="flex items-center justify-between border-b border-[#e4ebe6] bg-white px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#b66d1e]">Lead Search</p>
          <p className="text-sm font-extrabold text-[#0d1520]">Zoek & kwalificeer in realtime</p>
        </div>
        <span className="rounded-md border border-[#f9ae5a]/40 bg-[#fff8ee] px-2 py-1 text-[10px] font-bold text-[#b66d1e]">Live</span>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-2 rounded-xl border border-[#e4ebe6] bg-white px-3 py-2 text-[11px] text-[#5a6878]">
          <Search className="h-3.5 w-3.5 text-[#b66d1e]" />
          Webdesign Gent
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-[#7a8898]">
            <Filter className="h-3 w-3" />
            Warm/Hot
          </span>
        </div>
        <div className="space-y-2">
          {[
            { name: "Studio Noord", city: "Gent", score: "92 Hot", rating: "4.1" },
            { name: "Pixel Office", city: "Antwerpen", score: "81 Warm", rating: "4.4" },
            { name: "Nova Dental", city: "Brussel", score: "76 Warm", rating: "3.9" },
          ].map((lead) => (
            <div key={lead.name} className="rounded-xl border border-[#e4ebe6] bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-bold text-[#0d1520]">{lead.name}</p>
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-[#6a7684]">
                    <MapPin className="h-3 w-3" />
                    {lead.city}
                    <span className="ml-2 inline-flex items-center gap-1">
                      <Star className="h-3 w-3 fill-[#f9ae5a] text-[#f9ae5a]" />
                      {lead.rating}
                    </span>
                  </p>
                </div>
                <span className="rounded-md bg-[#eef4ff] px-2 py-1 text-[10px] font-bold text-[#1d4ed8]">{lead.score}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SolutionsOutreachMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#dde5df] bg-[#f9fbfa] shadow-[0_16px_40px_rgba(13,21,32,0.08)]">
      <div className="flex items-center justify-between border-b border-[#e4ebe6] bg-white px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#b66d1e]">Outreach met AI</p>
          <p className="text-sm font-extrabold text-[#0d1520]">Concept naar verzonden in minuten</p>
        </div>
        <span className="rounded-md bg-[#0d1520] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">AI</span>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-[#e4ebe6] bg-white p-3">
          <p className="text-[11px] font-bold text-[#0d1520]">AI draft</p>
          <div className="mt-2 space-y-2 text-[10px] text-[#5a6878]">
            <p>Onderwerp: Snelle groeikansen voor {`{bedrijf}`}</p>
            <p>Context: Website + local visibility score: 74</p>
            <p>CTA: Korte call + offerte-inschatting</p>
          </div>
          <div className="mt-3 rounded-lg border border-[#d8ecf1] bg-[#f2fbfd] px-2.5 py-2 text-[10px] text-[#0f7b8f]">
            AI suggestie: personaliseer opening op basis van sector.
          </div>
        </div>
        <div className="space-y-2.5">
          {[
            { label: "Draft", value: "34" },
            { label: "Wacht op goedkeuring", value: "9" },
            { label: "Klaar om te verzenden", value: "12" },
          ].map((row) => (
            <div key={row.label} className="rounded-xl border border-[#e4ebe6] bg-white p-3">
              <p className="text-[10px] uppercase tracking-wide text-[#7a8898]">{row.label}</p>
              <p className="mt-1 text-lg font-extrabold text-[#0d1520]">{row.value}</p>
            </div>
          ))}
          <button className="inline-flex h-8 w-full items-center justify-center gap-1 rounded-lg bg-[#f9ae5a] text-[11px] font-bold text-[#14100b]">
            <Send className="h-3.5 w-3.5" />
            Verstuur campagne
          </button>
        </div>
      </div>
    </div>
  );
}

function SolutionsReportsMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#dde5df] bg-[#f9fbfa] shadow-[0_16px_40px_rgba(13,21,32,0.08)]">
      <div className="flex items-center justify-between border-b border-[#e4ebe6] bg-white px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#b66d1e]">Rapporten</p>
          <p className="text-sm font-extrabold text-[#0d1520]">Focus op impact per pipelinefase</p>
        </div>
        <BarChart3 className="h-4 w-4 text-[#f9ae5a]" />
      </div>
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Gem. score", value: "78" },
            { label: "Hot leads", value: "31" },
            { label: "Win rate", value: "26%" },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-[#e4ebe6] bg-white p-2.5">
              <p className="text-[10px] text-[#7a8898]">{kpi.label}</p>
              <p className="mt-1 text-[13px] font-extrabold text-[#0d1520]">{kpi.value}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-[#e4ebe6] bg-white p-3">
          <p className="text-[11px] font-bold text-[#0d1520]">Lead score per fase</p>
          <div className="mt-2 space-y-2">
            {[
              { phase: "Nieuwe leads", width: "82%" },
              { phase: "Outreach actief", width: "68%" },
              { phase: "Offerte gestuurd", width: "54%" },
            ].map((bar) => (
              <div key={bar.phase}>
                <div className="mb-1 flex items-center justify-between text-[10px] text-[#5a6878]">
                  <span>{bar.phase}</span>
                  <span>{bar.width}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#edf2ee]">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#f9ae5a] to-[#eca04e]" style={{ width: bar.width }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SolutionsWhiteLabelMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#dde5df] bg-[#f9fbfa] shadow-[0_16px_40px_rgba(13,21,32,0.08)]">
      <div className="flex items-center justify-between border-b border-[#e4ebe6] bg-white px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#b66d1e]">White-labelbaar</p>
          <p className="text-sm font-extrabold text-[#0d1520]">Branding studio per account</p>
        </div>
        <Palette className="h-4 w-4 text-[#f9ae5a]" />
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-[1fr_1fr]">
        <div className="rounded-xl border border-[#e4ebe6] bg-white p-3">
          <p className="text-[11px] font-bold text-[#0d1520]">Brand tokens</p>
          <div className="mt-2 flex items-center gap-2">
            {["#f9ae5a", "#0d1520", "#12a66a", "#06b6d4"].map((color) => (
              <div key={color} className="space-y-1 text-center">
                <span className="block h-6 w-6 rounded-md border border-black/10" style={{ backgroundColor: color }} />
                <span className="block text-[9px] text-[#7a8898]">{color}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg border border-[#e4ebe6] bg-[#f9fbfa] px-2.5 py-2 text-[10px] text-[#5a6878]">
            Logo: Digitify Pro · Tone: professioneel en direct
          </div>
        </div>
        <div className="rounded-xl border border-[#e4ebe6] bg-white p-3">
          <p className="text-[11px] font-bold text-[#0d1520]">Waar toegepast</p>
          <div className="mt-2 space-y-2">
            {[
              "Login en register flow",
              "Dashboard, offertes en rapporten",
              "Booking/chatbot/review widgets",
              "PDF exports en e-mail templates",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-md border border-[#edf2ee] bg-[#f9fbfa] px-2.5 py-2 text-[10px] text-[#4f5f70]">
                <ShieldCheck className="h-3.5 w-3.5 text-[#12a66a]" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SolutionsQuoteMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#dde5df] bg-[#f9fbfa] shadow-[0_16px_40px_rgba(13,21,32,0.08)]">
      <div className="flex items-center justify-between border-b border-[#e4ebe6] bg-[#fff8ee] px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#b66d1e]">Offerte Configurator</p>
          <p className="text-sm font-extrabold text-[#0d1520]">Stel uw pakket samen</p>
        </div>
        <span className="rounded-md bg-[#0d1520] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Live</span>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-2.5">
          {["DIENST", "PRODUCT", "SPECIFICATIES", "GEGEVENS"].map((step, index) => (
            <div key={step} className={`rounded-lg border px-3 py-2 text-[11px] font-bold ${index === 1 ? "border-[#f9ae5a]/50 bg-[#fff8ee] text-[#b66d1e]" : "border-[#e4ebe6] bg-white text-[#667381]"}`}>
              Stap {index + 1} · {step}
            </div>
          ))}
          <div className="rounded-lg border border-[#e4ebe6] bg-white p-3">
            <p className="text-[11px] font-bold text-[#0d1520]">Geselecteerd pakket</p>
            <p className="mt-1 text-[11px] text-[#5a6878]">Website Pro + SEO Basis</p>
            <p className="mt-2 text-xs font-extrabold text-[#e85d3a]">€ 2.950 excl. btw</p>
          </div>
        </div>
        <div className="rounded-xl border border-[#e4ebe6] bg-white p-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-bold text-[#0d1520]">Samenvatting</p>
            <span className="text-[10px] font-semibold text-[#7a8898]">Draft #OFF-2026-0041</span>
          </div>
          <div className="space-y-2 text-[11px]">
            {[
              ["Website Pro", "€ 2.150"],
              ["SEO Basis", "€ 650"],
              ["Support", "€ 150"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between text-[#5a6878]">
                <span>{label}</span>
                <span className="font-semibold text-[#0d1520]">{value}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1.5 border-t border-[#eef3ef] pt-2.5 text-[11px]">
            <div className="flex items-center justify-between text-[#5a6878]">
              <span>Subtotaal</span>
              <span className="font-semibold text-[#0d1520]">€ 2.950</span>
            </div>
            <div className="flex items-center justify-between text-[#5a6878]">
              <span>BTW 21%</span>
              <span className="font-semibold text-[#0d1520]">€ 619,50</span>
            </div>
            <div className="flex items-center justify-between text-[#0d1520]">
              <span className="font-bold">Totaal</span>
              <span className="font-extrabold text-[#e85d3a]">€ 3.569,50</span>
            </div>
          </div>
          <button className="mt-3 h-8 w-full rounded-lg bg-[#f9ae5a] text-[11px] font-bold text-[#14100b]">
            Vraag offerte aan
          </button>
        </div>
      </div>
    </div>
  );
}

function SolutionsBookingMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#dde5df] bg-[#f9fbfa] shadow-[0_16px_40px_rgba(13,21,32,0.08)]">
      <div className="flex items-center justify-between border-b border-[#e4ebe6] bg-white px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#b66d1e]">Booking Agenda</p>
          <p className="text-sm font-extrabold text-[#0d1520]">Plan een afspraak</p>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-[#e4ebe6] bg-[#f9fbfa] px-2 py-1 text-[10px] font-semibold text-[#5a6878]">
          <Clock className="h-3 w-3 text-[#f59e0b]" />
          30 min slots
        </div>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-[1fr_0.95fr]">
        <div className="rounded-xl border border-[#e4ebe6] bg-white p-3">
          <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-[#0d1520]">
            <span>April 2026</span>
            <span className="text-[#7a8898]">Europe/Brussels</span>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-[#7a8898]">
            {["MA", "DI", "WO", "DO", "VR", "ZA", "ZO"].map((day) => (
              <div key={day} className="py-1 font-semibold">{day}</div>
            ))}
            {["21", "22", "23", "24", "25", "26", "27", "28", "29", "30"].map((date) => (
              <div
                key={date}
                className={`rounded-md py-1.5 ${date === "24" ? "bg-[#f59e0b] font-bold text-white" : "bg-[#f6f9f7] text-[#435365]"}`}
              >
                {date}
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"].map((slot, index) => (
              <button
                key={slot}
                className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${index === 1 ? "border-[#f59e0b]/45 bg-[#fff8ee] text-[#b66d1e]" : "border-[#e4ebe6] bg-white text-[#5a6878]"}`}
              >
                {slot}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-[#e4ebe6] bg-white p-3">
          <p className="text-[11px] font-bold text-[#0d1520]">Afspraakdetails</p>
          <div className="mt-2 space-y-2">
            {[
              "Naam: Sarah De Meulemeester",
              "E-mail: sarah@lumadental.be",
              "Datum: vrijdag 24 april",
              "Uur: 09:30",
            ].map((line) => (
              <div key={line} className="rounded-md border border-[#edf2ee] bg-[#f9fbfa] px-2.5 py-2 text-[10px] text-[#4f5f70]">
                {line}
              </div>
            ))}
          </div>
          <button className="mt-3 h-8 w-full rounded-lg bg-[#f59e0b] text-[11px] font-bold text-[#14100b]">
            Afspraak bevestigen
          </button>
        </div>
      </div>
    </div>
  );
}

function SolutionsChatbotMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#dde5df] bg-white shadow-[0_16px_40px_rgba(13,21,32,0.08)]">
      <div className="flex items-center gap-3 bg-[#0d1520] px-4 py-3 text-white">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#06b6d4]/30 text-xs font-bold">D</div>
        <div className="min-w-0">
          <p className="truncate text-xs font-bold uppercase tracking-widest text-[#8fe7f6]">Digitify Assistant</p>
          <p className="truncate text-xs text-white/80">Online · antwoordt binnen enkele seconden</p>
        </div>
      </div>
      <div className="space-y-2.5 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.98),_rgba(244,248,252,1)_55%)] p-4">
        <div className="max-w-[80%] rounded-2xl rounded-bl-md border border-[#e4ebf1] bg-white px-3 py-2 text-[11px] leading-5 text-[#405162]">
          Hallo! Wil je een offerte aanvragen of liever meteen een afspraak plannen?
        </div>
        <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-[#06b6d4] px-3 py-2 text-[11px] leading-5 text-white">
          Graag een offerte voor webdesign + SEO.
        </div>
        <div className="max-w-[80%] rounded-2xl rounded-bl-md border border-[#e4ebf1] bg-white px-3 py-2 text-[11px] leading-5 text-[#405162]">
          Perfect. Dan stuur ik je direct naar de configurator en noteer ik alvast je contactgegevens.
        </div>
        <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-[#d8ecf1] bg-[#f2fbfd] px-3 py-2 text-[10px] text-[#0f7b8f]">
          Intent gedetecteerd: quote_request · Leadscore: warm
        </div>
      </div>
      <div className="border-t border-[#e8eef2] bg-white px-4 py-3">
        <div className="flex items-center gap-2 rounded-xl border border-[#dce4ea] bg-[#f8fafc] px-2.5 py-2 text-[11px] text-[#7a8898]">
          <MessageSquareText className="h-3.5 w-3.5 text-[#7aa8b5]" />
          Type je bericht...
          <ArrowRight className="ml-auto h-3.5 w-3.5 text-[#9eb4bf]" />
        </div>
      </div>
    </div>
  );
}

function SolutionsReviewMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#dde5df] bg-[#fffaf5] shadow-[0_16px_40px_rgba(13,21,32,0.08)]">
      <div className="border-b border-[#f2e4ef] bg-white px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#b93c79]">Review Systeem</p>
        <p className="text-sm font-extrabold text-[#0d1520]">Hoe was uw ervaring?</p>
      </div>
      <div className="space-y-3 p-4">
        <div className="rounded-xl border border-[#f0d6e7] bg-white p-3">
          <p className="text-[11px] font-semibold text-[#4f5f70]">Stap 1 · Kies een score</p>
          <div className="mt-2 flex items-center gap-1.5 text-[#ec4899]">
            {[1, 2, 3, 4, 5].map((star, index) => (
              <Star key={star} className={`h-4 w-4 ${index < 4 ? "fill-current" : ""}`} />
            ))}
          </div>
          <p className="mt-2 text-[10px] text-[#7a8898]">4 of 5 sterren: doorsturen naar publiek platform.</p>
        </div>

        <div className="grid gap-1.5 sm:grid-cols-3">
          {["Google", "Trustpilot", "Facebook"].map((platform, index) => (
            <button
              key={platform}
              className={`rounded-lg border px-2 py-2 text-[10px] font-bold ${index === 0 ? "border-[#ec4899]/40 bg-[#ffeef7] text-[#b93c79]" : "border-[#eadde7] bg-white text-[#5a6878]"}`}
            >
              {platform}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-[#eadde7] bg-white p-3">
          <p className="text-[11px] font-semibold text-[#4f5f70]">Interne feedback bij lage score</p>
          <div className="mt-2 rounded-md border border-[#f2edf1] bg-[#faf8fa] px-2.5 py-2 text-[10px] text-[#7a8898]">
            "Levering mocht sneller, maar service was vriendelijk."
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px]">
            <span className="rounded-md bg-[#f3ecf1] px-2 py-1 font-semibold text-[#7c5d72]">Status: FEEDBACK</span>
            <span className="font-bold text-[#b93c79]">Opslaan & opvolgen</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   ABOUT
══════════════════════════════════════════════ */
function AboutPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-[#e2e8e3]">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#fffdf9] via-[#faf7f2] to-[#f0ede7]" />
        <div className="pointer-events-none absolute -right-20 top-0 h-[400px] w-[400px] rounded-full bg-[#f9ae5a]/8 blur-[100px]" />
        <div className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center animate-fade-in">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#f9ae5a]/30 bg-[#f9ae5a]/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[#b66d1e]">
                <Image src="/favicon.ico" alt="" width={14} height={14} className="rounded-sm" />
                Gemaakt door Digitify · België
              </div>
              <h1 className="text-[2.6rem] font-extrabold leading-tight text-[#0d1520] sm:text-5xl">
                Gebouwd door een team dat groei <span className="gradient-text">praktisch maakt.</span>
              </h1>
              <p className="mt-6 text-base leading-7 text-[#4d5b6b]">
                Digitify bouwt digitale systemen voor ondernemers die meetbare groei willen. Lead Finder is ons antwoord op één concrete vraag: "Hoe haal je meer uit je leads, zonder meer tools?"
              </p>
              <Link href="/register" className="group mt-8 inline-flex h-11 items-center rounded-xl bg-[#f9ae5a] px-7 text-sm font-bold text-[#14100b] shadow-[0_6px_24px_rgba(249,174,90,0.5)] transition-all hover:bg-[#eca04e]">
                Neem contact op <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
            <div className="space-y-3.5">
              {[
                { icon: Award,      t: "Belgisch team",     c: "Opgericht vanuit België, met lokale marktkennis.", color: "#f9ae5a" },
                { icon: Lightbulb,  t: "Praktisch eerst",   c: "Elke feature begint met een vraag van een echte klant.", color: "#f9ae5a" },
                { icon: TrendingUp, t: "Meetbaar resultaat",c: "We bouwen voor teams die groei willen aantonen, niet alleen nastreven.", color: "#f9ae5a" },
              ].map(({ icon: Icon, t, c, color }, i) => (
                <div key={t} className="reveal flex gap-4 rounded-2xl border border-[#e2e8e3] bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md" data-delay={String(i * 70)}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f9ae5a]/12">
                    <Icon className="h-5 w-5 text-[#f9ae5a]" />
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-[#0d1520]">{t}</p>
                    <p className="mt-0.5 text-sm leading-6 text-[#5a6878]">{c}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-14 lg:grid-cols-2">
            <div className="reveal-left">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#f9ae5a]">Ons verhaal</p>
              <h2 className="mt-3 text-3xl font-extrabold leading-tight text-[#0d1520]">
                Waarom we Lead Finder <span className="gradient-text">gebouwd hebben.</span>
              </h2>
              <div className="mt-7 space-y-5 text-sm leading-7 text-[#4d5b6b]">
                <p>Digitify werkt dagelijks met bedrijven die online willen groeien. We bouwden websites, automatiseerden funnels en hielpen teams met digitale strategie. Maar we zagen steeds dezelfde bottleneck: leads vinden was makkelijk, maar opvolgen was chaos.</p>
                <p>Lead Finder is ontstaan uit die frustratie. Één tool die het volledige commerciële pad dekt — van eerste contact tot klant — zonder dat je 5 abonnementen nodig hebt.</p>
                <p>Vandaag is Lead Finder een volledig uitgewerkt platform dat agencies, salesteams en lokale dienstverleners helpt om professioneler en sneller te groeien.</p>
              </div>
              <Link href="https://www.digitify.be" target="_blank" rel="noopener noreferrer" className="group mt-7 inline-flex items-center gap-2 text-sm font-bold text-[#f9ae5a] transition hover:text-[#eca04e]">
                Bezoek www.digitify.be <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="reveal-right space-y-3.5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#f9ae5a]">Onze waarden</p>
              {[
                { icon: Target,      t: "Resultaat boven features",  c: "Elke toevoeging moet een concrete verbetering brengen." },
                { icon: ShieldCheck, t: "Eerlijk en transparant",    c: "Geen verborgen kosten, geen complexe contracten." },
                { icon: Heart,       t: "Gebouwd met zorg",          c: "Elk scherm en elke workflow is doordacht." },
                { icon: TrendingUp,  t: "Groei is meetbaar",         c: "Dashboards en rapporten zodat je resultaten kunt aantonen." },
              ].map(({ icon: Icon, t, c }, i) => (
                <div key={t} className="reveal flex gap-4 rounded-xl border border-[#e8eee8] bg-[#f9fbfa] p-4 transition hover:bg-white hover:shadow-sm" data-delay={String(i * 60)}>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f9ae5a]/12">
                    <Icon className="h-4 w-4 text-[#f9ae5a]" />
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-[#0d1520]">{t}</p>
                    <p className="mt-0.5 text-sm leading-6 text-[#5a6878]">{c}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#0d1520] py-20 text-white">
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            <div className="reveal-left">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#f9ae5a]">Digitify ecosystem</p>
              <h2 className="mt-3 text-3xl font-extrabold leading-tight">
                Lead Finder is deel van <span className="gradient-text">iets groters.</span>
              </h2>
              <p className="mt-4 text-sm leading-7 text-[#b8c3cf]">Naast Lead Finder bouwt Digitify websites, funnels, e-commerce, automatiseringen en digitale strategie.</p>
              <Link href="https://www.digitify.be" target="_blank" rel="noopener noreferrer" className="group mt-7 inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 px-5 text-sm font-bold text-white transition hover:bg-white/10">
                Bezoek digitify.be <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="reveal-right grid grid-cols-2 gap-3">
              {[["Websites","Op maat"],["Funnels","Conversiegericht"],["Automatisering","Tijdbesparend"],["Lead Finder","Dit platform"]].map(([l, s]) => (
                <div key={l} className="rounded-xl border border-white/8 bg-white/[0.05] p-5 transition hover:bg-white/[0.08]">
                  <div className="h-1.5 w-7 rounded-full bg-[#f9ae5a]" />
                  <div className="mt-3 text-[15px] font-extrabold">{l}</div>
                  <div className="mt-0.5 text-xs text-[#b8c3cf]">{s}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#fffbf5] py-20">
        <div className="reveal mx-auto max-w-2xl px-5 text-center sm:px-8">
          <h2 className="text-3xl font-extrabold text-[#0d1520]">Wil je samenwerken met Digitify?</h2>
          <p className="mt-3 text-sm text-[#5a6878]">Plan een gesprek over Lead Finder of een breder digitaal groeiraject.</p>
          <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/register" className="group inline-flex h-11 items-center rounded-xl bg-[#f9ae5a] px-7 text-sm font-bold text-[#14100b] shadow-[0_6px_24px_rgba(249,174,90,0.5)] transition-all hover:bg-[#eca04e]">
              Aanmelden <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="https://www.digitify.be" target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center rounded-xl border border-[#cfd8d2] bg-white px-7 text-sm font-semibold text-[#172131] shadow-sm transition hover:border-[#9fb4c8]">
              www.digitify.be <ExternalLink className="ml-2 h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

/* ══════════════════════════════════════════════
   CONTACT
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
      <section className="relative overflow-hidden border-b border-[#e2e8e3]">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#fffdf9] via-[#faf7f2] to-[#f0ede7]" />
        <div className="pointer-events-none absolute -right-20 top-0 h-[400px] w-[400px] rounded-full bg-[#f9ae5a]/8 blur-[100px]" />
        <div className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-xl text-center animate-fade-in">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#f9ae5a]/30 bg-[#f9ae5a]/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[#b66d1e]">
              <MessageSquareText className="h-3 w-3" />
              Demo aanvragen
            </div>
            <h1 className="text-[2.6rem] font-extrabold leading-tight text-[#0d1520] sm:text-5xl">
              Bekijk hoe Lead Finder in jouw <span className="gradient-text">proces past.</span>
            </h1>
            <p className="mt-5 text-base leading-7 text-[#4d5b6b]">
              Plan een demo, bespreek je huidige leadflow en ontdek welke modules meteen waarde kunnen leveren.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-[#f7f8f6] py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-7 lg:grid-cols-[1.5fr_1fr]">
            <div className="reveal-left rounded-2xl border border-[#e2e8e3] bg-white p-7 shadow-sm sm:p-9">
              {sent ? (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#12a66a]/15 animate-scale-in">
                    <CheckCircle2 className="h-8 w-8 text-[#12a66a]" />
                  </div>
                  <h2 className="mt-6 text-2xl font-extrabold text-[#0d1520]">Bericht verzonden!</h2>
                  <p className="mt-2 text-sm text-[#5a6878]">We nemen zo snel mogelijk contact met je op — meestal binnen 1 werkdag.</p>
                  <button onClick={() => setSent(false)} className="mt-5 text-sm font-semibold text-[#f9ae5a] hover:text-[#eca04e]">Nieuw bericht sturen</button>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-extrabold text-[#0d1520]">Stuur ons een bericht</h2>
                  <p className="mt-1 text-sm text-[#5a6878]">We reageren doorgaans binnen 1 werkdag.</p>
                  <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {[{ id: "name", label: "Naam *", type: "text", ph: "Jouw naam", req: true }, { id: "email", label: "E-mail *", type: "email", ph: "jij@bedrijf.be", req: true }].map(({ id, label, type, ph, req }) => (
                        <div key={id}>
                          <label className="mb-1.5 block text-sm font-bold text-[#344052]">{label}</label>
                          <input type={type} required={req} value={(form as any)[id]} onChange={(e) => setForm({ ...form, [id]: e.target.value })} placeholder={ph}
                            className="w-full rounded-xl border border-[#dde3e8] bg-[#f9fbfa] px-3.5 py-2.5 text-sm outline-none transition-all focus:border-[#f9ae5a] focus:bg-white focus:ring-2 focus:ring-[#f9ae5a]/20 placeholder:text-[#b0bcca]" />
                        </div>
                      ))}
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-[#344052]">Bedrijf</label>
                      <input type="text" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Bedrijfsnaam"
                        className="w-full rounded-xl border border-[#dde3e8] bg-[#f9fbfa] px-3.5 py-2.5 text-sm outline-none transition-all focus:border-[#f9ae5a] focus:bg-white focus:ring-2 focus:ring-[#f9ae5a]/20 placeholder:text-[#b0bcca]" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-[#344052]">Bericht *</label>
                      <textarea required rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Vertel over je huidige leadflow..."
                        className="w-full resize-none rounded-xl border border-[#dde3e8] bg-[#f9fbfa] px-3.5 py-2.5 text-sm outline-none transition-all focus:border-[#f9ae5a] focus:bg-white focus:ring-2 focus:ring-[#f9ae5a]/20 placeholder:text-[#b0bcca]" />
                    </div>
                    <button type="submit" disabled={sending}
                      className="group inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#f9ae5a] text-sm font-bold text-[#14100b] shadow-[0_6px_24px_rgba(249,174,90,0.5)] transition-all hover:bg-[#eca04e] disabled:opacity-60">
                      {sending ? <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-[#14100b]/30 border-t-[#14100b]" />Verzenden...</span>
                        : <span className="flex items-center gap-2">Stuur bericht <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>}
                    </button>
                  </form>
                </>
              )}
            </div>

            <div className="reveal-right space-y-4">
              <div className="rounded-2xl border border-[#f9ae5a]/20 bg-[#fffbf5] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Image src="/favicon.ico" alt="Digitify" width={28} height={28} className="rounded-lg" />
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#b66d1e]">Wat je krijgt in de demo</p>
                </div>
                <ul className="space-y-3">
                  {[
                    { icon: Users2, c: "Analyse van je huidige prospectieproces." },
                    { icon: MessageSquareText, c: "Walkthrough van leads, campagnes, offertes en bookings." },
                    { icon: Bot, c: "Advies over welke modules je best eerst activeert." },
                    { icon: TrendingUp, c: "Schatting van de tijdsbesparing voor jouw team." },
                  ].map(({ icon: Icon, c }) => (
                    <li key={c} className="flex gap-2.5 text-sm text-[#4d5b6b]">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#12a66a]" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-[#e2e8e3] bg-white p-5 shadow-sm">
                <p className="text-sm font-bold text-[#0d1520] mb-3">Contactgegevens</p>
                {[
                  { icon: Mail, l: "hello@digitify.be", href: "mailto:hello@digitify.be" },
                  { icon: Phone, l: "+32 (0) 486 51 57 73", href: "tel:+3248651573" },
                  { icon: MapPin, l: "België", href: undefined },
                  { icon: Globe2, l: "www.digitify.be", href: "https://www.digitify.be" },
                ].map(({ icon: Icon, l, href }) => (
                  <div key={l} className="flex items-center gap-3 py-2 text-sm text-[#4d5b6b]">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f9ae5a]/10">
                      <Icon className="h-3.5 w-3.5 text-[#f9ae5a]" />
                    </div>
                    {href ? <a href={href} className="transition hover:text-[#f9ae5a]" target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">{l}</a> : l}
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-[#e2e8e3] bg-[#f9fbfa] p-5">
                <p className="text-sm font-bold text-[#0d1520] mb-3">Veelgestelde vragen</p>
                {[
                  { q: "Hoe lang duurt een demo?", a: "Doorgaans 30–45 minuten, online of telefonisch." },
                  { q: "Is het voor grote bedrijven?", a: "Nee, perfect voor KMO's, agencies en freelancers." },
                  { q: "Kan ik proberen voor ik koop?", a: "Ja, we bespreken dat in de demo." },
                ].map(({ q, a }) => (
                  <div key={q} className="mb-3 last:mb-0">
                    <p className="text-sm font-bold text-[#0d1520]">{q}</p>
                    <p className="mt-0.5 text-sm text-[#5a6878]">{a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/* ─── HOME HERO TAB PREVIEW ─── */
function HomeHeroModuleTabs() {
  const [activeTab, setActiveTab] = useState<SolutionSlug>("lead-search");
  const activeModule = SOLUTION_MODULES.find((module) => module.slug === activeTab) ?? SOLUTION_MODULES[0];
  const ActiveIcon = activeModule.icon;

  return (
    <div className="overflow-hidden rounded-2xl border border-[#dfe6e1] bg-white shadow-[0_22px_56px_rgba(13,21,32,0.14)]">
      <div className="border-b border-[#edf1ee] bg-[#f9fbfa] p-3">
        <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
          {SOLUTION_MODULES.map((module) => {
            const Icon = module.icon;
            const isActive = module.slug === activeTab;
            return (
              <button
                key={module.slug}
                type="button"
                onClick={() => setActiveTab(module.slug)}
                className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-[10px] font-bold transition ${
                  isActive ? "bg-[#f9ae5a] text-[#14100b]" : "bg-white text-[#5a6878] hover:bg-[#fff8ee] hover:text-[#b66d1e]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="truncate">{module.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#f9ae5a]/30 bg-[#fff8ee] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#b66d1e]">
            <ActiveIcon className="h-3 w-3" />
            Live UI
          </div>
          <Link href={`/oplossingen/${activeModule.slug}`} className="inline-flex items-center gap-1 text-xs font-bold text-[#b66d1e] transition hover:text-[#8d5110]">
            Lees meer
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {activeModule.mockup}
      </div>
    </div>
  );
}

/* ─── HOME DASHBOARD ─── */
function HomeDashboard() {
  return (
    <div className="relative w-full">
      <div className="absolute -bottom-4 -left-4 h-full w-full rounded-2xl bg-[#f9ae5a]/12" />
      <div className="relative rounded-2xl border border-[#dde3e8] bg-[#0d1520] p-2 shadow-[0_28px_70px_rgba(13,21,32,0.22)]">
        <div className="rounded-xl border border-white/8 bg-[#f9fbfa]">
          <div className="flex items-center justify-between border-b border-[#e2e8e3] p-4">
            <div className="flex items-center gap-2.5">
              <Image src="/favicon.ico" alt="Digitify" width={22} height={22} className="rounded-md" />
              <div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-[#f9ae5a]">Pipeline vandaag</div>
                <div className="text-sm font-extrabold text-[#0d1520]">Lead Finder Suite</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-[#dfe5df] bg-white px-2.5 py-1.5 text-[10px] font-bold text-[#344052]">
              <ShieldCheck className="h-3 w-3 text-[#12a66a]" /> Live
            </div>
          </div>
          <div className="p-4 space-y-2">
            {[
              { name: "Luma Dental",   score: 92, status: "Offerte klaar",  pct: 90, c: "bg-[#eaf6f0] text-[#0b8354]" },
              { name: "Atelier Noord", score: 84, status: "Demo gepland",   pct: 70, c: "bg-[#eef4ff] text-[#1d4ed8]" },
              { name: "Vesta Solar",   score: 78, status: "Review flow",    pct: 55, c: "bg-[#fff8ee] text-[#b66d1e]" },
            ].map(({ name, score, status, pct, c }) => (
              <div key={name} className="rounded-xl border border-[#e8eee8] bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#f9ae5a]/15 text-[9px] font-extrabold text-[#b66d1e]">{name[0]}</div>
                    <span className="text-sm font-bold text-[#172131]">{name}</span>
                  </div>
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold ${c}`}>{score}</span>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e6ebe7]">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#f9ae5a] to-[#eca04e]" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="shrink-0 text-[10px] text-[#6a7684]">{status}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2.5 border-t border-[#e8eee8] p-4">
            {[{ icon: Bot, l: "Chatbot", v: "42 gesprekken" }, { icon: Quote, l: "Quotes", v: "7 klaar" }, { icon: Star, l: "Reviews", v: "4.8 ⭐" }].map(({ icon: Icon, l, v }) => (
              <div key={l} className="rounded-xl border border-[#e8eee8] bg-white p-3 shadow-sm">
                <Icon className="h-3.5 w-3.5 text-[#f9ae5a]" />
                <div className="mt-2 text-[11px] font-extrabold text-[#0d1520]">{l}</div>
                <div className="mt-0.5 text-[10px] text-[#6a7684]">{v}</div>
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
  const { data: footerSettings } = trpc.settings.getPublicMarketingFooter.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
  });
  const footer = {
    brandName: footerSettings?.brandName || "Digitify Lead Finder",
    tagline: footerSettings?.tagline || "Partner in Digital Solutions",
    description: footerSettings?.description || "Premium lead discovery en opvolging voor bedrijven die digitale groei praktisch willen organiseren.",
    email: footerSettings?.email || "hello@digitify.be",
    phone: footerSettings?.phone || "+32 (0) 486 51 57 73",
    location: footerSettings?.location || "België",
    websiteLabel: footerSettings?.websiteLabel || "www.digitify.be",
    websiteUrl: footerSettings?.websiteUrl || "https://www.digitify.be",
    legalLine: footerSettings?.legalLine || `© ${new Date().getFullYear()} Digitify`,
    copyrightLine: footerSettings?.copyrightLine || `© ${new Date().getFullYear()} Digitify. Webdesign, media en marketing voor digitale groei.`,
  };

  return (
    <footer className="border-t border-[#1a1510] bg-[#0d1117] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr]">
        <div>
          <div className="flex items-center gap-3">
            <Image src="/favicon.ico" alt="Digitify" width={36} height={36} className="rounded-xl" />
            <div>
              <div className="text-[15px] font-extrabold">{footer.brandName}</div>
              <div className="text-xs text-[#9d948b]">{footer.tagline}</div>
            </div>
          </div>
          <p className="mt-5 max-w-xs text-sm leading-7 text-[#b8b0a6]">
            {footer.description}
          </p>
          <div className="mt-4 space-y-2">
            {[{ icon: Mail, t: footer.email, h: footer.email ? `mailto:${footer.email}` : undefined }, { icon: Phone, t: footer.phone, h: footer.phone ? `tel:${footer.phone.replace(/[^\d+]/g, "")}` : undefined }, { icon: MapPin, t: footer.location, h: undefined }].map(({ icon: Icon, t, h }) => (
              <div key={t} className="flex items-center gap-2 text-sm text-[#9d948b]">
                <Icon className="h-3.5 w-3.5 text-[#f9ae5a]" />
                {h ? <a href={h} className="hover:text-[#f9ae5a]">{t}</a> : t}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-4 text-[10px] font-extrabold uppercase tracking-widest text-[#f9ae5a]">Website</div>
          <div className="space-y-2.5 text-sm text-[#b8b0a6]">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="block transition hover:text-[#f9ae5a]">{item.label}</Link>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-4 text-[10px] font-extrabold uppercase tracking-widest text-[#f9ae5a]">Actie</div>
          <div className="space-y-2.5 text-sm text-[#b8b0a6]">
            <Link href="/login" className="block transition hover:text-[#f9ae5a]">Login</Link>
            <Link href="/register" className="block transition hover:text-[#f9ae5a]">Toegang aanvragen</Link>
            <a href={footer.websiteUrl} target="_blank" rel="noopener noreferrer" className="block transition hover:text-[#f9ae5a]">{footer.websiteLabel}</a>
          </div>
        </div>
        <div>
          <div className="mb-4 text-[10px] font-extrabold uppercase tracking-widest text-[#f9ae5a]">Juridisch</div>
          <div className="space-y-2.5 text-sm text-[#9d948b]">
            <div>BTW BE0685.556.507</div>
            <div>{footer.legalLine}</div>
          </div>
        </div>
      </div>
      <div className="border-t border-white/[0.06] py-4 text-center text-xs text-[#5a5450]">
        {footer.copyrightLine}
      </div>
    </footer>
  );
}
