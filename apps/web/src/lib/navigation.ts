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
} from "lucide-react";
import type { AppRole } from "@/lib/permissions";

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

export const MAIN_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    href: "/leads",
    label: "Leads",
    icon: Users,
    activeMatch: (pathname) => {
      if (pathname === "/leads" || (pathname.startsWith("/leads/") && !pathname.startsWith("/leads/search"))) return true;
      return LEADS_WORKFLOW_ITEMS.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
    },
  },
];

export const LEADS_WORKFLOW_ITEMS: QuickNavItem[] = [
  { href: "/leads/search", label: "Leads zoeken", icon: Search },
  { href: "/campaigns", label: "Campagneprofielen", icon: Target, moduleId: "campaigns" },
  { href: "/social", label: "Social Planner", icon: Megaphone, moduleId: "social" },
  { href: "/meta-ads", label: "Meta Ads", icon: Megaphone, moduleId: "metaAds" },
  { href: "/google-ads", label: "Google Ads", icon: BarChart3, moduleId: "googleAds" },
  { href: "/contacts", label: "Outbound", icon: SendHorizonal, moduleId: "contacts" },
  { href: "/contacts/inbox", label: "Inbox", icon: Inbox, moduleId: "contacts" },
  { href: "/quotes", label: "Offertes", icon: Receipt, moduleId: "quotes" },
  { href: "/invoices", label: "Facturen", icon: Banknote, moduleId: "invoices" },
  { href: "/reports", label: "Website auditor", icon: ScanSearch, moduleId: "reports" },
  { href: "/crm", label: "CRM", icon: Building2, moduleId: "crm" },
  { href: "/tasks", label: "Taken", icon: CheckSquare, moduleId: "tasks" },
  { href: "/templates", label: "E-mailtemplates", icon: Library, moduleId: "templates" },
];

export const LEADS_MENU_ITEMS: QuickNavItem[] = [
  { href: "/leads", label: "Leads", icon: Users },
  ...LEADS_WORKFLOW_ITEMS,
];

export const TOOL_NAV_ITEMS: NavItem[] = [
  { href: "/bookings", label: "Boekingen", icon: Calendar, moduleId: "bookings" },
  { href: "/domains", label: "Domeinen", icon: Globe2, moduleId: "domains" },
  { href: "/reviews", label: "Reviews", icon: Star, moduleId: "reviews" },
  { href: "/chatbot", label: "Chatbot", icon: MessageSquare, moduleId: "chatbot" },
];

// All toggleable modules available for owner management
export const ALL_MODULES = [
  { id: "bookings", label: "Boekingen" },
  { id: "campaigns", label: "Campagnes" },
  { id: "social", label: "Social Planner" },
  { id: "metaAds", label: "Meta Ads" },
  { id: "googleAds", label: "Google Ads" },
  { id: "contacts", label: "Outbound / Contacten" },
  { id: "quotes", label: "Offertes" },
  { id: "invoices", label: "Facturen" },
  { id: "reports", label: "Website auditor" },
  { id: "crm", label: "CRM" },
  { id: "tasks", label: "Taken" },
  { id: "templates", label: "E-mailtemplates" },
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
  allowedRoles?: AppRole[];
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { href: "/settings/account", title: "Account & Profiel", description: "Naam, profielfoto en wachtwoord", icon: UserCircle, allowedRoles: ["OWNER", "ADMIN", "MODERATOR", "MEMBER", "TRIAL", "TESTER", "VIEWER"] },
  { href: "/settings/integrations", title: "Integraties & API-sleutels", description: "SMTP/IMAP en externe API-verbindingen", icon: Key, allowedRoles: ["OWNER"] },
  { href: "/settings/branding", title: "Branding", description: "Logo, kleuren en huisstijl", icon: Palette, allowedRoles: ["OWNER"] },
  { href: "/settings/seo", title: "SEO & vindbaarheid", description: "Titels, meta, sitemap en zoekmachines", icon: Globe2, allowedRoles: ["OWNER"] },
  { href: "/settings/scoring", title: "Scoring-configuratie", description: "Pas scoringgewichten en factoren aan", icon: Gauge, allowedRoles: ["OWNER", "ADMIN"] },
  { href: "/settings/team", title: "Team & Rollen", description: "Beheer gebruikers en rechten", icon: Users, allowedRoles: ["OWNER", "ADMIN"] },
  { href: "/settings/email", title: "E-mail Instellingen", description: "Afzenderprofiel, layout en signatures", icon: Mail, allowedRoles: ["OWNER"] },
  { href: "/settings/pipeline", title: "Pipeline-stappen", description: "Beheer je salespipeline", icon: GitBranch, allowedRoles: ["OWNER", "ADMIN"] },
  { href: "/settings/ai", title: "AI-assistent", description: "Model, taal en tone of voice", icon: Bot, allowedRoles: ["OWNER"] },
  { href: "/settings/company", title: "Bedrijfsgegevens", description: "Naam, adres, BTW en KBO", icon: Building2, allowedRoles: ["OWNER"] },
  { href: "/settings/bookings", title: "Boekingswidget", description: "Beschikbaarheid en embed voor afspraken", icon: Calendar, allowedRoles: ["OWNER", "ADMIN", "MEMBER"] },
  { href: "/settings/reviews", title: "Reviewwidget", description: "Reviewlinks, embed en instellingen", icon: Star, allowedRoles: ["OWNER", "ADMIN", "MODERATOR", "MEMBER"] },
  { href: "/settings/quotes", title: "Offerte-configurator", description: "Sjabloon, teksten en flow", icon: Receipt, allowedRoles: ["OWNER", "ADMIN", "MEMBER"] },
  { href: "/settings/display", title: "Weergave", description: "UI dichtheid en mail/PDF typografie", icon: SlidersHorizontal, allowedRoles: ["OWNER", "ADMIN", "MODERATOR", "MEMBER", "TESTER", "TRIAL", "VIEWER"] },
  { href: "/settings/performance", title: "Prestaties", description: "Live API- en query-metrics", icon: Activity, allowedRoles: ["OWNER"] },
  { href: "/settings/chatbot", title: "Chatbotwidget", description: "Widgetgedrag en trainingsinstellingen", icon: MessageSquare, allowedRoles: ["OWNER", "ADMIN", "MODERATOR", "MEMBER"] },
  { href: "/settings/feedback", title: "Feedback", description: "Bekijk en behandel feedback uit de app", icon: MessageSquareWarning, allowedRoles: ["OWNER", "ADMIN", "MODERATOR", "MEMBER"] },
];

type PageTitleRoute = { path: string; title: string };

const PAGE_TITLE_ROUTES: PageTitleRoute[] = [
  { path: "/dashboard", title: "Dashboard" },
  { path: "/leads/search", title: "Leads Zoeken" },
  { path: "/leads/new", title: "Nieuwe Lead" },
  { path: "/leads", title: "Leads" },
  { path: "/campaigns/new", title: "Nieuw campagneprofiel" },
  { path: "/campaigns", title: "Campagneprofielen" },
  { path: "/social", title: "Social Planner" },
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
  { path: "/templates", title: "E-mailtemplates" },
  { path: "/audit", title: "Website auditor" },
  { path: "/bookings", title: "Boekingen" },
  { path: "/domains", title: "Domeinen" },
  { path: "/reviews", title: "Reviews" },
  { path: "/chatbot/settings", title: "Chatbot Instellingen" },
  { path: "/chatbot", title: "Chatbot" },
  { path: "/settings/integrations", title: "Integraties & API-sleutels" },
  { path: "/settings/account", title: "Account & Profiel" },
  { path: "/settings/branding", title: "Branding" },
  { path: "/settings/seo", title: "SEO & vindbaarheid" },
  { path: "/settings/scoring", title: "Scoring-configuratie" },
  { path: "/settings/team", title: "Team & Rollen" },
  { path: "/settings/email", title: "E-mail Instellingen" },
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
