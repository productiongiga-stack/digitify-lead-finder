export type ModuleHelpItem = {
  id: string;
  label: string;
  group: string;
  summary: string;
  firstStep: string;
  href: string;
};

export const MODULE_HELP: ModuleHelpItem[] = [
  { id: "leads", label: "Leads", group: "Prospectie", summary: "Beheer bedrijven, scores, statussen en opvolging.", firstStep: "Open een lead of importeer een bestaande lijst.", href: "/leads" },
  { id: "lead-search", label: "Leads zoeken", group: "Prospectie", summary: "Vind nieuwe bedrijven op basis van locatie, sector en zoekterm.", firstStep: "Start met een sector en regio.", href: "/leads/search" },
  { id: "campaigns", label: "Campagneprofielen", group: "Prospectie", summary: "Bundel doelgroep, boodschap en leads voor gerichte opvolging.", firstStep: "Maak een campagneprofiel aan.", href: "/campaigns" },
  { id: "contacts", label: "Outbound", group: "Communicatie", summary: "Maak drafts, keur inhoud goed en beheer verzendingen.", firstStep: "Open een draft of maak contact vanuit een lead.", href: "/contacts" },
  { id: "templates", label: "Standaard berichten", group: "Communicatie", summary: "Houd herbruikbare berichten en variabelen op één plek.", firstStep: "Bekijk een template voordat je een draft maakt.", href: "/templates" },
  { id: "crm", label: "CRM", group: "Verkoop", summary: "Volg klanten, relaties en commerciële status na kwalificatie.", firstStep: "Open een relatie vanuit een gewonnen lead.", href: "/crm" },
  { id: "tasks", label: "Taken", group: "Verkoop", summary: "Plan opvolging en houd volgende acties zichtbaar.", firstStep: "Maak een taak aan bij een lead of klant.", href: "/tasks" },
  { id: "quotes", label: "Offertes", group: "Verkoop", summary: "Maak, verstuur en volg offertes met expliciete statusovergangen.", firstStep: "Maak een offerte vanuit een lead.", href: "/quotes" },
  { id: "invoices", label: "Facturen", group: "Verkoop", summary: "Beheer facturen die aan je bestaande verkoopflow gekoppeld zijn.", firstStep: "Open een factuur vanuit een geldige offerte.", href: "/invoices" },
  { id: "payments", label: "Betalingen", group: "Verkoop", summary: "Bekijk betaalstatussen en de relatie met facturen.", firstStep: "Controleer eerst de gekoppelde factuur.", href: "/payments" },
  { id: "reports", label: "Rapportage", group: "Analyse", summary: "Bekijk leads, conversie, omzet en prestaties per periode.", firstStep: "Kies een periode en vergelijk de kerncijfers.", href: "/reports/overview" },
  { id: "seo", label: "SEO", group: "Analyse", summary: "Volg zoekwoorden, domein-audits en technische verbeterpunten.", firstStep: "Koppel een domein en voeg een zoekwoord toe.", href: "/seo" },
  { id: "metaAds", label: "Meta Ads", group: "Advertenties", summary: "Beheer Meta-campagnedrafts en resultaten wanneer de connector is ingesteld.", firstStep: "Controleer eerst de integratiestatus.", href: "/meta-ads" },
  { id: "googleAds", label: "Google Ads", group: "Advertenties", summary: "Werk met Google Ads-plannen en conversies in je workspace.", firstStep: "Controleer eerst de integratiestatus.", href: "/google-ads" },
  { id: "social", label: "Social Planner", group: "Marketing", summary: "Plan en beheer social posts vanuit één overzicht.", firstStep: "Maak een postdraft en kies een kanaal.", href: "/social" },
  { id: "creativeStudio", label: "Creative Studio", group: "Marketing", summary: "Maak creatieve varianten met je ingestelde merkcontext.", firstStep: "Controleer eerst je AI- of media-instellingen.", href: "/creative-studio" },
  { id: "bookings", label: "Boekingen", group: "Marketing", summary: "Beheer beschikbaarheid, afspraken en boekingsinstellingen.", firstStep: "Controleer je beschikbaarheid en tijdzone.", href: "/bookings" },
  { id: "domains", label: "Domeinen", group: "Beheer", summary: "Monitor websites, analyses, uptime en gezondheid.", firstStep: "Voeg een domein toe of voer een analyse uit.", href: "/domains" },
  { id: "files", label: "Bestanden", group: "Beheer", summary: "Bewaar workspace- en klantdocumenten met toegangscontrole.", firstStep: "Upload een bestand bij de juiste workspace.", href: "/files" },
  { id: "reviews", label: "Reviews", group: "Marketing", summary: "Beheer reviewlinks en volg reviewaanvragen.", firstStep: "Stel je reviewkanaal in.", href: "/reviews" },
  { id: "chatbot", label: "Chatbot", group: "Marketing", summary: "Beheer de widget en de gesprekken van websitebezoekers.", firstStep: "Controleer de widgetinstellingen en kennisbron.", href: "/chatbot" },
  { id: "forms", label: "Formulieren", group: "Marketing", summary: "Maak leadformulieren die inzendingen veilig naar CRM brengen.", firstStep: "Maak een formulier en publiceer het pas na controle.", href: "/forms" },
  { id: "knowledge", label: "Kennisbank", group: "Marketing", summary: "Beheer bedrijfsinformatie, diensten en FAQ voor team en AI.", firstStep: "Maak een kennisitem en publiceer het bewust.", href: "/knowledge" },
  { id: "projects", label: "Projecten", group: "Beheer", summary: "Zet een gewonnen verkoopresultaat om naar uitvoerbaar werk.", firstStep: "Start een project vanuit een geaccepteerde offerte.", href: "/projects" },
  { id: "contracts", label: "Contracten", group: "Beheer", summary: "Beheer contractinhoud, versies en ondertekenstatus.", firstStep: "Maak een contract bij een geldig project.", href: "/contracts" },
  { id: "automations", label: "Automatiseringen", group: "Automatisering", summary: "Plan triggers en opvolgacties met dry-run en logging.", firstStep: "Begin met een dry-run voordat je activeert.", href: "/automations" },
  { id: "activityLog", label: "Activiteitenlog", group: "Automatisering", summary: "Bekijk chronologisch wat er in je workspace gebeurde.", firstStep: "Filter op module, gebruiker of periode.", href: "/activity" },
];
