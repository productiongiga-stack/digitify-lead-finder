import {
  LayoutDashboard,
  Users,
  Building2,
  Target,
  Handshake,
  FileText,
  Receipt,
  Calendar,
  ListTodo,
  ClipboardList,
  Mail,
  Zap,
  BarChart3,
  Settings,
  UserCog,
  Plug,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";

// ============================================================================
// Sidebar Navigation Configuration
//
// Single source of truth for sidebar structure. Used by sidebar component
// and breadcrumb generation.
// ============================================================================

export interface NavItem {
  label: string;
  href: string; // Relative to /app/[workspaceSlug]
  icon: LucideIcon;
  permission?: number; // Required permission bit
  badge?: string;      // Dynamic badge key
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const navigation: NavSection[] = [
  {
    label: "",
    items: [
      { label: "Dashboard", href: "", icon: LayoutDashboard },
    ],
  },
  {
    label: "Relaties",
    items: [
      { label: "Contacten", href: "/contacts", icon: Users },
      { label: "Organisaties", href: "/organizations", icon: Building2 },
    ],
  },
  {
    label: "Pipeline",
    items: [
      { label: "Leads", href: "/leads", icon: Target },
      { label: "Deals", href: "/deals", icon: Handshake },
    ],
  },
  {
    label: "Omzet",
    items: [
      { label: "Offertes", href: "/quotes", icon: FileText },
      { label: "Facturen", href: "/invoices", icon: Receipt },
    ],
  },
  {
    label: "Operaties",
    items: [
      { label: "Planning", href: "/scheduling", icon: Calendar },
      { label: "Planner", href: "/planner", icon: ListTodo },
    ],
  },
  {
    label: "Builders",
    items: [
      { label: "Configurators", href: "/configurators", icon: SlidersHorizontal },
    ],
  },
  {
    label: "Engage",
    items: [
      { label: "Formulieren", href: "/forms", icon: ClipboardList },
      { label: "Templates", href: "/templates", icon: Mail },
      { label: "Automations", href: "/automations", icon: Zap },
    ],
  },
  {
    label: "Inzichten",
    items: [
      { label: "Analytics", href: "/analytics", icon: BarChart3 },
    ],
  },
];

export const bottomNavigation: NavItem[] = [
  { label: "Instellingen", href: "/settings/general", icon: Settings },
  { label: "Team", href: "/settings/team", icon: UserCog },
  { label: "Integraties", href: "/settings/integrations", icon: Plug },
];
