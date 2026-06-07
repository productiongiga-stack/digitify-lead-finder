"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea, Skeleton } from "@digitify/ui";
import { ArrowLeft, Save, Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/feedback/toast-provider";
import { SETTINGS_PAGE_QUERY_OPTS } from "@/lib/settings-query-options";

function isValidEmail(email: string): boolean {
  if (!email) return true; // empty is ok
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone: string): boolean {
  if (!phone) return true; // empty is ok
  return /^[+]?[\d\s\-().]{7,20}$/.test(phone);
}

export default function CompanySettingsPage() {
  const { data: settings, isLoading } = trpc.settings.getCompanySettings.useQuery(undefined, SETTINGS_PAGE_QUERY_OPTS);
  const utils = trpc.useUtils();
  const { showToast } = useToast();

  const batchUpdate = trpc.settings.batchUpdate.useMutation({
    onSuccess: () => {
      utils.settings.getCompanySettings.invalidate();
      setShowSuccess(true);
      showToast({ title: "Bedrijfsgegevens opgeslagen", description: "Deze gegevens zijn bijgewerkt voor dit account." });
      setTimeout(() => setShowSuccess(false), 3000);
    },
    onError: (error) =>
      showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
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
  const [footerBrandName, setFooterBrandName] = useState("");
  const [footerTagline, setFooterTagline] = useState("");
  const [footerDescription, setFooterDescription] = useState("");
  const [footerEmail, setFooterEmail] = useState("");
  const [footerPhone, setFooterPhone] = useState("");
  const [footerLocation, setFooterLocation] = useState("");
  const [footerWebsiteLabel, setFooterWebsiteLabel] = useState("");
  const [footerWebsiteUrl, setFooterWebsiteUrl] = useState("");
  const [footerLegalLine, setFooterLegalLine] = useState("");
  const [footerCopyrightLine, setFooterCopyrightLine] = useState("");
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
      setFooterBrandName(get("company.footer_brand_name", "Digitify Lead Finder"));
      setFooterTagline(get("company.footer_tagline", "Partner in Digital Solutions"));
      setFooterDescription(get("company.footer_description", "Premium lead discovery en opvolging voor bedrijven die digitale groei praktisch willen organiseren."));
      setFooterEmail(get("company.footer_email", "hello@digitify.be"));
      setFooterPhone(get("company.footer_phone", "+32 (0) 486 51 57 73"));
      setFooterLocation(get("company.footer_location", "België"));
      setFooterWebsiteLabel(get("company.footer_website_label", "www.digitify.be"));
      setFooterWebsiteUrl(get("company.footer_website_url", "https://www.digitify.be"));
      setFooterLegalLine(get("company.footer_legal_line", `© ${new Date().getFullYear()} Digitify`));
      setFooterCopyrightLine(get("company.footer_copyright_line", `© ${new Date().getFullYear()} Digitify. Webdesign, media en marketing voor digitale groei.`));
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
      { key: "company.footer_brand_name", value: footerBrandName },
      { key: "company.footer_tagline", value: footerTagline },
      { key: "company.footer_description", value: footerDescription },
      { key: "company.footer_email", value: footerEmail },
      { key: "company.footer_phone", value: footerPhone },
      { key: "company.footer_location", value: footerLocation },
      { key: "company.footer_website_label", value: footerWebsiteLabel },
      { key: "company.footer_website_url", value: footerWebsiteUrl },
      { key: "company.footer_legal_line", value: footerLegalLine },
      { key: "company.footer_copyright_line", value: footerCopyrightLine },
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

      <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
        Juridische gegevens en marketingfooter staan hier. Visuele merknaam, logo en kleuren beheer je onder{" "}
        <Link href="/settings/branding" className="font-medium text-primary underline-offset-2 hover:underline">
          Branding & afzender
        </Link>
        .
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Algemeen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Bedrijfsnaam (juridisch)</Label>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Marketing Footer (website)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label>Footer merknaam</Label>
            <Input value={footerBrandName} onChange={(e) => setFooterBrandName(e.target.value)} placeholder="Digitify Lead Finder" />
          </div>
          <div className="space-y-2">
            <Label>Footer tagline</Label>
            <Input value={footerTagline} onChange={(e) => setFooterTagline(e.target.value)} placeholder="Partner in Digital Solutions" />
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label>Footer beschrijving</Label>
            <Textarea value={footerDescription} onChange={(e) => setFooterDescription(e.target.value)} rows={3} placeholder="Korte premium beschrijving in de footer." />
          </div>
          <div className="space-y-2">
            <Label>Footer e-mail</Label>
            <Input value={footerEmail} onChange={(e) => setFooterEmail(e.target.value)} placeholder="hello@digitify.be" />
          </div>
          <div className="space-y-2">
            <Label>Footer telefoon</Label>
            <Input value={footerPhone} onChange={(e) => setFooterPhone(e.target.value)} placeholder="+32 (0) 486 51 57 73" />
          </div>
          <div className="space-y-2">
            <Label>Footer locatie</Label>
            <Input value={footerLocation} onChange={(e) => setFooterLocation(e.target.value)} placeholder="België" />
          </div>
          <div className="space-y-2">
            <Label>Footer website label</Label>
            <Input value={footerWebsiteLabel} onChange={(e) => setFooterWebsiteLabel(e.target.value)} placeholder="www.digitify.be" />
          </div>
          <div className="space-y-2">
            <Label>Footer website URL</Label>
            <Input value={footerWebsiteUrl} onChange={(e) => setFooterWebsiteUrl(e.target.value)} placeholder="https://www.digitify.be" />
          </div>
          <div className="space-y-2">
            <Label>Footer legal line</Label>
            <Input value={footerLegalLine} onChange={(e) => setFooterLegalLine(e.target.value)} placeholder={`© ${new Date().getFullYear()} Digitify`} />
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label>Footer copyright line</Label>
            <Input value={footerCopyrightLine} onChange={(e) => setFooterCopyrightLine(e.target.value)} placeholder={`© ${new Date().getFullYear()} Digitify. Webdesign, media en marketing voor digitale groei.`} />
          </div>
        </CardContent>
      </Card>

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
