"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  EmptyState,
} from "@digitify/ui";
import {
  Building2,
  Plus,
  Search,
  Link2,
  Mail,
  Receipt,
  FileText,
  Send,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Users,
  BadgeCheck,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/feedback/toast-provider";

const SEGMENT_OPTIONS = [
  { value: "ALL", label: "Alle relaties" },
  { value: "CUSTOMERS", label: "Klanten" },
  { value: "PROSPECTS", label: "Prospects" },
] as const;

export default function CrmPage() {
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<(typeof SEGMENT_OPTIONS)[number]["value"]>("ALL");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const { showToast } = useToast();
  const utils = trpc.useUtils();

  const query = trpc.crm.list.useQuery({
    search: search || undefined,
    segment,
    page,
    pageSize: 20,
  });

  const createCustomer = trpc.crm.createCustomer.useMutation({
    onSuccess: (result) => {
      utils.crm.list.invalidate();
      utils.lead.list.invalidate();
      setCreateOpen(false);
      showToast({
        title: result.existed ? "Bestaande klant gevonden" : "Klant aangemaakt",
        description: result.existed
          ? `${result.lead.companyName} bestond al en is gekoppeld in CRM.`
          : `${result.lead.companyName} is toegevoegd als klant.`,
      });
    },
    onError: (error) => {
      showToast({
        title: "Klant aanmaken mislukt",
        description: error.message,
        variant: "error",
      });
    },
  });

  const markAsCustomer = trpc.crm.markAsCustomer.useMutation({
    onSuccess: () => {
      utils.crm.list.invalidate();
      utils.lead.list.invalidate();
      showToast({
        title: "Relatie bijgewerkt",
        description: "De relatie is nu gemarkeerd als klant.",
      });
    },
    onError: (error) => {
      showToast({
        title: "Bijwerken mislukt",
        description: error.message,
        variant: "error",
      });
    },
  });

  const rows = query.data?.items ?? [];
  const stats = query.data?.summary;
  const activeCount = useMemo(
    () => rows.filter((item) => item.crmSegment === "CUSTOMER").length,
    [rows]
  );

  function handleCreateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    createCustomer.mutate({
      companyName: String(form.get("companyName") || ""),
      contactName: String(form.get("contactName") || "") || undefined,
      email: String(form.get("email") || "") || undefined,
      phone: String(form.get("phone") || "") || undefined,
      website: String(form.get("website") || "") || undefined,
      industry: String(form.get("industry") || "") || undefined,
      city: String(form.get("city") || "") || undefined,
      country: String(form.get("country") || "") || undefined,
    });
  }

  return (
    <div className="app-page">
      <div className="app-page-header">
        <div className="app-page-heading">
          <h1 className="app-page-title">CRM</h1>
          <p className="app-page-subtitle">
            Centraal overzicht van klanten en prospects met directe koppelingen naar leads, outbound, offertes en rapporten.
          </p>
        </div>
        <div className="app-page-actions">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nieuwe Klant
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="overview">Overzicht</TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
        </TabsList>

      <TabsContent value="overview" className="space-y-4">
      <Card className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Zoek op bedrijf, e-mail, stad..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
          <Select
            value={segment}
            onValueChange={(value: (typeof SEGMENT_OPTIONS)[number]["value"]) => {
              setSegment(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEGMENT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="secondary" className="h-8 px-3">
            {query.data?.total ?? 0} relaties
          </Badge>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Totaal Klanten</p>
              <p className="text-xl font-semibold">{stats?.totalCustomers ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <CircleDot className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Prospects</p>
              <p className="text-xl font-semibold">{stats?.totalProspects ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <BadgeCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Klanten op deze pagina</p>
              <p className="text-xl font-semibold">{activeCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-blue-500/10 p-2">
              <Link2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cross-module gekoppeld</p>
              <p className="text-xl font-semibold">{rows.filter((row) => row._count.quotes + row._count.emailDrafts + row._count.campaignLeads > 0).length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-0">
          {query.isLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Building2 />}
              title="Geen relaties gevonden"
              description="Maak een klant aan of pas je zoekfilter aan."
            />
          ) : (
            <>
              <div className="grid gap-3 p-3 md:hidden">
                {rows.map((row) => (
                  <div key={row.id} className="rounded-xl border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{row.companyName}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {[row.city, row.country].filter(Boolean).join(", ") || row.email || "Geen locatie"}
                        </p>
                      </div>
                      <Badge variant={row.crmSegment === "CUSTOMER" ? "success" : "warning"}>
                        {row.crmSegment === "CUSTOMER" ? "Klant" : "Prospect"}
                      </Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                      <div className="rounded-lg border bg-muted/20 px-2 py-1.5">Offertes {row._count.quotes}</div>
                      <div className="rounded-lg border bg-muted/20 px-2 py-1.5">Outbound {row._count.emailDrafts}</div>
                      <div className="rounded-lg border bg-muted/20 px-2 py-1.5">Campagnes {row._count.campaignLeads}</div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/leads/${row.id}`}>Open lead</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/contacts/compose?leadId=${row.id}`}>
                          <Send className="mr-1.5 h-3.5 w-3.5" />
                          Outbound
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/quotes/new?leadId=${row.id}`}>
                          <Receipt className="mr-1.5 h-3.5 w-3.5" />
                          Offerte
                        </Link>
                      </Button>
                      {row.crmSegment !== "CUSTOMER" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => markAsCustomer.mutate({ leadId: row.id })}
                          disabled={markAsCustomer.isPending}
                        >
                          Markeer klant
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Relatie</TableHead>
                      <TableHead>Segment</TableHead>
                      <TableHead>Offertes</TableHead>
                      <TableHead>Outbound</TableHead>
                      <TableHead>Campagnes</TableHead>
                      <TableHead>Rapporten</TableHead>
                      <TableHead>Laatste touch</TableHead>
                      <TableHead className="text-right">Acties</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="space-y-0.5">
                            <Link href={`/leads/${row.id}`} className="font-medium hover:text-primary">
                              {row.companyName}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              {[row.city, row.country].filter(Boolean).join(", ") || row.email || "-"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={row.crmSegment === "CUSTOMER" ? "success" : "warning"}>
                            {row.crmSegment === "CUSTOMER" ? "Klant" : "Prospect"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          <p>{row._count.quotes} totaal</p>
                          <p className="text-xs text-muted-foreground">
                            {row.quoteStats.acceptedCount} geaccepteerd
                          </p>
                        </TableCell>
                        <TableCell className="text-sm">
                          <p>{row._count.emailDrafts} drafts</p>
                          <p className="text-xs text-muted-foreground">
                            {row.latestDraft?.status || "Geen"}
                          </p>
                        </TableCell>
                        <TableCell className="text-sm">{row._count.campaignLeads}</TableCell>
                        <TableCell className="text-sm">{row._count.reports}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(row.lastTouchAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/contacts/compose?leadId=${row.id}`}>
                                <Mail className="mr-1.5 h-3.5 w-3.5" />
                                Outbound
                              </Link>
                            </Button>
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/quotes/new?leadId=${row.id}`}>
                                <Receipt className="mr-1.5 h-3.5 w-3.5" />
                                Offerte
                              </Link>
                            </Button>
                            <Button asChild size="sm" variant="ghost">
                              <Link href={`/reports/lead/${row.id}`}>
                                <FileText className="mr-1.5 h-3.5 w-3.5" />
                                Rapport
                              </Link>
                            </Button>
                            {row.crmSegment !== "CUSTOMER" ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => markAsCustomer.mutate({ leadId: row.id })}
                                disabled={markAsCustomer.isPending}
                              >
                                Klant maken
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {query.data && query.data.totalPages > 1 ? (
        <div className="flex items-center justify-between rounded-xl border bg-card px-3 py-2">
          <p className="text-sm text-muted-foreground">
            Pagina {query.data.page} van {query.data.totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={query.data.page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={query.data.page >= query.data.totalPages}
              onClick={() => setPage((prev) => prev + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
      </TabsContent>

      <TabsContent value="info" className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-3">
          <Card className="border-emerald-200 bg-emerald-50/80 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Voor wie</p>
              <p className="mt-2 text-sm font-medium">
                Voor sales en accountteams die klanten, prospects en opvolging centraal willen beheren.
              </p>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50/80 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hoe het werkt</p>
              <p className="mt-2 text-sm font-medium">
                Elke relatie koppelt automatisch met leads, outbound, offertes en rapporten zodat context overal behouden blijft.
              </p>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50/80 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/20">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gerelateerd</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href="/contacts">Outbound</Link>
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <Link href="/quotes">Offertes</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
      </Tabs>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Nieuwe klant toevoegen</DialogTitle>
              <DialogDescription>
                Voeg een klant toe in CRM. De klant wordt als lead aangemaakt en meteen bruikbaar voor offertes, outbound en rapporten.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="companyName">Bedrijfsnaam *</Label>
                <Input id="companyName" name="companyName" required placeholder="Digitify BV" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contactName">Contactpersoon</Label>
                <Input id="contactName" name="contactName" placeholder="Voornaam Naam" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" name="email" type="email" placeholder="klant@bedrijf.be" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Telefoon</Label>
                <Input id="phone" name="phone" placeholder="+32..." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="website">Website</Label>
                <Input id="website" name="website" placeholder="https://..." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="industry">Sector</Label>
                <Input id="industry" name="industry" placeholder="Marketing" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">Stad</Label>
                <Input id="city" name="city" placeholder="Gent" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="country">Land</Label>
                <Input id="country" name="country" placeholder="België" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>
                Annuleren
              </Button>
              <Button type="submit" disabled={createCustomer.isPending}>
                {createCustomer.isPending ? "Aanmaken..." : "Klant toevoegen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
