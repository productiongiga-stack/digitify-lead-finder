"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Separator,
} from "@digitify/ui";
import { Plus, Trash2, ArrowLeft, PackagePlus, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/feedback/toast-provider";

interface QuoteItem {
  id: string;
  name: string;
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

const CATEGORIES = [
  { value: "webdesign", label: "Webdesign & Development" },
  { value: "media", label: "Media & Content" },
  { value: "marketing", label: "Marketing & Advertising" },
  { value: "extras", label: "Extra Diensten" },
];

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label])
);

export default function NewQuotePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillLeadId = searchParams.get("leadId");

  // Client fields
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientVat, setClientVat] = useState("");
  const [leadId, setLeadId] = useState<string>("");

  // Items
  const [items, setItems] = useState<QuoteItem[]>([
    {
      id: generateId(),
      name: "",
      description: "",
      category: "webdesign",
      quantity: 1,
      unitPrice: 0,
    },
  ]);

  // Other fields
  const [vatRate, setVatRate] = useState("21");
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"fixed" | "percent">("fixed");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState(
    "Deze offerte is 30 dagen geldig vanaf de datum van uitgifte."
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showServiceCatalog, setShowServiceCatalog] = useState(true);
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState<string>("all");
  const { showToast } = useToast();

  // Lead search
  const [leadSearch, setLeadSearch] = useState("");
  const leadsQuery = trpc.lead.list.useQuery(
    { filters: { search: leadSearch }, page: 1, pageSize: 10 },
    { enabled: leadSearch.length > 1 }
  );
  const prefillLeadQuery = trpc.lead.getById.useQuery(
    { id: prefillLeadId || "" },
    { enabled: Boolean(prefillLeadId) }
  );

  // Service catalog
  const servicesQuery = trpc.quote.getServices.useQuery();
  const services = servicesQuery.data ?? [];

  const filteredServices = useMemo(() => {
    if (serviceCategoryFilter === "all") return services;
    return services.filter(
      (s: (typeof services)[number]) => s.category === serviceCategoryFilter
    );
  }, [services, serviceCategoryFilter]);

  const serviceCategories = useMemo(() => {
    const cats = new Set(services.map((s: (typeof services)[number]) => s.category));
    return Array.from(cats);
  }, [services]);

  useEffect(() => {
    if (!prefillLeadId || !prefillLeadQuery.data) return;
    const lead = prefillLeadQuery.data;
    setLeadId(lead.id);
    setLeadSearch(lead.companyName || "");
    setClientCompany((prev) => prev || lead.companyName || "");
    setClientName((prev) => prev || lead.companyName || "");
    setClientEmail((prev) => prev || lead.email || "");
    setClientPhone((prev) => prev || lead.phone || "");
    setClientAddress((prev) => prev || [lead.address, lead.zipCode, lead.city, lead.country].filter(Boolean).join(", "));
  }, [prefillLeadId, prefillLeadQuery.data]);

  const createMutation = trpc.quote.create.useMutation({
    onSuccess: (data) => {
      showToast({ title: "Offerte aangemaakt", description: "De offerte is succesvol opgeslagen." });
      router.push(`/quotes/${data.id}`);
    },
    onError: (error) =>
      showToast({ title: "Offerte opslaan mislukt", description: error.message, variant: "error" }),
  });

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        id: generateId(),
        name: "",
        description: "",
        category: "webdesign",
        quantity: 1,
        unitPrice: 0,
      },
    ]);
  }

  function addServiceAsItem(service: (typeof services)[number]) {
    setItems((prev) => [
      ...prev,
      {
        id: generateId(),
        name: service.name,
        description: service.description || "",
        category: service.category,
        quantity: 1,
        unitPrice: service.basePrice,
      },
    ]);
    showToast({
      title: "Dienst toegevoegd",
      description: `${service.name} is toegevoegd aan de offerte.`,
    });
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function updateItem(id: string, field: keyof QuoteItem, value: string | number) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discountAmount =
    discountType === "percent" ? subtotal * (discount / 100) : discount;
  const afterDiscount = subtotal - discountAmount;
  const vatAmount = afterDiscount * (parseInt(vatRate) / 100);
  const total = afterDiscount + vatAmount;

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!clientName.trim()) {
      newErrors.clientName = "Klantnaam is verplicht";
    }
    if (clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
      newErrors.clientEmail = "Ongeldig e-mailadres";
    }
    const hasValidItem = items.some((item) => item.name.trim() && item.unitPrice > 0);
    if (!hasValidItem) {
      newErrors.items = "Voeg minstens 1 item met naam en prijs toe";
    }
    for (const item of items) {
      if (!item.name.trim()) {
        newErrors[`item_${item.id}_name`] = "Naam is verplicht";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    createMutation.mutate({
      clientName,
      clientEmail: clientEmail || undefined,
      clientPhone: clientPhone || undefined,
      clientCompany: clientCompany || undefined,
      clientAddress: clientAddress || undefined,
      clientVat: clientVat || undefined,
      leadId: leadId || undefined,
      vatRate: parseInt(vatRate),
      notes: notes || undefined,
      terms: terms || undefined,
      items: items
        .filter((item) => item.name.trim())
        .map((item) => ({
          name: item.name,
          description: item.description || undefined,
          category: item.category,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
    });
  }

  // Group items by category for display
  const itemsByCategory = useMemo(() => {
    const grouped: Record<string, QuoteItem[]> = {};
    for (const item of items) {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    }
    return grouped;
  }, [items]);

  const selectedCategorySummary = useMemo(
    () =>
      Object.entries(itemsByCategory).map(([category, categoryItems]) => ({
        category,
        count: categoryItems.length,
      })),
    [itemsByCategory]
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/quotes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Nieuwe Offerte</h1>
            <p className="text-sm text-muted-foreground">
              Maak een nieuwe offerte aan voor je klant
            </p>
          </div>
        </div>
        {/* Sticky total */}
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Totaal incl. BTW</p>
          <p className="text-2xl font-bold">{formatCurrency(total)}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Left column - main content */}
          <div className="lg:col-span-2 space-y-5">
            {/* Client Details */}
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle>Klantgegevens</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="clientName">Naam *</Label>
                    <Input
                      id="clientName"
                      required
                      placeholder="Naam van de klant"
                      value={clientName}
                      onChange={(e) => {
                        setClientName(e.target.value);
                        if (errors.clientName) setErrors((prev) => { const n = { ...prev }; delete n.clientName; return n; });
                      }}
                      className={errors.clientName ? "border-destructive" : ""}
                    />
                    {errors.clientName && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {errors.clientName}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientEmail">E-mail</Label>
                    <Input
                      id="clientEmail"
                      type="email"
                      placeholder="klant@voorbeeld.be"
                      value={clientEmail}
                      onChange={(e) => {
                        setClientEmail(e.target.value);
                        if (errors.clientEmail) setErrors((prev) => { const n = { ...prev }; delete n.clientEmail; return n; });
                      }}
                      className={errors.clientEmail ? "border-destructive" : ""}
                    />
                    {errors.clientEmail && (
                      <p className="text-xs text-destructive">{errors.clientEmail}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientPhone">Telefoon</Label>
                    <Input
                      id="clientPhone"
                      placeholder="+32 123 45 67 89"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientCompany">Bedrijf</Label>
                    <Input
                      id="clientCompany"
                      placeholder="Bedrijfsnaam"
                      value={clientCompany}
                      onChange={(e) => setClientCompany(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientAddress">Adres</Label>
                    <Input
                      id="clientAddress"
                      placeholder="Straat, Postcode, Stad"
                      value={clientAddress}
                      onChange={(e) => setClientAddress(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientVat">BTW Nummer</Label>
                    <Input
                      id="clientVat"
                      placeholder="BE0123.456.789"
                      value={clientVat}
                      onChange={(e) => setClientVat(e.target.value)}
                    />
                  </div>
                </div>

                {/* Link to existing lead */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label>Koppel aan bestaande lead of klant (optioneel)</Label>
                    <div className="flex items-center gap-2">
                      <Button asChild type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs">
                        <Link href="/crm">Open CRM</Link>
                      </Button>
                      <Button asChild type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs">
                        <Link href="/leads/new">Nieuwe relatie</Link>
                      </Button>
                    </div>
                  </div>
                  <Input
                    placeholder="Zoek een lead op naam..."
                    value={leadSearch}
                    onChange={(e) => {
                      setLeadSearch(e.target.value);
                      if (!e.target.value) setLeadId("");
                    }}
                  />
                  {leadSearch.length > 1 && leadsQuery.data?.items && (
                    <div className="rounded-md border bg-popover shadow-sm max-h-48 overflow-y-auto">
                      {leadsQuery.data.items.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-muted-foreground">
                          Geen leads gevonden
                        </p>
                      ) : (
                        leadsQuery.data.items.map((lead: NonNullable<typeof leadsQuery.data>["items"][number]) => (
                          <button
                            key={lead.id}
                            type="button"
                            className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent ${
                              leadId === lead.id ? "bg-accent" : ""
                            }`}
                            onClick={() => {
                              setLeadId(lead.id);
                              setLeadSearch(lead.companyName ?? lead.website ?? "");
                              if (lead.companyName) setClientCompany(lead.companyName);
                              if (!clientName && lead.companyName) setClientName(lead.companyName);
                            }}
                          >
                            <span className="font-medium">
                              {lead.companyName ?? lead.website}
                            </span>
                            {lead.companyName && lead.website && (
                              <span className="text-muted-foreground">{lead.website}</span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  {leadId && (
                    <p className="text-xs text-muted-foreground">
                      Lead gekoppeld.{" "}
                      <button
                        type="button"
                        className="text-primary underline"
                        onClick={() => {
                          setLeadId("");
                          setLeadSearch("");
                        }}
                      >
                        Ontkoppelen
                      </button>
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quote Items */}
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Offerte Configurator</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Stel de offerte visueel samen met klikbare diensten en pas nadien details aan.
                  </p>
                  {errors.items && (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {errors.items}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {services.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowServiceCatalog(!showServiceCatalog)}
                    >
                      <PackagePlus className="mr-2 h-4 w-4" />
                      {showServiceCatalog ? "Verberg configurator" : "Toon configurator"}
                    </Button>
                  )}
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="mr-2 h-4 w-4" />
                    Item Toevoegen
                  </Button>
                </div>
              </CardHeader>

              {/* Service Catalog Panel */}
              {showServiceCatalog && services.length > 0 && (
                <div className="mx-6 mb-4 rounded-lg border bg-muted/30 p-4">
                  {selectedCategorySummary.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {selectedCategorySummary.map((entry) => (
                        <Badge key={entry.category} variant="outline">
                          {CATEGORY_LABELS[entry.category] || entry.category}: {entry.count}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium">Klik op een dienst om die direct toe te voegen</p>
                    <div className="flex gap-1.5">
                      <Button
                        type="button"
                        variant={serviceCategoryFilter === "all" ? "default" : "ghost"}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setServiceCategoryFilter("all")}
                      >
                        Alle
                      </Button>
                      {serviceCategories.map((cat) => (
                        <Button
                          key={cat}
                          type="button"
                          variant={serviceCategoryFilter === cat ? "default" : "ghost"}
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setServiceCategoryFilter(cat)}
                        >
                          {CATEGORY_LABELS[cat] || cat}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {filteredServices.map((service: (typeof services)[number]) => (
                      <button
                        key={service.id}
                        type="button"
                        className="group flex min-h-[132px] flex-col justify-between rounded-2xl border bg-background p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent"
                        onClick={() => addServiceAsItem(service)}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{service.name}</p>
                          {service.description && (
                            <p className="mt-1 max-h-14 overflow-hidden text-xs text-muted-foreground">
                              {service.description}
                            </p>
                          )}
                        </div>
                        <div className="mt-4 flex items-end justify-between gap-3">
                          <div className="shrink-0 text-left">
                            <p className="text-sm font-semibold">
                              Vanaf {formatCurrency(service.basePrice)}
                            </p>
                            {service.unit && (
                              <p className="text-xs text-muted-foreground">
                                per {service.unit}
                              </p>
                            )}
                          </div>
                          <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                            Toevoegen
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                  {filteredServices.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Geen diensten gevonden in deze categorie.
                    </p>
                  )}
                </div>
              )}

              <CardContent className="space-y-4">
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className="rounded-lg border p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">
                          Item {index + 1}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {CATEGORY_LABELS[item.category] || item.category}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {formatCurrency(item.quantity * item.unitPrice)}
                        </span>
                        {items.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => removeItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                      <div className="space-y-2">
                        <Label>Naam *</Label>
                        <Input
                          required
                          placeholder="Naam van het item"
                          value={item.name}
                          onChange={(e) => {
                            updateItem(item.id, "name", e.target.value);
                            const errKey = `item_${item.id}_name`;
                            if (errors[errKey]) setErrors((prev) => { const n = { ...prev }; delete n[errKey]; return n; });
                          }}
                          className={errors[`item_${item.id}_name`] ? "border-destructive" : ""}
                        />
                        {errors[`item_${item.id}_name`] && (
                          <p className="text-xs text-destructive">{errors[`item_${item.id}_name`]}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Categorie</Label>
                        <Select
                          value={item.category}
                          onValueChange={(val) => updateItem(item.id, "category", val)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map((cat) => (
                              <SelectItem key={cat.value} value={cat.value}>
                                {cat.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Beschrijving</Label>
                      <Input
                        placeholder="Korte beschrijving"
                        value={item.description}
                        onChange={(e) => updateItem(item.id, "description", e.target.value)}
                      />
                    </div>
                    <div className="grid gap-3 grid-cols-2">
                      <div className="space-y-2">
                        <Label>Aantal</Label>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(item.id, "quantity", parseInt(e.target.value) || 1)
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Prijs per stuk</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-dashed"
                  onClick={addItem}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Item Toevoegen
                </Button>
              </CardContent>
            </Card>

            {/* Notes & Terms */}
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle>Notities &amp; Voorwaarden</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="notes">Notities</Label>
                  <Textarea
                    id="notes"
                    placeholder="Optionele notities voor de klant..."
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="terms">Voorwaarden</Label>
                  <Textarea
                    id="terms"
                    rows={3}
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column - pricing sidebar */}
          <div className="space-y-5">
            {/* BTW & Korting */}
            <Card className="border-border/50 shadow-sm sticky top-20">
              <CardHeader>
                <CardTitle>Prijsoverzicht</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>BTW Tarief</Label>
                  <Select value={vatRate} onValueChange={setVatRate}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0% BTW</SelectItem>
                      <SelectItem value="6">6% BTW</SelectItem>
                      <SelectItem value="12">12% BTW</SelectItem>
                      <SelectItem value="21">21% BTW</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Korting</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={discount}
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                      placeholder="0,00"
                      className="flex-1"
                    />
                    <Select
                      value={discountType}
                      onValueChange={(v) => setDiscountType(v as "fixed" | "percent")}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">EUR</SelectItem>
                        <SelectItem value="percent">%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                {/* Live Totals */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotaal ({items.length} item{items.length !== 1 ? "s" : ""})</span>
                    <span className="font-medium">{formatCurrency(subtotal)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-destructive">
                      <span>
                        Korting{discountType === "percent" ? ` (${discount}%)` : ""}
                      </span>
                      <span className="font-medium">-{formatCurrency(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">BTW ({vatRate}%)</span>
                    <span className="font-medium">{formatCurrency(vatAmount)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Totaal</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </div>

                <Separator />

                {/* Actions */}
                <div className="space-y-2">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? "Bezig..." : "Offerte Aanmaken"}
                  </Button>
                  <Link href="/quotes" className="block">
                    <Button type="button" variant="outline" className="w-full">
                      Annuleren
                    </Button>
                  </Link>
                </div>

                {createMutation.isError && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Er is een fout opgetreden. Probeer opnieuw.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
