"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import {
  Button, Card, CardContent, CardHeader, CardTitle,
  Input, Label, Textarea, Skeleton, Switch,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Separator,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@digitify/ui";
import { ArrowLeft, Save, Loader2, Trash2 } from "lucide-react";

const INDUSTRIES = [
  "Horeca", "Bouw", "Transport", "Retail", "Beauty",
  "Gezondheid", "Onderwijs", "IT", "Financiën", "Vastgoed",
  "Landbouw", "Juridisch", "Auto", "Sport", "Voeding", "Anders",
];

const STATUS_OPTIONS = [
  { value: "NEW", label: "Nieuw" },
  { value: "REVIEWED", label: "Bekeken" },
  { value: "CONTACTED", label: "Gecontacteerd" },
  { value: "RESPONDED", label: "Gereageerd" },
  { value: "QUALIFIED", label: "Gekwalificeerd" },
  { value: "PROPOSED", label: "Voorstel verstuurd" },
  { value: "WON", label: "Gewonnen" },
  { value: "LOST", label: "Verloren" },
  { value: "ARCHIVED", label: "Gearchiveerd" },
];

export default function LeadEditPage() {
  const params = useParams<{ id?: string | string[] }>();
  const id = (Array.isArray(params.id) ? params.id[0] : params.id) ?? "";
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: lead, isLoading } = trpc.lead.getById.useQuery({ id });
  const { data: pipelineStages } = trpc.pipeline.getStages.useQuery();
  const { data: users, error: usersError } = trpc.user.list.useQuery(undefined, {
    retry: false,
  });

  const [form, setForm] = useState({
    companyName: "",
    website: "",
    phone: "",
    email: "",
    industry: "",
    address: "",
    city: "",
    country: "",
    facebookUrl: "",
    instagramUrl: "",
    linkedinUrl: "",
    twitterUrl: "",
    status: "NEW",
    pipelineStageId: "",
    assignedToId: "",
    doNotContact: false,
  });
  const [note, setNote] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (lead && !initialized) {
      setForm({
        companyName: lead.companyName || "",
        website: lead.website || "",
        phone: lead.phone || "",
        email: lead.email || "",
        industry: lead.industry || "",
        address: (lead as any).address || "",
        city: lead.city || "",
        country: lead.country || "",
        facebookUrl: lead.facebookUrl || "",
        instagramUrl: lead.instagramUrl || "",
        linkedinUrl: lead.linkedinUrl || "",
        twitterUrl: lead.twitterUrl || "",
        status: lead.status || "NEW",
        pipelineStageId: lead.pipelineStageId || "",
        assignedToId: lead.assignedToId || "",
        doNotContact: lead.doNotContact || false,
      });
      setInitialized(true);
    }
  }, [lead, initialized]);

  const updateLead = trpc.lead.update.useMutation({
    onSuccess: () => {
      utils.lead.getById.invalidate({ id });
      router.push(`/leads/${id}`);
    },
  });

  const addNote = trpc.lead.addNote.useMutation();

  const deleteLead = trpc.lead.delete.useMutation({
    onSuccess: () => {
      router.push("/leads");
    },
  });

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    if (!form.companyName.trim()) return;

    const emailVal = form.email.trim();
    if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) return;

    updateLead.mutate({
      id,
      companyName: form.companyName,
      website: form.website || null,
      phone: form.phone || null,
      email: form.email || null,
      industry: form.industry || null,
      address: form.address || null,
      city: form.city || null,
      country: form.country || null,
      facebookUrl: form.facebookUrl || null,
      instagramUrl: form.instagramUrl || null,
      linkedinUrl: form.linkedinUrl || null,
      twitterUrl: form.twitterUrl || null,
      status: form.status,
      pipelineStageId: form.pipelineStageId || null,
      assignedToId: form.assignedToId || null,
      doNotContact: form.doNotContact,
    });

    if (note.trim()) {
      addNote.mutate({ leadId: id, content: note.trim() });
    }
  }

  function handleDelete() {
    deleteLead.mutate({ id });
  }

  if (isLoading) {
    return (
      <div className="space-y-5 p-1">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-7 w-64" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-lg font-medium text-muted-foreground">Lead niet gevonden</p>
      </div>
    );
  }

  const emailValid = !form.email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-1">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/leads/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Lead bewerken: {lead.companyName}
          </h1>
          <p className="text-sm text-muted-foreground">Pas de gegevens van deze lead aan</p>
        </div>
      </div>

      {/* Company Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Bedrijfsgegevens</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Bedrijfsnaam *</Label>
            <Input
              value={form.companyName}
              onChange={(e) => setField("companyName", e.target.value)}
              placeholder="Bedrijfsnaam"
            />
            {!form.companyName.trim() && (
              <p className="text-xs text-destructive">Bedrijfsnaam is verplicht</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Website</Label>
            <Input
              value={form.website}
              onChange={(e) => setField("website", e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-2">
            <Label>Telefoon</Label>
            <Input
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
              placeholder="+32 ..."
            />
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              placeholder="info@bedrijf.be"
              className={!emailValid ? "border-destructive" : ""}
            />
            {!emailValid && (
              <p className="text-xs text-destructive">Ongeldig e-mailadres</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Sector / Industry</Label>
            <Select value={form.industry} onValueChange={(v) => setField("industry", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Kies sector..." />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map((ind) => (
                  <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Adres</Label>
            <Input
              value={form.address}
              onChange={(e) => setField("address", e.target.value)}
              placeholder="Straat en huisnummer"
            />
          </div>
          <div className="space-y-2">
            <Label>Stad</Label>
            <Input
              value={form.city}
              onChange={(e) => setField("city", e.target.value)}
              placeholder="Stad"
            />
          </div>
          <div className="space-y-2">
            <Label>Land</Label>
            <Input
              value={form.country}
              onChange={(e) => setField("country", e.target.value)}
              placeholder="België"
            />
          </div>
        </CardContent>
      </Card>

      {/* Social Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sociale media</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Facebook URL</Label>
            <Input
              value={form.facebookUrl}
              onChange={(e) => setField("facebookUrl", e.target.value)}
              placeholder="https://facebook.com/..."
            />
          </div>
          <div className="space-y-2">
            <Label>Instagram URL</Label>
            <Input
              value={form.instagramUrl}
              onChange={(e) => setField("instagramUrl", e.target.value)}
              placeholder="https://instagram.com/..."
            />
          </div>
          <div className="space-y-2">
            <Label>LinkedIn URL</Label>
            <Input
              value={form.linkedinUrl}
              onChange={(e) => setField("linkedinUrl", e.target.value)}
              placeholder="https://linkedin.com/company/..."
            />
          </div>
          <div className="space-y-2">
            <Label>Twitter / X URL</Label>
            <Input
              value={form.twitterUrl}
              onChange={(e) => setField("twitterUrl", e.target.value)}
              placeholder="https://x.com/..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Status & Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Status & Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setField("status", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Pipeline fase</Label>
            <Select
              value={form.pipelineStageId || "__none__"}
              onValueChange={(v) => setField("pipelineStageId", v === "__none__" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Geen fase" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Geen fase</SelectItem>
                {pipelineStages?.map((stage: NonNullable<typeof pipelineStages>[number]) => (
                  <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Toegewezen aan</Label>
            {usersError ? (
              <p className="text-xs text-muted-foreground">Geen toegang tot gebruikerslijst</p>
            ) : (
              <Select
                value={form.assignedToId || "__none__"}
                onValueChange={(v) => setField("assignedToId", v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Niemand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Niemand</SelectItem>
                  {users?.map((user: NonNullable<typeof users>[number]) => (
                    <SelectItem key={user.id} value={user.id}>{user.name || user.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Switch
              checked={form.doNotContact}
              onCheckedChange={(v) => setField("doNotContact", v)}
            />
            <Label>Niet contacteren</Label>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Notitie</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Korte notitie bij deze bewerking..."
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button
          onClick={handleSave}
          disabled={updateLead.isPending || !form.companyName.trim() || !emailValid}
        >
          {updateLead.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Opslaan
        </Button>

        {updateLead.isError && (
          <p className="text-sm text-destructive">
            Fout bij opslaan: {updateLead.error.message}
          </p>
        )}

        {updateLead.isSuccess && (
          <p className="text-sm text-emerald-500">Opgeslagen!</p>
        )}
      </div>

      <Separator />

      {/* Delete */}
      <div className="pb-8">
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="mr-2 h-4 w-4" />
              Lead verwijderen
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Lead verwijderen</DialogTitle>
              <DialogDescription>
                Weet je zeker dat je &quot;{lead.companyName}&quot; wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>Annuleren</Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteLead.isPending}
              >
                {deleteLead.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verwijderen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {deleteLead.isError && (
          <p className="mt-2 text-sm text-destructive">
            Fout bij verwijderen: {deleteLead.error.message}
          </p>
        )}
      </div>
    </div>
  );
}
