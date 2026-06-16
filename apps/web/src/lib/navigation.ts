import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Search,
  Users,
  Target,
  SendHorizonal,
  Inbox,
  Settings,
  Calendar,
  Globe2,
  Star,
  MessageSquare,
  MessageSquareWarning,
  Receipt,
  Banknote,
  Gauge,
  Palette,
  Sparkles,
  Key,
  Mail,
  GitBranch,
  Bot,
  Building2,
  SlidersHorizontal,
  Activity,
  CheckSquare,
  ScanSearch,
  Library,
  UserCircle,
  Megaphone,
  BarChart3,
  Layers,
} from "lucide-react";
import { canAccessSettingsPath } from "@/lib/permissions";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  moduleId?: string; // used for per-user module toggle
  activeMatch?: (pathname: string) => boolean;
};

export type QuickNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  moduleId?: string;
};

export const DASHBOARD_NAV_ITEM: NavItem = {
  href: "/dashboard",
  label: "Dashboard",
  icon: LayoutDashboard,
};

export const ADS_NAV_ITEMS: QuickNavItem[] = [
  { href: "/meta-ads", label: "Meta Ads", icon: Megaphone, moduleId: "metaAds" },
  { href: "/google-ads", label: "Google Ads", icon: BarChart3, moduleId: "googleAds" },
];

export type NavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: QuickNavItem[];
  /** Open by default when the sidebar is expanded */
  defaultOpen?: boolean;
};

/** Sidebar groups — ordered top to bottom */
export const SIDEBAR_NAV_GROUPS: NavGroup[] = [
  {
    id: "prospectie",
    label: "Prospectie",
    icon: Users,
    defaultOpen: true,
    items: [
      { href: "/leads", label: "Leads", icon: Users },
      { href: "/leads/search", label: "Leads zoeken", icon: Search },
      { href: "/campaigns", label: "Campagneprofielen", icon: Target, moduleId: "campaigns" },
    ],
  },
  {
    id: "communicatie",
    label: "Communicatie",
    icon: SendHorizonal,
    items: [
      { href: "/contacts", label: "Outbound", icon: SendHorizonal, moduleId: "contacts" },
      { href: "/contacts/inbox", label: "Inbox", icon: Inbox, moduleId: "contacts" },
      { href: "/templates", label: "Standaard berichten", icon: Library, moduleId: "templates" },
    ],
  },
  {
    id: "verkoop",
    label: "Verkoop",
    icon: Receipt,
    items: [
      { href: "/crm", label: "CRM", icon: Building2, moduleId: "crm" },
      { href: "/tasks", label: "Taken", icon: CheckSquare, moduleId: "tasks" },
      { href: "/quotes", label: "Offertes", icon: Receipt, moduleId: "quotes" },
      { href: "/invoices", label: "Facturen", icon: Banknote, moduleId: "invoices" },
    ],
  },
  {
    id: "analyse",
    label: "Analyse",
    icon: ScanSearch,
    items: [{ href: "/reports", label: "Website auditor", icon: ScanSearch, moduleId: "reports" }],
  },
  {
    id: "advertenties",
    label: "Advertenties",
    icon: Megaphone,
    items: ADS_NAV_ITEMS,
  },
  {
    id: "marketing",
    label: "Marketing",
    icon: Globe2,
    items: [
      { href: "/social", label: "Social Planner", icon: Megaphone, moduleId: "social" },
      { href: "/creative-studio", label: "Creative Studio", icon: Sparkles, moduleId: "creativeStudio" },
      { href: "/bookings", label: "Boekingen", icon: Calendar, moduleId: "bookings" },
      { href: "/domains", label: "Domeinen", icon: Globe2, moduleId: "domains" },
      { href: "/reviews", label: "Reviews", icon: Star, moduleId: "reviews" },
      { href: "/chatbot", label: "Chatbot", icon: MessageSquare, moduleId: "chatbot" },
    ],
  },
];

/** Quick links on the leads page (excludes the leads list itself) */
export const LEADS_WORKFLOW_ITEMS: QuickNavItem[] = SIDEBAR_NAV_GROUPS.flatMap((group) =>
  group.items.filter((item) => item.href !== "/leads"),
);

/** @deprecated Use SIDEBAR_NAV_GROUPS — kept for any external imports */
export const LEADS_MENU_ITEMS: QuickNavItem[] = SIDEBAR_NAV_GROUPS.flatMap((group) => group.items);

/** @deprecated Use SIDEBAR_NAV_GROUPS marketing items */
export const TOOL_NAV_ITEMS: NavItem[] = SIDEBAR_NAV_GROUPS.find((g) => g.id === "marketing")!.items.map(
  (item) => ({ ...item }),
);

// All toggleable modules available for owner management
export const ALL_MODULES = [
  { id: "bookings", label: "Boekingen" },
  { id: "campaigns", label: "Campagnes" },
  { id: "social", label: "Social Planner" },
  { id: "creativeStudio", label: "Creative Studio" },
  { id: "metaAds", label: "Meta Ads" },
  { id: "googleAds", label: "Google Ads" },
  { id: "contacts", label: "Outbound / Contacten" },
  { id: "quotes", label: "Offertes" },
  { id: "invoices", label: "Facturen" },
  { id: "reports", label: "Website auditor" },
  { id: "crm", label: "CRM" },
  { id: "tasks", label: "Taken" },
  { id: "templates", label: "Standaard berichten" },
  { id: "domains", label: "Domeinen" },
  { id: "reviews", label: "Reviews" },
  { id: "chatbot", label: "Chatbot" },
] as const;

export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { href: "/settings", label: "Instellingen", icon: Settings },
];

export type SettingsSection = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { href: "/settings/account", title: "Account & Profiel", description: "Naam, profielfoto en wachtwoord", icon: UserCircle },
  { href: "/settings/workspaces", title: "Werkruimtes", description: "Eigen of gedeelde werkruimte, uitnodigingen en teamleden", icon: Layers },
  { href: "/settings/integrations", title: "Integraties & API-sleutels", description: "MuAPI, Google, Meta, AI, SMTP/IMAP en OAuth-koppelingen", icon: Key },
  { href: "/settings/branding", title: "Branding & afzender", description: "Logo, kleuren, favicon en standaard e-mailafzender", icon: Palette },
  { href: "/settings/seo", title: "SEO & vindbaarheid", description: "Titels, meta, sitemap en zoekmachines", icon: Globe2 },
  { href: "/settings/scoring", title: "Scoring-configuratie", description: "Pas scoringgewichten en factoren aan", icon: Gauge },
  { href: "/settings/team", title: "Team & Rollen", description: "Beheer gebruikers en rechten", icon: Users },
  { href: "/settings/email", title: "Mail-opmaak", description: "HTML-shell, handtekening, footer en verzendlimieten", icon: Mail },
  { href: "/settings/analytics", title: "Analytics & tracking", description: "Website trackers, bezoekers en teamgebruik (owner)", icon: BarChart3 },
  { href: "/settings/pipeline", title: "Pipeline-stappen", description: "Beheer je salespipeline", icon: GitBranch },
  { href: "/settings/ai", title: "AI-assistent", description: "Model, taal en tone of voice", icon: Bot },
  { href: "/settings/company", title: "Bedrijfsgegevens", description: "Naam, adres, BTW en KBO", icon: Building2 },
  { href: "/settings/bookings", title: "Boekingswidget", description: "Beschikbaarheid en embed voor afspraken", icon: Calendar },
  { href: "/settings/reviews", title: "Reviewwidget", description: "Reviewlinks, embed en instellingen", icon: Star },
  { href: "/settings/quotes", title: "Offerte-configurator", description: "Sjabloon, teksten en flow", icon: Receipt },
  { href: "/settings/display", title: "Weergave", description: "UI dichtheid en mail/PDF typografie", icon: SlidersHorizontal },
  { href: "/settings/performance", title: "Prestaties & cache", description: "API-metrics, cache-TTL en flush (owner)", icon: Activity },
  { href: "/settings/chatbot", title: "Chatbotwidget", description: "Widgetgedrag en trainingsinstellingen", icon: MessageSquare },
  { href: "/settings/feedback", title: "Feedback", description: "Bekijk en behandel feedback uit de app", icon: MessageSquareWarning },
];

export function filterSettingsSections(role: string | null | undefined) {
  return SETTINGS_SECTIONS.filter((section) => canAccessSettingsPath(role, section.href));
}

type PageTitleRoute = { path: string; title: string };

const PAGE_TITLE_ROUTES: PageTitleRoute[] = [
  { path: "/dashboard", title: "Dashboard" },
  { path: "/leads/search", title: "Leads Zoeken" },
  { path: "/leads/new", title: "Nieuwe Lead" },
  { path: "/leads", title: "Leads" },
  { path: "/campaigns/new", title: "Nieuw campagneprofiel" },
  { path: "/campaigns", title: "Campagneprofielen" },
  { path: "/social", title: "Social Planner" },
  { path: "/creative-studio", title: "Creative Studio" },
  { path: "/settings/creative-studio", title: "Creative Studio instellingen" },
  { path: "/meta-ads", title: "Meta Ads" },
  { path: "/google-ads", title: "Google Ads" },
  { path: "/notifications", title: "Meldingen" },
  { path: "/contacts/inbox", title: "Inbox" },
  { path: "/contacts/compose", title: "Outbound Opstellen" },
  { path: "/contacts/approval", title: "Goedkeuringswachtrij" },
  { path: "/contacts/templates", title: "Template Studio" },
  { path: "/contacts", title: "Outbound Center" },
  { path: "/quotes/new", title: "Nieuwe Offerte" },
  { path: "/quotes", title: "Offertes" },
  { path: "/invoices", title: "Facturen" },
  { path: "/reports", title: "Rapporten" },
  { path: "/crm", title: "CRM" },
  { path: "/tasks", title: "Taken" },
  { path: "/templates", title: "Standaard berichten" },
  { path: "/audit", title: "Website auditor" },
  { path: "/bookings", title: "Boekingen" },
  { path: "/domains", title: "Domeinen" },
  { path: "/reviews", title: "Reviews" },
  { path: "/chatbot/settings", title: "Chatbot Instellingen" },
  { path: "/chatbot", title: "Chatbot" },
  { path: "/settings/integrations", title: "Integraties & API-sleutels" },
  { path: "/settings/account", title: "Account & Profiel" },
  { path: "/settings/workspaces", title: "Werkruimtes" },
  { path: "/settings/branding", title: "Branding" },
  { path: "/settings/seo", title: "SEO & vindbaarheid" },
  { path: "/settings/scoring", title: "Scoring-configuratie" },
  { path: "/settings/team", title: "Team & Rollen" },
  { path: "/settings/email", title: "Mail-opmaak" },
  { path: "/settings/pipeline", title: "Pipeline-stappen" },
  { path: "/settings/ai", title: "AI-assistent" },
  { path: "/settings/company", title: "Bedrijfsgegevens" },
  { path: "/settings/bookings", title: "Boekingswidget" },
  { path: "/settings/reviews", title: "Reviewwidget" },
  { path: "/settings/quotes", title: "Offerte-configurator" },
  { path: "/settings/chatbot", title: "Chatbotwidget" },
  { path: "/settings/feedback", title: "Feedback" },
  { path: "/settings/display", title: "Weergave" },
  { path: "/settings/performance", title: "Prestaties" },
  { path: "/settings", title: "Instellingen" },
];

export function isNavItemActive(item: NavItem, pathname: string) {
  if (item.activeMatch) return item.activeMatch(pathname);
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function resolvePageTitle(pathname: string, fallback: string) {
  const sorted = PAGE_TITLE_ROUTES.slice().sort((a, b) => b.path.length - a.path.length);
  for (const route of sorted) {
    if (pathname === route.path || pathname.startsWith(`${route.path}/`)) {
      return route.title;
    }
  }
  return fallback || "Lead Finder";
}
