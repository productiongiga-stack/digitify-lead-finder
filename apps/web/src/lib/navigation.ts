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
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  activeMatch?: (pathname: string) => boolean;
};

export const MAIN_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads/search", label: "Lead Zoeken", icon: Search },
  {
    href: "/leads",
    label: "Leads",
    icon: Users,
    activeMatch: (pathname) =>
      pathname === "/leads" || (pathname.startsWith("/leads/") && !pathname.startsWith("/leads/search")),
  },
  { href: "/campaigns", label: "Campagnes", icon: Target },
  { href: "/contacts/inbox", label: "Inbox", icon: Inbox },
  {
    href: "/contacts",
    label: "Outbound",
    icon: SendHorizonal,
    activeMatch: (pathname) =>
      pathname === "/contacts" || (pathname.startsWith("/contacts/") && !pathname.startsWith("/contacts/inbox")),
  },
  { href: "/reports", label: "Rapporten", icon: FileText },
  { href: "/quotes", label: "Offertes", icon: Receipt },
];

export const TOOL_NAV_ITEMS: NavItem[] = [
  { href: "/bookings", label: "Boekingen", icon: Calendar },
  { href: "/domains", label: "Domeinen", icon: Globe2 },
  { href: "/reviews", label: "Reviews", icon: Star },
  { href: "/chatbot", label: "Chatbot", icon: MessageSquare },
];

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
  { href: "/settings/integrations", title: "Integraties & API Keys", description: "SMTP/IMAP + externe API verbindingen", icon: Key },
  { href: "/settings/branding", title: "Branding", description: "Logo, kleuren en huisstijl", icon: Palette },
  { href: "/settings/scoring", title: "Scoring Configuratie", description: "Pas scoring gewichten en factoren aan", icon: Gauge },
  { href: "/settings/team", title: "Team & Rollen", description: "Beheer gebruikers en rechten", icon: Users },
  { href: "/settings/email", title: "E-mail Instellingen", description: "Afzenderprofiel, layout en signatures", icon: Mail },
  { href: "/settings/pipeline", title: "Pipeline Stages", description: "Beheer je sales pipeline stappen", icon: GitBranch },
  { href: "/settings/ai", title: "AI Assistent", description: "Model, taal en tone of voice", icon: Bot },
  { href: "/settings/company", title: "Bedrijfsgegevens", description: "Naam, adres, BTW en KBO", icon: Building2 },
  { href: "/settings/bookings", title: "Booking Widget", description: "Beschikbaarheid en booking embed", icon: Calendar },
  { href: "/settings/reviews", title: "Review Widget", description: "Review links, embed en instellingen", icon: Star },
  { href: "/settings/quotes", title: "Offerte Configurator", description: "Template, teksten en flow", icon: Receipt },
  { href: "/settings/display", title: "Weergave", description: "UI dichtheid en mail/PDF typografie", icon: SlidersHorizontal },
  { href: "/settings/chatbot", title: "Chatbot Widget", description: "Widgetgedrag en trainingsinstellingen", icon: MessageSquare },
  { href: "/settings/feedback", title: "Feedback", description: "Bekijk en behandel feedback uit de app", icon: MessageSquareWarning },
];

type PageTitleRoute = { path: string; title: string };

const PAGE_TITLE_ROUTES: PageTitleRoute[] = [
  { path: "/dashboard", title: "Dashboard" },
  { path: "/leads/search", title: "Lead Zoeken" },
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
  { path: "/reports", title: "Rapporten" },
  { path: "/bookings", title: "Boekingen" },
  { path: "/domains", title: "Domeinen" },
  { path: "/reviews", title: "Reviews" },
  { path: "/chatbot/settings", title: "Chatbot Instellingen" },
  { path: "/chatbot", title: "Chatbot" },
  { path: "/settings/integrations", title: "Integraties & API Keys" },
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
