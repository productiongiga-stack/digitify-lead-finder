import Link from "next/link";
import { Search, Target, Mail, Receipt, Calendar, Star } from "lucide-react";

const quickActions = [
  { icon: Search, label: "Zoek Leads", description: "Doorzoek bedrijven", href: "/leads/search" },
  { icon: Target, label: "Nieuwe Campagne", description: "Campagne starten", href: "/campaigns" },
  { icon: Mail, label: "E-mail Opstellen", description: "Contact opnemen", href: "/contacts/compose" },
  { icon: Receipt, label: "Nieuwe Offerte", description: "Offerte configurator", href: "/quotes/new" },
  { icon: Calendar, label: "Boek Afspraak", description: "Planning beheren", href: "/bookings" },
  { icon: Star, label: "Review Aanvragen", description: "Reviews verzamelen", href: "/reviews" },
];

export function DashboardQuickActions() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {quickActions.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className="group flex min-w-0 items-center gap-2 rounded-lg border border-border/50 bg-card p-2 text-left transition-all hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm sm:flex-col sm:gap-1.5 sm:p-2.5 sm:text-center"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20 sm:h-8 sm:w-8">
            <action.icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold leading-tight">{action.label}</p>
            <p className="hidden truncate text-[10px] text-muted-foreground sm:block">{action.description}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
