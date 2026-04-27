"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@digitify/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@digitify/ui";
import { ArrowLeft, Loader2, Save } from "lucide-react";

const INDUSTRIES = [
  "Horeca",
  "Bouw",
  "Beauty",
  "Automotive",
  "Retail",
  "Healthcare",
  "Legal",
  "Real Estate",
  "Transport",
  "IT & Tech",
  "Tuinaanleg",
  "Print & Media",
  "Onderwijs",
  "Financieel",
  "Andere",
];

export default function NewLeadPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    companyName: "",
    website: "",
    phone: "",
    email: "",
    industry: "",
    city: "",
    state: "",
    country: "België",
    zipCode: "",
    source: "manual",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createLead = trpc.lead.create.useMutation({
    onSuccess: (lead) => {
      router.push(`/leads/${lead.id}`);
    },
  });

  function validate() {
    const newErrors: Record<string, string> = {};
    if (!formData.companyName.trim()) {
      newErrors.companyName = "Bedrijfsnaam is verplicht";
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Ongeldig e-mailadres";
    }
    if (formData.website && !formData.website.startsWith("http")) {
      newErrors.website = "Website moet beginnen met http:// of https://";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const data: Record<string, string | undefined> = {
      companyName: formData.companyName.trim(),
      source: formData.source,
    };
    if (formData.website.trim()) data.website = formData.website.trim();
    if (formData.phone.trim()) data.phone = formData.phone.trim();
    if (formData.email.trim()) data.email = formData.email.trim();
    if (formData.industry) data.industry = formData.industry;
    if (formData.city.trim()) data.city = formData.city.trim();
    if (formData.state.trim()) data.state = formData.state.trim();
    if (formData.country.trim()) data.country = formData.country.trim();
    if (formData.zipCode.trim()) data.zipCode = formData.zipCode.trim();

    createLead.mutate(data as { companyName: string; [key: string]: string | undefined });
  }

  function updateField(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center gap-4">
        <Link href="/leads">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Nieuwe Lead</h1>
          <p className="text-sm text-muted-foreground">
            Voeg handmatig een nieuwe lead toe
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Bedrijfsgegevens</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Company Name */}
            <div className="space-y-2">
              <Label htmlFor="companyName">
                Bedrijfsnaam <span className="text-destructive">*</span>
              </Label>
              <Input
                id="companyName"
                placeholder="bv. Bakkerij De Gouden Aar"
                value={formData.companyName}
                onChange={(e) => updateField("companyName", e.target.value)}
              />
              {errors.companyName && (
                <p className="text-sm text-destructive">{errors.companyName}</p>
              )}
            </div>

            {/* Website & Email */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  placeholder="https://www.voorbeeld.be"
                  value={formData.website}
                  onChange={(e) => updateField("website", e.target.value)}
                />
                {errors.website && (
                  <p className="text-sm text-destructive">{errors.website}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="info@voorbeeld.be"
                  value={formData.email}
                  onChange={(e) => updateField("email", e.target.value)}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>
            </div>

            {/* Phone & Industry */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefoon</Label>
                <Input
                  id="phone"
                  placeholder="+32 9 123 45 67"
                  value={formData.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">Sector</Label>
                <Select
                  value={formData.industry}
                  onValueChange={(v) => updateField("industry", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Kies een sector" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((industry) => (
                      <SelectItem key={industry} value={industry}>
                        {industry}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Address */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="city">Stad</Label>
                <Input
                  id="city"
                  placeholder="bv. Gent"
                  value={formData.city}
                  onChange={(e) => updateField("city", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">Provincie</Label>
                <Input
                  id="state"
                  placeholder="bv. Oost-Vlaanderen"
                  value={formData.state}
                  onChange={(e) => updateField("state", e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="zipCode">Postcode</Label>
                <Input
                  id="zipCode"
                  placeholder="bv. 9000"
                  value={formData.zipCode}
                  onChange={(e) => updateField("zipCode", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Land</Label>
                <Select
                  value={formData.country}
                  onValueChange={(v) => updateField("country", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="België">België</SelectItem>
                    <SelectItem value="Nederland">Nederland</SelectItem>
                    <SelectItem value="Duitsland">Duitsland</SelectItem>
                    <SelectItem value="Frankrijk">Frankrijk</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Source */}
            <div className="space-y-2">
              <Label htmlFor="source">Bron</Label>
              <Select
                value={formData.source}
                onValueChange={(v) => updateField("source", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Handmatig</SelectItem>
                  <SelectItem value="referral">Verwijzing</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="event">Evenement</SelectItem>
                  <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Error message */}
            {createLead.error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {createLead.error.message}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4">
              <Link href="/leads">
                <Button type="button" variant="outline">
                  Annuleren
                </Button>
              </Link>
              <Button type="submit" disabled={createLead.isPending}>
                {createLead.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Lead Opslaan
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
