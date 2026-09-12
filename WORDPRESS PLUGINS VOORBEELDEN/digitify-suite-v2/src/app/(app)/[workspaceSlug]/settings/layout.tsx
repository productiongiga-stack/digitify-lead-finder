import Link from "next/link";
import { Settings, Users, CreditCard, Plug, Palette, Bell, Key } from "lucide-react";

/**
 * Settings shell — Stripe/Vercel style settings layout.
 * Left sidebar with settings sections, content area on the right.
 */

const settingsSections = [
  { label: "Algemeen", href: "general", icon: Settings },
  { label: "Team", href: "team", icon: Users },
  { label: "Branding", href: "branding", icon: Palette },
  { label: "Notificaties", href: "notifications", icon: Bell },
  { label: "Abonnement", href: "billing", icon: CreditCard },
  { label: "Integraties", href: "integrations", icon: Plug },
  { label: "API Keys", href: "api-keys", icon: Key },
];

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">
        Instellingen
      </h1>

      <div className="flex gap-8">
        {/* Settings nav */}
        <nav className="w-48 shrink-0">
          {settingsSections.map((section) => {
            const Icon = section.icon;
            return (
              <Link
                key={section.href}
                href={`/${workspaceSlug}/settings/${section.href}`}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Icon className="h-4 w-4" />
                {section.label}
              </Link>
            );
          })}
        </nav>

        {/* Settings content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
