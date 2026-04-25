"use client";

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Skeleton,
  Input,
  Label,
  Textarea,
  Switch,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@digitify/ui";
import { Plus, FileText, Pencil, Trash2, Sparkles } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { EmailPreview } from "@/components/email/preview";
import { extractEmailTemplateMetadata, injectEmailTemplateMetadata, type EmailLayout } from "@/lib/email-content";

interface TemplateForm {
  name: string;
  subject: string;
  body: string;
  layout: EmailLayout;
  campaignId: string;
  isGlobal: boolean;
}

const EMPTY_FORM: TemplateForm = {
  name: "",
  subject: "",
  body: "",
  layout: "modern",
  campaignId: "",
  isGlobal: false,
};

export default function TemplatesPage() {
  const utils = trpc.useUtils();
  const { data: templates, isLoading } = trpc.contact.listTemplates.useQuery();
  const { data: campaigns } = trpc.campaign.list.useQuery();
  const { data: brandingSettings } = trpc.settings.getAll.useQuery(undefined, { staleTime: 60_000 });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateForm>(EMPTY_FORM);

  const createTemplate = trpc.contact.createTemplate.useMutation({
    onSuccess: () => {
      utils.contact.listTemplates.invalidate();
      closeDialog();
    },
  });

  const updateTemplate = trpc.contact.updateTemplate.useMutation({
    onSuccess: () => {
      utils.contact.listTemplates.invalidate();
      closeDialog();
    },
  });

  const deleteTemplate = trpc.contact.deleteTemplate.useMutation({
    onSuccess: () => {
      utils.contact.listTemplates.invalidate();
      setDeleteDialogOpen(false);
      setDeletingId(null);
    },
  });
  const seedTemplates = trpc.contact.seedDefaultTemplates.useMutation({
    onSuccess: () => {
      utils.contact.listTemplates.invalidate();
    },
  });

  function openCreateDialog() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(template: NonNullable<typeof templates>[number]) {
    const parsed = extractEmailTemplateMetadata(template.body);
    setEditingId(template.id);
    setForm({
      name: template.name,
      subject: template.subject,
      body: parsed.cleanBody,
      layout: parsed.layout || "modern",
      campaignId: template.campaignId || "",
      isGlobal: template.isGlobal,
    });
    setDialogOpen(true);
  }

  function openDeleteDialog(id: string) {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function handleSave() {
    if (!form.name || !form.subject || !form.body) return;

    const data = {
      name: form.name,
      subject: form.subject,
      body: injectEmailTemplateMetadata(form.body, { layout: form.layout }),
      campaignId: form.campaignId || undefined,
      isGlobal: form.isGlobal,
    };

    if (editingId) {
      updateTemplate.mutate({ id: editingId, ...data });
    } else {
      createTemplate.mutate(data);
    }
  }

  function handleDelete() {
    if (!deletingId) return;
    deleteTemplate.mutate({ id: deletingId });
  }

  const isSaving = createTemplate.isPending || updateTemplate.isPending;
  const isFormValid = form.name.trim() && form.subject.trim() && form.body.trim();
  const previewCompanyName = brandingSettings?.["branding.company_name"] ? String(brandingSettings["branding.company_name"]) : "Digitify";
  const previewPrimaryColor = brandingSettings?.["branding.primary_color"] ? String(brandingSettings["branding.primary_color"]) : "#f59e0b";
  const previewHeaderSlogan = brandingSettings?.["email.header_slogan"] ? String(brandingSettings["email.header_slogan"]) : "";
  const templateCards = useMemo(
    () =>
      (templates || []).map((template) => {
        const parsed = extractEmailTemplateMetadata(template.body);
        return { ...template, parsed };
      }),
    [templates],
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">E-mail Templates</h1>
          <p className="text-sm text-muted-foreground">Beheer herbruikbare e-mail templates</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => seedTemplates.mutate()}
            disabled={seedTemplates.isPending}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {seedTemplates.isPending ? "Aanmaken..." : "Standaard pack"}
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Nieuw Template
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : templates?.length === 0 ? (
        <Card>
          <CardContent className="flex h-48 flex-col items-center justify-center">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Nog geen templates</p>
            <Button variant="outline" className="mt-3" onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Maak je eerste template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templateCards.map((template) => (
            <Card
              key={template.id}
              className="hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => openEditDialog(template)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  <div className="flex items-center gap-1">
                    {template.isGlobal && <Badge variant="secondary">Globaal</Badge>}
                    <Badge variant="outline">{template.parsed.layout || "modern"}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium text-muted-foreground mb-2">{template.subject}</p>
                <p className="text-xs text-muted-foreground line-clamp-3">{template.parsed.cleanBody}</p>
                {template.campaign && (
                  <Badge variant="outline" className="mt-3">
                    {template.campaign.name}
                  </Badge>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{formatDate(template.createdAt)}</p>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditDialog(template);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDeleteDialog(template.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Template bewerken" : "Nieuw Template"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Pas de velden aan en sla op."
                : "Vul de velden in om een nieuw e-mail template aan te maken."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="tpl-name">Naam</Label>
              <Input
                id="tpl-name"
                placeholder="Bijv. Eerste contact"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-subject">Onderwerp</Label>
              <Input
                id="tpl-subject"
                placeholder="Onderwerp van de e-mail..."
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-body">Bericht</Label>
              <Textarea
                id="tpl-body"
                placeholder="Gebruik {{companyName}}, {{contactName}}, etc. voor variabelen..."
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                rows={8}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>HTML layout</Label>
              <Select
                value={form.layout}
                onValueChange={(value) => setForm((f) => ({ ...f, layout: value as EmailLayout }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="modern">Modern</SelectItem>
                  <SelectItem value="minimal">Minimalistisch</SelectItem>
                  <SelectItem value="business">Zakelijk</SelectItem>
                  <SelectItem value="proposal">Voorstel</SelectItem>
                  <SelectItem value="followup">Follow-up</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Campagne (optioneel)</Label>
              <Select
                value={form.campaignId || "none"}
                onValueChange={(v) => setForm((f) => ({ ...f, campaignId: v === "none" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Geen campagne" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Geen campagne</SelectItem>
                  {campaigns?.map((c: NonNullable<typeof campaigns>[number]) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.isGlobal}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, isGlobal: checked }))}
              />
              <Label>Globaal template (beschikbaar voor alle campagnes)</Label>
            </div>
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="mb-3 text-sm font-medium">Live preview</p>
              <EmailPreview
                subject={form.subject || "Voorbeeld onderwerp"}
                body={form.body || "Beste {{contactName}},\n\nDit is een voorbeeldmail voor je template.\n\nVriendelijke groeten,\n{{senderName}}"}
                companyName={previewCompanyName}
                primaryColor={previewPrimaryColor}
                fromName={previewCompanyName}
                headerSlogan={previewHeaderSlogan}
                recipientCompany="Voorbeeldbedrijf"
                layout={form.layout}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Annuleren
            </Button>
            <Button onClick={handleSave} disabled={!isFormValid || isSaving}>
              {isSaving ? "Opslaan..." : editingId ? "Bijwerken" : "Aanmaken"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { if (!open) { setDeleteDialogOpen(false); setDeletingId(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Template verwijderen</DialogTitle>
            <DialogDescription>
              Weet je zeker dat je dit template wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteDialogOpen(false); setDeletingId(null); }}>
              Annuleren
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteTemplate.isPending}>
              {deleteTemplate.isPending ? "Verwijderen..." : "Verwijderen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
