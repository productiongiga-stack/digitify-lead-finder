"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, HelpCircle, Search } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, Input } from "@digitify/ui";
import { MODULE_HELP } from "@/lib/module-help";

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const items = useMemo(
    () => MODULE_HELP.filter((item) =>
      [item.label, item.group, item.summary, item.firstStep].some((value) => value.toLowerCase().includes(normalizedQuery)),
    ),
    [normalizedQuery],
  );

  return (
    <div className="app-page space-y-5">
      <div className="app-page-header">
        <div className="app-page-heading">
          <p className="app-page-eyebrow"><HelpCircle className="mr-1.5 inline h-4 w-4" /> Wegwijzer</p>
          <h1 className="app-page-title">Hulp per module</h1>
          <p className="app-page-subtitle">Korte uitleg, eerste actie en de juiste plek om te beginnen.</p>
        </div>
      </div>

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Zoek in modules" aria-label="Zoek in modules" className="pl-9" />
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Geen module gevonden voor deze zoekopdracht.</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <Card key={item.id} className="app-surface">
              <CardHeader className="space-y-2 pb-3">
                <Badge variant="outline" className="w-fit">{item.group}</Badge>
                <CardTitle className="text-base">{item.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">{item.summary}</p>
                <p><span className="font-medium">Begin hier:</span> {item.firstStep}</p>
                <Link href={item.href} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                  Open {item.label}<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
