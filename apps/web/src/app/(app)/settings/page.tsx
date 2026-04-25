"use client";

import Link from "next/link";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Tabs, TabsContent, TabsList, TabsTrigger } from "@digitify/ui";
import { SETTINGS_SECTIONS } from "@/lib/navigation";

export default function SettingsPage() {
  const featuredSections = SETTINGS_SECTIONS.slice(0, 3);
  const groupedSections = {
    essentials: SETTINGS_SECTIONS.filter((section) =>
      ["/settings/integrations", "/settings/branding", "/settings/company", "/settings/display"].includes(section.href)
    ),
    communication: SETTINGS_SECTIONS.filter((section) =>
      ["/settings/email", "/settings/ai", "/settings/reviews", "/settings/chatbot", "/settings/feedback"].includes(section.href)
    ),
    operations: SETTINGS_SECTIONS.filter((section) =>
      ["/settings/bookings", "/settings/quotes", "/settings/pipeline", "/settings/scoring", "/settings/team"].includes(section.href)
    ),
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Instellingen</h1>
        <p className="text-sm text-muted-foreground">
          Premium configuratiecentrum voor branding, communicatie, bookingflows en integraties.
        </p>
      </div>

      <div className="grid gap-3 xl:grid-cols-4">
        <Card className="border-border/60 bg-gradient-to-br from-amber-50 to-background shadow-sm dark:from-amber-950/20 dark:to-background">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Settings hub</p>
            <p className="mt-2 text-sm font-medium">Compact, duidelijk en per module gegroepeerd.</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-gradient-to-br from-blue-50 to-background shadow-sm dark:from-blue-950/20 dark:to-background">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Integraties</p>
            <p className="mt-2 text-sm font-medium">SMTP, API-keys en Google Agenda sneller bereikbaar.</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-gradient-to-br from-emerald-50 to-background shadow-sm dark:from-emerald-950/20 dark:to-background">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Communicatie</p>
            <p className="mt-2 text-sm font-medium">Mails, reviews en chatbot met compactere premium UI.</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-gradient-to-br from-violet-50 to-background shadow-sm dark:from-violet-950/20 dark:to-background">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Operatie</p>
            <p className="mt-2 text-sm font-medium">Booking, offertes en pipeline in logische werkblokken.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        {featuredSections.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="h-full cursor-pointer border-border/60 bg-muted/30 transition-all hover:border-primary/20 hover:shadow-md">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <section.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Vaak gebruikt: {section.title}</CardTitle>
                    <CardDescription className="text-xs">{section.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">Instellingen per domein</CardTitle>
            <Badge variant="outline">Tabs</Badge>
          </div>
          <CardDescription className="text-xs">
            Alles is gegroepeerd zodat je minder hoeft te zoeken en sneller de juiste configuratie vindt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="essentials" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="essentials">Basis</TabsTrigger>
              <TabsTrigger value="communication">Communicatie</TabsTrigger>
              <TabsTrigger value="operations">Operatie</TabsTrigger>
            </TabsList>

            {Object.entries(groupedSections).map(([key, sections]) => (
              <TabsContent key={key} value={key} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sections.map((section) => (
                  <Link key={section.href} href={section.href}>
                    <Card className="h-full cursor-pointer border-border/60 transition-all hover:border-primary/30 hover:shadow-md">
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                            <section.icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{section.title}</CardTitle>
                            <CardDescription className="text-xs">{section.description}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  </Link>
                ))}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
