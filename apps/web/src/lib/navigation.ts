import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Search,
  Users,
  Target,
  SendHorizonal,
  Inbox,
  FileText,
  Settings,
  Calendar,
  Globe2,
  Star,
  MessageSquare,
  MessageSquareWarning,
  Receipt,
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
} from "lucide-react";
import type { AppRole } from "@/lib/permissions";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  activeMatch?: (pathname: string) => boolean;
};

export type QuickNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
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
  { href: "/campaigns", label: "Campagnes", icon: Target },
  { href: "/contacts", label: "Outbound", icon: SendHorizonal },
  { href: "/contacts/inbox", label: "Inbox", icon: Inbox },
  { href: "/quotes", label: "Offertes", icon: Receipt },
  { href: "/invoices", label: "Facturen", icon: Receipt },
  { href: "/reports", label: "Rapporten", icon: FileText },
  { href: "/crm", label: "CRM", icon: Building2 },
  { href: "/tasks", label: "Taken", icon: CheckSquare },
  { href: "/templates", label: "Templates", icon: Library },
];

export const LEADS_MENU_ITEMS: QuickNavItem[] = [
  { href: "/leads", label: "Leads", icon: Users },
  ...LEADS_WORKFLOW_ITEMS,
];

export const TOOL_NAV_ITEMS: NavItem[] = [
  { href: "/bookings", label: "Boekingen", icon: Calendar },
  { href: "/domains", label: "Domeinen", icon: Globe2 },
  { href: "/reviews", label: "Reviews", icon: Star },
  { href: "/chatbot", label: "Chatbot", icon: MessageSquare },
  { href: "/audit", label: "Website Audit", icon: ScanSearch },
];

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
  { href: "/settings/integrations", title: "Integraties & API Keys", description: "SMTP/IMAP + externe API verbindingen", icon: Key, allowedRoles: ["OWNER"] },
  { href: "/settings/branding", title: "Branding", description: "Logo, kleuren en huisstijl", icon: Palette, allowedRoles: ["OWNER"] },
  { href: "/settings/scoring", title: "Scoring Configuratie", description: "Pas scoring gewichten en factoren aan", icon: Gauge, allowedRoles: ["OWNER", "ADMIN"] },
  { href: "/settings/team", title: "Team & Rollen", description: "Beheer gebruikers en rechten", icon: Users, allowedRoles: ["OWNER", "ADMIN"] },
  { href: "/settings/email", title: "E-mail Instellingen", description: "Afzenderprofiel, layout en signatures", icon: Mail, allowedRoles: ["OWNER"] },
  { href: "/settings/pipeline", title: "Pipeline Stages", description: "Beheer je sales pipeline stappen", icon: GitBranch, allowedRoles: ["OWNER", "ADMIN"] },
  { href: "/settings/ai", title: "AI Assistent", description: "Model, taal en tone of voice", icon: Bot, allowedRoles: ["OWNER"] },
  { href: "/settings/company", title: "Bedrijfsgegevens", description: "Naam, adres, BTW en KBO", icon: Building2, allowedRoles: ["OWNER"] },
  { href: "/settings/bookings", title: "Booking Widget", description: "Beschikbaarheid en booking embed", icon: Calendar, allowedRoles: ["OWNER", "ADMIN", "MEMBER"] },
  { href: "/settings/reviews", title: "Review Widget", description: "Review links, embed en instellingen", icon: Star, allowedRoles: ["OWNER", "ADMIN", "MODERATOR", "MEMBER"] },
  { href: "/settings/quotes", title: "Offerte Configurator", description: "Template, teksten en flow", icon: Receipt, allowedRoles: ["OWNER", "ADMIN", "MEMBER"] },
  { href: "/settings/display", title: "Weergave", description: "UI dichtheid en mail/PDF typografie", icon: SlidersHorizontal, allowedRoles: ["OWNER", "ADMIN", "MODERATOR", "MEMBER", "TESTER", "TRIAL", "VIEWER"] },
  { href: "/settings/performance", title: "Performance", description: "Live API/query metrics en bottlenecks", icon: Activity, allowedRoles: ["OWNER"] },
  { href: "/settings/chatbot", title: "Chatbot Widget", description: "Widgetgedrag en trainingsinstellingen", icon: MessageSquare, allowedRoles: ["OWNER", "ADMIN", "MODERATOR", "MEMBER"] },
  { href: "/settings/feedback", title: "Feedback", description: "Bekijk en behandel feedback uit de app", icon: MessageSquareWarning, allowedRoles: ["OWNER", "ADMIN", "MODERATOR", "MEMBER"] },
];

type PageTitleRoute = { path: string; title: string };

const PAGE_TITLE_ROUTES: PageTitleRoute[] = [
  { path: "/dashboard", title: "Dashboard" },
  { path: "/leads/search", title: "Leads Zoeken" },
  { path: "/leads/new", title: "Nieuwe Lead" },
  { path: "/leads", title: "Leads" },
  { path: "/campaigns/new", title: "Nieuwe Campagne" },
  { path: "/campaigns", title: "Campagnes" },
  { path: "/contacts/inbox", title: "Inbox" },
  { path: "/contacts/compose", title: "Outbound Opstellen" },
  { path: "/contacts/approval", title: "Goedkeuringswachtrij" },
  { path: "/contacts/templates", title: "E-mail Templates" },
  { path: "/contacts", title: "Outbound Center" },
  { path: "/quotes/new", title: "Nieuwe Offerte" },
  { path: "/quotes", title: "Offertes" },
  { path: "/invoices", title: "Facturen" },
  { path: "/reports", title: "Rapporten" },
  { path: "/crm", title: "CRM" },
  { path: "/tasks", title: "Taken" },
  { path: "/templates", title: "Template Library" },
  { path: "/audit", title: "Website Audit" },
  { path: "/bookings", title: "Boekingen" },
  { path: "/domains", title: "Domeinen" },
  { path: "/reviews", title: "Reviews" },
  { path: "/chatbot/settings", title: "Chatbot Instellingen" },
  { path: "/chatbot", title: "Chatbot" },
  { path: "/settings/integrations", title: "Integraties & API Keys" },
  { path: "/settings/account", title: "Account & Profiel" },
  { path: "/settings/branding", title: "Branding" },
  { path: "/settings/scoring", title: "Scoring Configuratie" },
  { path: "/settings/team", title: "Team & Rollen" },
  { path: "/settings/email", title: "E-mail Instellingen" },
  { path: "/settings/pipeline", title: "Pipeline Stages" },
  { path: "/settings/ai", title: "AI Assistent" },
  { path: "/settings/company", title: "Bedrijfsgegevens" },
  { path: "/settings/bookings", title: "Booking Widget" },
  { path: "/settings/reviews", title: "Review Widget" },
  { path: "/settings/quotes", title: "Offerte Configurator" },
  { path: "/settings/chatbot", title: "Chatbot Widget" },
  { path: "/settings/feedback", title: "Feedback" },
  { path: "/settings/display", title: "Weergave" },
  { path: "/settings/performance", title: "Performance" },
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
