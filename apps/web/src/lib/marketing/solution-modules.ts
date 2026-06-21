export const MARKETING_SOLUTION_SLUGS = [
  "lead-search",
  "outreach-ai",
  "rapporten",
  "white-label",
  "offerte-configurator",
  "booking-agenda",
  "chatbot-widget",
  "reviewsysteem",
] as const;

export type MarketingSolutionSlug = (typeof MARKETING_SOLUTION_SLUGS)[number];

export type SolutionModuleDefinition = {
  slug: MarketingSolutionSlug;
  label: string;
  title: string;
  description: string;
  bullets: string[];
  chipClass: string;
  detailIntro: string;
  detailSteps: string[];
  detailImpact: string[];
};

export const SOLUTION_MODULE_DEFINITIONS: SolutionModuleDefinition[] = [
  {
    slug: "lead-search",
    label: "Lead Search",
    title: "Vind en kwalificeer leads vanuit kaartdata.",
    description:
      "Zoek lokaal op niche en regio, score automatisch op potentieel en zet interessante profielen direct door naar je pipeline.",
    bullets: [
      "Zoeken op niche, stad en regio in enkele seconden.",
      "Directe scoring op commerciële fit en prioriteit.",
      "Leads meteen doorzetten naar campagne of CRM flow.",
    ],
    chipClass: "border-[#f9ae5a]/30 bg-[#fff8ee] text-[#b66d1e]",
    detailIntro:
      "Lead Search geeft je team een snelle prospectielijn vanuit lokale kaartdata, met directe focus op leadkwaliteit in plaats van ruwe volume-lijsten.",
    detailSteps: [
      "Selecteer niche, regio en zoekfilters per campagne.",
      "Laat de app automatisch profielen ophalen en verrijken.",
      "Gebruik score + tags om direct je prioriteiten te bepalen.",
      "Stuur warme leads meteen door naar outreach of CRM.",
    ],
    detailImpact: [
      "Sneller prospecteren zonder manueel opzoekwerk.",
      "Hogere relevantie in je eerste contactmoment.",
      "Minder ruis in de pipeline door directe kwalificatie.",
    ],
  },
  {
    slug: "outreach-ai",
    label: "Outreach met AI",
    title: "Laat AI je outreachflow versnellen.",
    description:
      "Stel mails op in jouw tone of voice, werk met goedkeuringsflows en verstuur rechtstreeks vanuit je eigen merkidentiteit.",
    bullets: [
      "Automatische drafts per doelgroep en intentie.",
      "Goedkeuringsflow voor teamcontrole en kwaliteitsniveau.",
      "Versturen in jouw branding zonder extra tools.",
    ],
    chipClass: "border-[#06b6d4]/25 bg-[#06b6d4]/10 text-[#0f7b8f]",
    detailIntro:
      "Outreach met AI combineert snelheid en consistentie: je team vertrekt van sterke drafts, maar behoudt controle via approvals en branding.",
    detailSteps: [
      "Kies doelgroep, template en gewenste intentie.",
      "Genereer AI-drafts met context uit leaddata.",
      "Laat mails valideren in de interne goedkeuringsstap.",
      "Verstuur en volg replies op vanuit dezelfde flow.",
    ],
    detailImpact: [
      "Kortere tijd van lead naar eerste contact.",
      "Consistente tone of voice per account.",
      "Betere opvolging dankzij centrale campagnecontext.",
    ],
  },
  {
    slug: "rapporten",
    label: "Rapporten",
    title: "Verkooprapporten die meteen sturen op prioriteit.",
    description:
      "Zet lead score, pipeline-status en opvolgacties om in duidelijke rapporten die klanten en teams in één oogopslag begrijpen.",
    bullets: [
      "Leadscore, status en actiepunten in 1 rapport.",
      "Realtime zicht op pipeline-gezondheid en kansen.",
      "Klaar voor klantpresentatie of intern overleg.",
    ],
    chipClass: "border-[#8b5cf6]/25 bg-[#8b5cf6]/10 text-[#6d3dc2]",
    detailIntro:
      "Rapporten maken prestaties leesbaar voor team en klant, met focus op scoringslogica, opvolging en concrete prioriteiten.",
    detailSteps: [
      "Bundel score, status en activiteit per leadsegment.",
      "Toon trends over pipelinewaarde en conversiemomenten.",
      "Export in een white-label presentatieformat.",
      "Gebruik rapporten als vaste ritmiek in opvolgmeetings.",
    ],
    detailImpact: [
      "Snellere beslissingen op basis van heldere data.",
      "Betere klantcommunicatie over voortgang.",
      "Meer grip op commerciële bottlenecks.",
    ],
  },
  {
    slug: "white-label",
    label: "White-labelbaar",
    title: "Volledig in je eigen branding, zonder compromissen.",
    description:
      "Van login tot widgets en exports: kleuren, logo, stijl en communicatie lopen consistent door in elke flow van de app.",
    bullets: [
      "Eigen logo, kleurpalet en tone of voice per account.",
      "Consistente ervaring in login, app en embeds.",
      "Branding blijft uniform tot de gebruiker die wijzigt.",
    ],
    chipClass: "border-[#10b981]/25 bg-[#10b981]/10 text-[#0f7f5b]",
    detailIntro:
      "White-label houdt je merk centraal in elke gebruikersstap, zodat klanten en prospects altijd jouw identiteit ervaren in plaats van een generieke tool.",
    detailSteps: [
      "Stel primaire kleur, logo en merkaccenten per account in.",
      "Pas widget- en exportstijlen aan op je huisstijl.",
      "Beheer branding-consistentie over alle modules.",
      "Schaal dit model naar meerdere teams of klanten.",
    ],
    detailImpact: [
      "Professionelere klantervaring end-to-end.",
      "Meer vertrouwen door consistente merkpresentatie.",
      "Minder design-frictie bij groei van het team.",
    ],
  },
  {
    slug: "offerte-configurator",
    label: "Offerte configurator",
    title: "Configureer, bereken en verstuur in één flow.",
    description:
      "De configurator begeleidt bezoekers stap voor stap van dienstkeuze tot aanvraag. Prijzen, opties en totalen worden live opgebouwd zodat je team meteen een volledige draft-offerte heeft.",
    bullets: [
      "Duidelijke stappen: dienst, product, specificaties en gegevens.",
      "Live prijsopbouw met subtotalen, btw en totaal.",
      "Aanvraag komt direct per account in je eigen offerteflow.",
    ],
    chipClass: "border-[#e85d3a]/25 bg-[#e85d3a]/10 text-[#b94d2f]",
    detailIntro:
      "De offerteconfigurator reduceert heen-en-weer tussen sales en prospect door duidelijke stappen en realtime prijsopbouw in één gebruikersflow.",
    detailSteps: [
      "Laat bezoekers diensten en opties selecteren.",
      "Bereken live subtotaal, btw en totaalprijs.",
      "Capture contactgegevens en context direct in de app.",
      "Start opvolging meteen vanuit je offertepipeline.",
    ],
    detailImpact: [
      "Minder manuele offerte-opmaak.",
      "Snellere reactie op inkomende aanvragen.",
      "Betere kwaliteit van offertebriefings.",
    ],
  },
  {
    slug: "booking-agenda",
    label: "Booking agenda",
    title: "Planning die meteen werkt op je website.",
    description:
      "Bezoekers kiezen rechtstreeks een beschikbaar slot. De agenda respecteert je ingestelde uren, blokkeert overlap en kan synchroniseren met Google Calendar voor realtime beschikbaarheid.",
    bullets: [
      "Week- en dagbeschikbaarheid met configureerbare slotduur.",
      "Conflictcheck tegen bestaande afspraken en kalenderblokkeringen.",
      "Automatische bevestiging voor klant en team.",
    ],
    chipClass: "border-[#f59e0b]/25 bg-[#f59e0b]/10 text-[#b66d1e]",
    detailIntro:
      "Booking agenda zet interesse om in concrete afspraken via een snelle, conflictvrije flow die direct met je planning meeloopt.",
    detailSteps: [
      "Definieer beschikbaarheid en slotlengtes per account.",
      "Toon enkel vrije momenten op je website of landingspagina.",
      "Voer automatische conflictchecks uit bij boeking.",
      "Verzend bevestigingen en synchroniseer met agenda's.",
    ],
    detailImpact: [
      "Meer afspraken zonder manuele planning.",
      "Minder no-shows door duidelijke bevestigingen.",
      "Efficiëntere intake over alle teams.",
    ],
  },
  {
    slug: "chatbot-widget",
    label: "Chatbot widget",
    title: "AI-gesprekken die leads meteen kwalificeren.",
    description:
      "De chatbot draait in je branding, geeft directe antwoorden en stuurt elk gesprek door naar je inbox. Zo blijft support snel en worden commerciële kansen automatisch vastgelegd.",
    bullets: [
      "Gebaseerd op account-specifieke settings en kenniscontext.",
      "Slimme intentdetectie voor afspraak, offerte of support.",
      "Gesprekken direct bruikbaar in opvolging en pipeline.",
    ],
    chipClass: "border-[#06b6d4]/25 bg-[#06b6d4]/10 text-[#0f7b8f]",
    detailIntro:
      "De chatbot widget combineert support en saleskwalificatie in één branded kanaal, zodat gesprekken niet verloren gaan tussen inboxen en losse tools.",
    detailSteps: [
      "Configureer kenniscontext per account.",
      "Detecteer intentie zoals offerte, booking of supportvraag.",
      "Stuur relevante gesprekken direct naar opvolging.",
      "Gebruik gespreksdata voor betere leadprioritering.",
    ],
    detailImpact: [
      "Snellere antwoorden buiten kantooruren.",
      "Meer gekwalificeerde inbound leads.",
      "Minder gemiste commerciële kansen.",
    ],
  },
  {
    slug: "reviewsysteem",
    label: "Reviewsysteem",
    title: "Van interne feedback naar publieke reviewgroei.",
    description:
      "Het systeem splitst automatisch op basis van score: lagere scores gaan naar interne feedback, hogere scores sturen klanten door naar jouw reviewplatforms om reputatie actief te versterken.",
    bullets: [
      "Tweeledige flow voor kwaliteitsopvolging en reputatie-opbouw.",
      "Platformkeuze per account: Google, Trustpilot of Facebook.",
      "Heldere statusopvolging van ingestuurde reviews.",
    ],
    chipClass: "border-[#ec4899]/25 bg-[#ec4899]/10 text-[#b93c79]",
    detailIntro:
      "Het reviewsysteem structureert reputatiemanagement met een duidelijke split tussen interne kwaliteitsfeedback en publieke reviewgroei.",
    detailSteps: [
      "Verzamel score en korte feedback na oplevering.",
      "Route lage scores intern voor snelle opvolging.",
      "Route hoge scores naar publieke reviewplatforms.",
      "Volg status en impact op reputatie per account op.",
    ],
    detailImpact: [
      "Hogere reviewscore op publieke platformen.",
      "Snellere correctie van kwaliteitsissues.",
      "Meer geloofwaardigheid in nieuwe salesgesprekken.",
    ],
  },
];

export function isMarketingSolutionSlug(slug: string): slug is MarketingSolutionSlug {
  return MARKETING_SOLUTION_SLUGS.includes(slug as MarketingSolutionSlug);
}

export function getSolutionModuleBySlug(slug: string) {
  return SOLUTION_MODULE_DEFINITIONS.find((module) => module.slug === slug);
}
