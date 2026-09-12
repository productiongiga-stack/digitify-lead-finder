export type EditableService = {
  id?: string;
  category: string;
  name: string;
  description: string;
  basePrice: number;
  unit: string;
  sortOrder: number;
  isActive: boolean;
};

/** Curated starting catalogues used by the quote settings editor. */
export const SERVICE_TEMPLATES: Record<string, EditableService[]> = {
  "Digital Agency": [
    { category: "Strategie", name: "Strategische intake", description: "Kick-off, positionering en roadmap.", basePrice: 450, unit: "per traject", sortOrder: 0, isActive: true },
    { category: "Web", name: "Landingspagina", description: "Conversiegerichte pagina met copy en CTA.", basePrice: 950, unit: "per pagina", sortOrder: 1, isActive: true },
    { category: "SEO", name: "SEO basisoptimalisatie", description: "Meta, structuur, snelheid en indexatie.", basePrice: 650, unit: "per site", sortOrder: 2, isActive: true },
    { category: "Ads", name: "Campagne opstart", description: "Tracking, advertentie-setup en eerste tests.", basePrice: 850, unit: "per kanaal", sortOrder: 3, isActive: true },
  ],
  "Zonnepanelen installateur": [
    { category: "Leads", name: "Offerte landingspagina", description: "Pagina voor offerte-aanvragen met vertrouwen en cases.", basePrice: 1200, unit: "per pagina", sortOrder: 0, isActive: true },
    { category: "Leads", name: "Leadformulier integratie", description: "Koppeling naar CRM of inbox.", basePrice: 350, unit: "eenmalig", sortOrder: 1, isActive: true },
    { category: "Local SEO", name: "Google Business optimalisatie", description: "Maps-profiel, reviews en lokale zichtbaarheid.", basePrice: 490, unit: "per maand", sortOrder: 2, isActive: true },
    { category: "Ads", name: "Google Ads leadcampagne", description: "Zoekcampagnes voor regio en type installatie.", basePrice: 950, unit: "per maand", sortOrder: 3, isActive: true },
  ],
  "Horeca / Restaurant": [
    { category: "Website", name: "Menu- en reservatiepagina", description: "Mobielvriendelijke pagina met reservatieflow.", basePrice: 890, unit: "per pagina", sortOrder: 0, isActive: true },
    { category: "Reviews", name: "Review funnel setup", description: "Interne feedbackflow en reviewdoorsturing.", basePrice: 420, unit: "eenmalig", sortOrder: 1, isActive: true },
    { category: "Social", name: "Social contentpakket", description: "Postsjablonen en promotiecampagnes.", basePrice: 650, unit: "per maand", sortOrder: 2, isActive: true },
    { category: "Mail", name: "Nieuwsbrief campagne", description: "Automatische mailflow voor acties en events.", basePrice: 390, unit: "per maand", sortOrder: 3, isActive: true },
  ],
};
