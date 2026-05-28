"use client";

import Link from "next/link";
import { ChevronRight, Mail, Settings2, SlidersHorizontal } from "lucide-react";
import { useSession } from "next-auth/react";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Tabs, TabsContent, TabsList, TabsTrigger } from "@digitify/ui";
import { SETTINGS_SECTIONS } from "@/lib/navigation";
import { hasRole } from "@/lib/permissions";

export default function SettingsPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const visibleSections = SETTINGS_SECTIONS.filter((section) => !section.allowedRoles || hasRole(role, section.allowedRoles));
  const featuredHrefs = [
    "/settings/account",
    "/settings/integrations",
    "/settings/branding",
    "/settings/email",
  ] as const;
  const featuredSections = [
    ...featuredHrefs
      .map((href) => visibleSections.find((section) => section.href === href))
      .filter((section): section is (typeof visibleSections)[number] => Boolean(section)),
    ...visibleSections.filter((section) => !featuredHrefs.includes(section.href as (typeof featuredHrefs)[number])),
  ].slice(0, 4);
  const groupedSections = {
    essentials: visibleSections.filter((section) =>
      ["/settings/account", "/settings/integrations", "/settings/branding", "/settings/company", "/settings/display", "/settings/performance"].includes(section.href)
    ),
    communication: visibleSections.filter((section) =>
      ["/settings/email", "/settings/ai", "/settings/reviews", "/settings/chatbot", "/settings/feedback"].includes(section.href)
    ),
    operations: visibleSections.filter((section) =>
      ["/settings/bookings", "/settings/quotes", "/settings/pipeline", "/settings/scoring", "/settings/team"].includes(section.href)
    ),
  };
  const domainTabs = [
    { value: "essentials" as const, label: "Basis", icon: SlidersHorizontal },
    { value: "communication" as const, label: "Communicatie", icon: Mail },
    { value: "operations" as const, label: "Operatie", icon: Settings2 },
  ];

  return (
    <div className="app-page">
      <div className="app-page-header">
        <div className="app-page-heading">
        <h1 className="app-page-title">Instellingen</h1>
        <p className="app-page-subtitle">
          Branding, communicatie, integraties en workflows per module.
        </p>
        </div>
      </div>

      <section className="settings-featured" aria-labelledby="settings-featured-heading">
        <div className="relative mb-4 flex flex-wrap items-end justify-between gap-2 sm:mb-5">
          <div className="min-w-0 space-y-0.5">
            <h2 id="settings-featured-heading" className="app-section-title text-base">
              Vaak gebruikt
            </h2>
            <p className="app-section-description">Snel naar je meest gebruikte instellingen</p>
          </div>
          <Badge variant="secondary" className="shrink-0 font-normal">
            {featuredSections.length} snelkoppelingen
          </Badge>
        </div>
        <div className="settings-featured-grid">
          {featuredSections.map((section) => (
            <Link key={section.href} href={section.href} className="settings-featured-card">
              <ChevronRight className="settings-featured-arrow" aria-hidden />
              <div className="settings-featured-icon">
                <section.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 space-y-1 pr-6">
                <p className="text-sm font-semibold leading-snug tracking-tight text-foreground">{section.title}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{section.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <Card className="app-surface">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Instellingen per domein</CardTitle>
          <CardDescription className="text-xs">
            Kies een categorie en open de gewenste instelling.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="essentials" className="space-y-5">
            <TabsList className="settings-domain-tabs settings-domain-tabs-cols-3">
              {domainTabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="settings-domain-tab">
                  <tab.icon className="settings-domain-tab-icon" aria-hidden />
                  <span>{tab.label}</span>
                  <span className="settings-domain-tab-count" aria-label={`${groupedSections[tab.value].length} instellingen`}>
                    {groupedSections[tab.value].length}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>

            {domainTabs.map((tab) => {
              const sections = groupedSections[tab.value];
              return (
                <TabsContent key={tab.value} value={tab.value} className="mt-0 space-y-3 focus-visible:outline-none">
                  <p className="text-xs text-muted-foreground">
                    {sections.length} {sections.length === 1 ? "instelling" : "instellingen"} in {tab.label.toLowerCase()}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {sections.map((section) => (
                      <Link key={section.href} href={section.href} className="settings-featured-card">
                        <ChevronRight className="settings-featured-arrow" aria-hidden />
                        <div className="flex items-center gap-3">
                          <div className="settings-featured-icon h-10 w-10">
                            <section.icon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1 pr-4">
                            <p className="text-sm font-semibold leading-snug tracking-tight">{section.title}</p>
                            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{section.description}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
