import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  FileText,
  Globe2,
  MailCheck,
  MessageSquareText,
  Quote,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Users2,
  Zap,
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

const featureCards = [
  {
    icon: Search,
    title: "Lead discovery",
    copy: "Vind relevante bedrijven, verrijk contactdata en prioriteer kansen met een duidelijke score.",
  },
  {
    icon: MailCheck,
    title: "Outreach & opvolging",
    copy: "Beheer templates, campagnes, inboxen en goedkeuringen zonder losse spreadsheets of copy-paste werk.",
  },
  {
    icon: FileText,
    title: "Offertes & rapporten",
    copy: "Maak professionele offertes, rapporten en opvolgflows vanuit dezelfde klantcontext.",
  },
  {
    icon: CalendarCheck,
    title: "Bookings & reviews",
    copy: "Laat prospects afspraken boeken, verzamel reviews en toon widgets op je website.",
  },
];

const workflowSteps = [
  "Zoek en verrijk leads",
  "Scoreer commerciële fit",
  "Start gepersonaliseerde outreach",
  "Volg offertes, bookings en reviews op",
];

const solutionCards = [
  {
    title: "Voor agencies",
    copy: "Een centrale groeimachine voor prospectie, klantopvolging en rapportage.",
    items: ["White-label ervaring", "Campagnegoedkeuring", "Rapporten per klant"],
  },
  {
    title: "Voor sales teams",
    copy: "Minder administratie, meer focus op de leads die echt verkoopkansen tonen.",
    items: ["Pipeline overzicht", "Lead scoring", "E-mail opvolging"],
  },
  {
    title: "Voor lokale diensten",
    copy: "Combineer aanvragen, afspraken, reviews en offertes in een eenvoudige workflow.",
    items: ["Booking embeds", "Review widgets", "Snelle offertes"],
  },
];

const pageCopy: Record<MarketingPageKey, { eyebrow: string; title: string; body: string }> = {
  home: {
    eyebrow: "Digitify Lead Finder",
    title: "Van lead naar klant, zonder ruis.",
    body:
      "Ontdek leads, beheer outreach, maak offertes, plan afspraken, verzamel reviews en activeer je chatbot vanuit een premium workspace voor groei.",
  },
  product: {
    eyebrow: "Product",
    title: "Alles wat je nodig hebt om kansen commercieel op te volgen.",
    body:
      "Digitify Lead Finder brengt prospectie, communicatie en conversie samen. Je ziet waar elke lead staat, welke actie nodig is en hoe snel je team vooruitgaat.",
  },
  solutions: {
    eyebrow: "Oplossingen",
    title: "Groei-workflows voor teams die geen tijd willen verliezen.",
    body:
      "Van agencies tot lokale dienstverleners: de app vormt zich rond concrete workflows zoals leadkwalificatie, campagne-opvolging, bookings en reviewgroei.",
  },
  about: {
    eyebrow: "Over Digitify",
    title: "Gebouwd door een digitaal team dat groei praktisch maakt.",
    body:
      "Digitify bouwt digitale systemen die marketing, sales en operations dichter bij elkaar brengen. Lead Finder is gemaakt voor teams die sneller willen schakelen.",
  },
  contact: {
    eyebrow: "Contact",
    title: "Bekijk hoe Lead Finder in jouw proces past.",
    body:
      "Plan een demo, bespreek je huidige leadflow en ontdek welke onderdelen meteen waarde kunnen leveren voor je team.",
  },
};

export function MarketingPage({ page }: MarketingPageProps) {
  const copy = pageCopy[page];

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#0d1520]">
      <MarketingHeader />
      <Hero copy={copy} page={page} />
      <TrustBar />
      <ProductSection />
      <FeatureSection />
      <SolutionsSection />
      <AboutSection />
      <ContactSection highlight={page === "contact"} />
      <MarketingFooter />
    </main>
  );
}

function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#dfe5df]/80 bg-[#f7f8f6]/88 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="Digitify Lead Finder home">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#0d1520] text-white shadow-sm">
            <Zap className="h-4 w-4" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold tracking-[0.01em]">Digitify</span>
            <span className="block text-xs text-[#5a6878]">Lead Finder</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-medium text-[#344052] md:flex" aria-label="Hoofdnavigatie">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-[#0d63ce]">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="inline-flex h-9 items-center justify-center rounded-md border border-[#cfd8d2] bg-white px-3 text-sm font-semibold text-[#172131] shadow-sm transition hover:border-[#9fb4c8] hover:text-[#0d63ce]"
          >
            Login
          </Link>
          <Link
            href="/contact"
            className="hidden h-9 items-center justify-center rounded-md bg-[#0d63ce] px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(13,99,206,0.24)] transition hover:bg-[#0b57b5] sm:inline-flex"
          >
            Plan demo
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero({ copy, page }: { copy: (typeof pageCopy)[MarketingPageKey]; page: MarketingPageKey }) {
  return (
    <section className="relative overflow-hidden border-b border-[#dfe5df] bg-[linear-gradient(180deg,#fbfcfb_0%,#eef3ef_100%)]">
      <div className="mx-auto grid min-h-[calc(86vh-4rem)] max-w-7xl items-center gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:py-16">
        <div className="max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-[#cfd8d2] bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase text-[#0d63ce] shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            {copy.eyebrow}
          </div>
          <h1 className="max-w-[12ch] text-5xl font-semibold leading-[0.98] tracking-normal text-[#0d1520] sm:text-6xl lg:text-7xl">
            {copy.title}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[#4d5b6b]">{copy.body}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/contact"
              className="inline-flex h-12 items-center justify-center rounded-md bg-[#0d63ce] px-6 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(13,99,206,0.24)] transition hover:bg-[#0b57b5]"
            >
              Plan een demo
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link
              href={page === "product" ? "/login" : "/product"}
              className="inline-flex h-12 items-center justify-center rounded-md border border-[#cfd8d2] bg-white px-6 text-sm font-semibold text-[#172131] shadow-sm transition hover:border-[#9fb4c8] hover:text-[#0d63ce]"
            >
              Bekijk de app
              <ChevronRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
          <div className="mt-8 grid max-w-xl grid-cols-3 gap-3 text-sm text-[#4d5b6b]">
            <ProofPoint value="1" label="workspace" />
            <ProofPoint value="6+" label="groeiflows" />
            <ProofPoint value="BE" label="door Digitify" />
          </div>
        </div>
        <ProductMockup />
      </div>
    </section>
  );
}

function ProofPoint({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-md border border-[#dfe5df] bg-white/70 p-3">
      <div className="text-xl font-semibold text-[#0d1520]">{value}</div>
      <div className="mt-1 text-xs text-[#6a7684]">{label}</div>
    </div>
  );
}

function ProductMockup() {
  const leads = [
    ["Luma Dental", "92", "Offerte klaar"],
    ["Atelier Noord", "84", "Demo gepland"],
    ["Vesta Solar", "78", "Review flow"],
  ];

  return (
    <div className="relative">
      <div className="absolute -left-4 top-10 hidden h-24 w-24 rounded-md border border-[#dfe5df] bg-white/90 shadow-xl lg:block" />
      <div className="relative rounded-[8px] border border-[#cfd8d2] bg-[#101821] p-2 shadow-[0_28px_80px_rgba(13,21,32,0.22)]">
        <div className="rounded-[6px] border border-white/10 bg-[#f9fbfa] p-4">
          <div className="flex items-center justify-between border-b border-[#e2e8e3] pb-4">
            <div>
              <div className="text-xs font-semibold uppercase text-[#0d63ce]">Pipeline vandaag</div>
              <div className="mt-1 text-lg font-semibold">Lead Finder Suite</div>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-[#dfe5df] bg-white px-3 py-2 text-xs font-medium text-[#344052]">
              <ShieldCheck className="h-4 w-4 text-[#12a66a]" />
              Live workspace
            </div>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-3">
              {leads.map(([name, score, status]) => (
                <div key={name} className="rounded-md border border-[#dfe5df] bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-[#172131]">{name}</div>
                    <div className="rounded-md bg-[#eaf6f0] px-2 py-1 text-xs font-semibold text-[#0b8354]">{score}</div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-[#6a7684]">
                    <span>{status}</span>
                    <span className="h-1.5 w-24 overflow-hidden rounded-full bg-[#e6ebe7]">
                      <span className="block h-full w-3/4 rounded-full bg-[#0d63ce]" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-md border border-[#dfe5df] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Campagne orchestration</div>
                  <div className="mt-1 text-xs text-[#6a7684]">E-mail, offerte, booking en reviewflow.</div>
                </div>
                <BarChart3 className="h-5 w-5 text-[#0d63ce]" />
              </div>
              <div className="mt-5 space-y-3">
                {workflowSteps.map((step, index) => (
                  <div key={step} className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#eef4fb] text-xs font-semibold text-[#0d63ce]">
                      {index + 1}
                    </span>
                    <span className="flex-1 text-sm text-[#344052]">{step}</span>
                    <CheckCircle2 className="h-4 w-4 text-[#12a66a]" />
                  </div>
                ))}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <MiniMetric label="Open offertes" value="18" />
                <MiniMetric label="Bookings" value="+31%" />
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <ModuleTile icon={Bot} label="Chatbot" value="42 gesprekken" />
            <ModuleTile icon={Quote} label="Quotes" value="7 klaar" />
            <ModuleTile icon={Star} label="Reviews" value="4.8 score" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[#f1f5f2] p-3">
      <div className="text-xs text-[#6a7684]">{label}</div>
      <div className="mt-1 text-xl font-semibold text-[#0d1520]">{value}</div>
    </div>
  );
}

function ModuleTile({ icon: Icon, label, value }: { icon: typeof Bot; label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#dfe5df] bg-white p-3 shadow-sm">
      <Icon className="h-4 w-4 text-[#0d63ce]" />
      <div className="mt-3 text-sm font-semibold">{label}</div>
      <div className="mt-1 text-xs text-[#6a7684]">{value}</div>
    </div>
  );
}

function TrustBar() {
  return (
    <section className="border-b border-[#dfe5df] bg-white">
      <div className="mx-auto grid max-w-7xl gap-4 px-5 py-7 text-sm text-[#5a6878] sm:px-8 md:grid-cols-4">
        {["Lead scoring", "Outreach management", "Quote automation", "Review growth"].map((item) => (
          <div key={item} className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#12a66a]" />
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

function ProductSection() {
  return (
    <section id="product" className="bg-[#f7f8f6] py-20">
      <SectionIntro
        eyebrow="Product"
        title="Een premium command center voor leadgeneratie."
        copy="Lead Finder vervangt losse documenten, losse inboxen en losse opvolglijsten door een workflow die commercieel helder blijft."
      />
      <div className="mx-auto mt-12 grid max-w-7xl gap-4 px-5 sm:px-8 lg:grid-cols-4">
        {featureCards.map((feature) => (
          <article key={feature.title} className="rounded-[8px] border border-[#dfe5df] bg-white p-6 shadow-sm">
            <feature.icon className="h-5 w-5 text-[#0d63ce]" />
            <h3 className="mt-5 text-lg font-semibold">{feature.title}</h3>
            <p className="mt-3 text-sm leading-6 text-[#5a6878]">{feature.copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function FeatureSection() {
  return (
    <section className="border-y border-[#dfe5df] bg-[#0d1520] py-20 text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <p className="text-sm font-semibold uppercase text-[#8bbdff]">Waarom het werkt</p>
          <h2 className="mt-4 text-4xl font-semibold leading-tight">Van commerciële intentie naar opvolging die blijft bewegen.</h2>
          <p className="mt-5 max-w-xl leading-7 text-[#b8c3cf]">
            De app toont niet alleen data. Ze maakt duidelijk welke actie vandaag nodig is: bellen, mailen, offerte sturen,
            afspraak plannen of review vragen.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ["Prioriteit", "Scores en statussen zetten de juiste leads bovenaan."],
            ["Consistentie", "Templates, campagnes en goedkeuringen houden je merk strak."],
            ["Conversie", "Offertes, bookings en reviews zitten dicht bij de leadcontext."],
            ["Inzicht", "Rapporten tonen waar groei ontstaat en waar opvolging hapert."],
          ].map(([title, copy]) => (
            <div key={title} className="rounded-[8px] border border-white/10 bg-white/[0.06] p-5">
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#b8c3cf]">{copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SolutionsSection() {
  return (
    <section id="oplossingen" className="bg-white py-20">
      <SectionIntro
        eyebrow="Oplossingen"
        title="Gebouwd rond echte groeiscenario's."
        copy="Elke workflow is ontworpen voor teams die professioneel willen overkomen en tegelijk sneller willen handelen."
      />
      <div className="mx-auto mt-12 grid max-w-7xl gap-4 px-5 sm:px-8 lg:grid-cols-3">
        {solutionCards.map((solution) => (
          <article key={solution.title} className="rounded-[8px] border border-[#dfe5df] bg-[#f9fbfa] p-6">
            <h3 className="text-xl font-semibold">{solution.title}</h3>
            <p className="mt-3 text-sm leading-6 text-[#5a6878]">{solution.copy}</p>
            <ul className="mt-6 space-y-3 text-sm text-[#344052]">
              {solution.items.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#12a66a]" />
                  {item}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

function AboutSection() {
  return (
    <section id="over-ons" className="bg-[#eef3ef] py-20">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-sm font-semibold uppercase text-[#0d63ce]">Gemaakt door Digitify</p>
          <h2 className="mt-4 text-4xl font-semibold leading-tight">Belgische digitale expertise, verpakt in een praktisch groeisysteem.</h2>
        </div>
        <div className="space-y-5 text-base leading-8 text-[#4d5b6b]">
          <p>
            Digitify bouwt websites, funnels en digitale systemen voor ondernemers die meetbare groei willen. Lead Finder is
            ontwikkeld vanuit dezelfde praktijk: minder losse tools, meer grip op de volledige commerciële flow.
          </p>
          <p>
            Het resultaat is een app die de dagelijkse realiteit van sales, marketing en operations respecteert: overzicht,
            snelheid en een professionele ervaring voor elke prospect.
          </p>
          <Link href="https://www.digitify.be" className="inline-flex items-center text-sm font-semibold text-[#0d63ce]">
            Bezoek www.digitify.be
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function ContactSection({ highlight }: { highlight: boolean }) {
  return (
    <section id="contact" className="bg-white py-20">
      <div className="mx-auto grid max-w-7xl gap-6 px-5 sm:px-8 lg:grid-cols-[1fr_0.8fr]">
        <div className="rounded-[8px] border border-[#dfe5df] bg-[#0d1520] p-8 text-white shadow-[0_18px_48px_rgba(13,21,32,0.18)] sm:p-10">
          <p className="text-sm font-semibold uppercase text-[#8bbdff]">Demo aanvragen</p>
          <h2 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight">
            Klaar om je leadflow professioneler te maken?
          </h2>
          <p className="mt-5 max-w-2xl leading-7 text-[#b8c3cf]">
            We bekijken je huidige proces, tonen de app en bepalen welke modules voor jouw team het meeste rendement opleveren.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="mailto:hello@digitify.be?subject=Demo%20Digitify%20Lead%20Finder"
              className="inline-flex h-12 items-center justify-center rounded-md bg-white px-6 text-sm font-semibold text-[#0d1520] transition hover:bg-[#e9eef3]"
            >
              Mail Digitify
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-md border border-white/20 px-6 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Login
            </Link>
          </div>
        </div>
        <aside className={`rounded-[8px] border p-6 ${highlight ? "border-[#0d63ce] bg-[#eef6ff]" : "border-[#dfe5df] bg-[#f9fbfa]"}`}>
          <Globe2 className="h-6 w-6 text-[#0d63ce]" />
          <h3 className="mt-5 text-xl font-semibold">Wat je krijgt in de demo</h3>
          <ul className="mt-5 space-y-4 text-sm text-[#4d5b6b]">
            <li className="flex gap-3">
              <Users2 className="mt-0.5 h-4 w-4 text-[#12a66a]" />
              Een korte analyse van je huidige prospectieproces.
            </li>
            <li className="flex gap-3">
              <MessageSquareText className="mt-0.5 h-4 w-4 text-[#12a66a]" />
              Een walkthrough van leads, campagnes, offertes, bookings en reviews.
            </li>
            <li className="flex gap-3">
              <Bot className="mt-0.5 h-4 w-4 text-[#12a66a]" />
              Advies over de modules die je best eerst activeert.
            </li>
          </ul>
        </aside>
      </div>
    </section>
  );
}

function SectionIntro({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
      <p className="text-sm font-semibold uppercase text-[#0d63ce]">{eyebrow}</p>
      <h2 className="mt-4 text-4xl font-semibold leading-tight text-[#0d1520]">{title}</h2>
      <p className="mt-5 text-base leading-7 text-[#5a6878]">{copy}</p>
    </div>
  );
}

function MarketingFooter() {
  return (
    <footer className="border-t border-[#dfe5df] bg-[#f7f8f6]">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 text-sm text-[#5a6878] sm:px-8 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="font-semibold text-[#0d1520]">Digitify Lead Finder</div>
          <div className="mt-1">Gemaakt door Digitify. Premium lead generation en opvolging.</div>
        </div>
        <div className="flex flex-wrap gap-5">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-[#0d63ce]">
              {item.label}
            </Link>
          ))}
          <Link href="/login" className="font-semibold text-[#0d63ce]">
            Login
          </Link>
        </div>
      </div>
    </footer>
  );
}
