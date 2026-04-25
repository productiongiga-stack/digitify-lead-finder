"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea, Skeleton } from "@digitify/ui";
import { ArrowLeft, Save, Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";

function isValidEmail(email: string): boolean {
  if (!email) return true; // empty is ok
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone: string): boolean {
  if (!phone) return true; // empty is ok
  return /^[+]?[\d\s\-().]{7,20}$/.test(phone);
}

export default function CompanySettingsPage() {
  const { data: settings, isLoading } = trpc.settings.getAll.useQuery();
  const utils = trpc.useUtils();

  const batchUpdate = trpc.settings.batchUpdate.useMutation({
    onSuccess: () => {
      utils.settings.getAll.invalidate();
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    },
  });

  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [vat, setVat] = useState("");
  const [kbo, setKbo] = useState("");
  const [iban, setIban] = useState("");
  const [niche, setNiche] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings && !loaded) {
      const get = (key: string, fallback = "") => {
        const val = settings[key];
        if (val === null || val === undefined) return fallback;
        return String(val);
      };
      setCompanyName(get("company.name"));
      setWebsite(get("company.website"));
      setPhone(get("company.phone"));
      setEmail(get("company.email"));
      setAddress(get("company.address"));
      setVat(get("company.vat"));
      setKbo(get("company.kbo"));
      setIban(get("company.iban"));
      setNiche(get("company.niche"));
      setLoaded(true);
    }
  }, [settings, loaded]);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (email && !isValidEmail(email)) {
      newErrors.email = "Ongeldig e-mailadres";
    }
    if (phone && !isValidPhone(phone)) {
      newErrors.phone = "Ongeldig telefoonnummer";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSave() {
    if (!validate()) return;

    batchUpdate.mutate([
      { key: "company.name", value: companyName },
      { key: "company.website", value: website },
      { key: "company.phone", value: phone },
      { key: "company.email", value: email },
      { key: "company.address", value: address },
      { key: "company.vat", value: vat },
      { key: "company.kbo", value: kbo },
      { key: "company.iban", value: iban },
      { key: "company.niche", value: niche },
    ]);
  }

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Bedrijfsgegevens</h1>
          <p className="text-sm text-muted-foreground">Je bedrijfsinformatie voor e-mails en documenten</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Algemeen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Bedrijfsnaam</Label>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Mijn Bedrijf BV" />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://www.mijnbedrijf.be" type="url" />
            </div>
            <div className="space-y-2">
              <Label>Telefoon</Label>
              <Input
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (errors.phone) setErrors((prev) => { const n = { ...prev }; delete n.phone; return n; });
                }}
                placeholder="+32 9 123 45 67"
                type="tel"
                className={errors.phone ? "border-destructive" : ""}
              />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => { const n = { ...prev }; delete n.email; return n; });
                }}
                placeholder="info@mijnbedrijf.be"
                type="email"
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Juridisch & Locatie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Adres</Label>
              <Textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Straat 123&#10;9000 Gent&#10;Belgie"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>BTW nummer</Label>
              <Input value={vat} onChange={(e) => setVat(e.target.value)} placeholder="BE0123.456.789" />
            </div>
            <div className="space-y-2">
              <Label>KBO nummer</Label>
              <Input value={kbo} onChange={(e) => setKbo(e.target.value)} placeholder="0123.456.789" />
            </div>
            <div className="space-y-2">
              <Label>Bankrekening (IBAN)</Label>
              <Input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="BE68 5390 0754 7034" />
              <p className="text-xs text-muted-foreground">Wordt getoond op offertes en facturen</p>
            </div>
            <div className="space-y-2">
              <Label>Sector / Niche focus</Label>
              <Input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Bijv. Horeca, Retail, B2B SaaS" />
              <p className="text-xs text-muted-foreground">De sector(en) waarop je je richt met lead generatie</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={batchUpdate.isPending}>
          {batchUpdate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Opslaan
        </Button>
        {showSuccess && (
          <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4" />
            <span>Bedrijfsgegevens opgeslagen</span>
          </div>
        )}
      </div>
    </div>
  );
}
