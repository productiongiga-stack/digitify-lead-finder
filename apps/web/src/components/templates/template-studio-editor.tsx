"use client";

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Badge,
  Button,
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
  Switch,
  Textarea,
} from "@digitify/ui";
import { LayoutTemplate } from "lucide-react";
import { EmailPreview } from "@/components/email/preview";
import { MailVariablesHelp } from "@/components/email/mail-variables-help";
import type { EmailLayout, TemplateType } from "@/lib/email-content";
import { LAYOUT_CATALOG, TEMPLATE_TYPES } from "@/lib/template-studio";
import { TemplateScopeHelp } from "@/components/templates/template-scope-help";

export type StudioForm = {
  id?: string;
  name: string;
  subject: string;
  body: string;
  layout: EmailLayout;
  type: TemplateType;
  description: string;
  ctaText: string;
  ctaUrl: string;
  campaignId: string;
  isGlobal: boolean;
};

export const EMPTY_STUDIO_FORM: StudioForm = {
  name: "",
  subject: "",
  body: "",
  layout: "modern",
  type: "OUTREACH",
  description: "",
  ctaText: "",
  ctaUrl: "",
  campaignId: "",
  isGlobal: false,
};

type TemplateStudioEditorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: StudioForm;
  onFormChange: (form: StudioForm) => void;
  onSaved: () => void;
  previewCompanyName: string;
  previewPrimaryColor: string;
  previewHeaderSlogan: string;
};

export function TemplateStudioEditor({
  open,
  onOpenChange,
  form,
  onFormChange,
  onSaved,
  previewCompanyName,
  previewPrimaryColor,
  previewHeaderSlogan,
}: TemplateStudioEditorProps) {
  const utils = trpc.useUtils();
  const { data: campaigns } = trpc.campaign.list.useQuery(undefined, { enabled: open });

  const save = trpc.template.save.useMutation({
    onSuccess: () => {
      utils.template.list.invalidate();
      onSaved();
      onOpenChange(false);
    },
  });

  const isValid = form.name.trim() && form.subject.trim() && form.body.trim();
  const layoutInfo = useMemo(
    () => LAYOUT_CATALOG.find((entry) => entry.id === form.layout),
    [form.layout],
  );

  function insertVariable(key: string) {
    const token = `{{${key}}}`;
    onFormChange({ ...form, body: form.body ? `${form.body}\n${token}` : token });
  }

  function handleSave() {
    if (!isValid) return;
    save.mutate({
      id: form.id,
      name: form.name.trim(),
      subject: form.subject.trim(),
      body: form.body.trim(),
      layout: form.layout,
      type: form.type,
      description: form.description.trim() || undefined,
      ctaText: form.ctaText.trim() || undefined,
      ctaUrl: form.ctaUrl.trim() || undefined,
      campaignId: form.campaignId || null,
      isGlobal: form.isGlobal,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? "Template bewerken" : "Nieuw uniek template"}</DialogTitle>
          <DialogDescription>
            Kies type en layout, schrijf je inhoud en zie direct een unieke preview. Variabelen worden bij verzenden ingevuld.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Naam</Label>
                <Input
                  value={form.name}
                  onChange={(e) => onFormChange({ ...form, name: e.target.value })}
                  placeholder="Bijv. Intro premium outreach"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => onFormChange({ ...form, type: v as TemplateType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_TYPES.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>{entry.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Korte beschrijving</Label>
              <Input
                value={form.description}
                onChange={(e) => onFormChange({ ...form, description: e.target.value })}
                placeholder="Waar gebruik je dit template voor?"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Onderwerp</Label>
              <Input
                value={form.subject}
                onChange={(e) => onFormChange({ ...form, subject: e.target.value })}
                placeholder="Onderwerp met {{companyName}}..."
              />
            </div>

            <div className="space-y-2">
              <Label>HTML layout — elk template kan een eigen look krijgen</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {LAYOUT_CATALOG.map((layout) => (
                  <button
                    key={layout.id}
                    type="button"
                    onClick={() => onFormChange({ ...form, layout: layout.id })}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      form.layout === layout.id
                        ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                        : "border-border/60 hover:border-primary/40"
                    }`}
                  >
                    <div className={`mb-2 h-2 rounded-full bg-gradient-to-r ${layout.accent}`} />
                    <p className="text-sm font-medium">{layout.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{layout.description}</p>
                  </button>
                ))}
              </div>
              {layoutInfo ? (
                <p className="text-xs text-muted-foreground">
                  Aanbevolen voor: {layoutInfo.bestFor.join(", ")}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label>Bericht</Label>
              <Textarea
                rows={10}
                className="font-mono text-sm"
                value={form.body}
                onChange={(e) => onFormChange({ ...form, body: e.target.value })}
                placeholder="Beste {{contactName}}, ..."
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>CTA tekst (optioneel)</Label>
                <Input
                  value={form.ctaText}
                  onChange={(e) => onFormChange({ ...form, ctaText: e.target.value })}
                  placeholder="Plan een gesprek"
                />
              </div>
              <div className="space-y-1.5">
                <Label>CTA URL (optioneel)</Label>
                <Input
                  value={form.ctaUrl}
                  onChange={(e) => onFormChange({ ...form, ctaUrl: e.target.value })}
                  placeholder="{{bookingLink}}"
                />
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-border/60 p-3">
              <p className="text-sm font-medium">Zichtbaarheid in Outbound</p>
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.isGlobal}
                  onCheckedChange={(checked) =>
                    onFormChange({
                      ...form,
                      isGlobal: checked,
                      campaignId: checked ? "" : form.campaignId,
                    })
                  }
                />
                <div className="space-y-0.5">
                  <Label>Alle campagnes</Label>
                  <p className="text-xs text-muted-foreground">
                    Zichtbaar bij elke campagne-filter in compose — ongeacht gekoppelde campagne.
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Campagne-label (optioneel)</Label>
                <Select
                  value={form.campaignId || "none"}
                  disabled={form.isGlobal}
                  onValueChange={(v) => onFormChange({ ...form, campaignId: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Geen campagne" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Geen campagne</SelectItem>
                    {(campaigns ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {form.isGlobal
                    ? "Uitgeschakeld zolang “Alle campagnes” aan staat."
                    : "Alleen voor ordening in Studio; in compose telt vooral “Alle campagnes”."}
                </p>
              </div>
              <TemplateScopeHelp variant="studio" className="border-0 bg-transparent p-0 shadow-none" />
            </div>

            <MailVariablesHelp onInsert={insertVariable} defaultOpen />
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{form.type}</Badge>
              <Badge variant="secondary">{form.layout}</Badge>
              {form.ctaText ? <Badge>CTA</Badge> : null}
              {form.isGlobal ? <Badge variant="outline">Alle campagnes</Badge> : null}
            </div>
            <div className="sticky top-0 rounded-xl border bg-muted/20 p-3">
              <p className="mb-3 flex items-center gap-2 text-sm font-medium">
                <LayoutTemplate className="h-4 w-4" />
                Live preview — {layoutInfo?.label || form.layout}
              </p>
              <EmailPreview
                subject={form.subject || "Voorbeeld onderwerp"}
                body={
                  form.body ||
                  "Beste {{contactName}},\n\nDit is je unieke template preview.\n\n{{senderName}}"
                }
                companyName={previewCompanyName}
                primaryColor={previewPrimaryColor}
                fromName={previewCompanyName}
                headerSlogan={previewHeaderSlogan}
                recipientCompany="Voorbeeldbedrijf BV"
                layout={form.layout}
                ctaText={form.ctaText}
                ctaUrl={form.ctaUrl || "#"}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
          <Button onClick={handleSave} disabled={!isValid || save.isPending}>
            {save.isPending ? "Opslaan..." : form.id ? "Bijwerken" : "Template aanmaken"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function templateToForm(template: {
  id: string;
  name: string;
  subject: string;
  cleanBody: string;
  layout: string;
  type: string;
  description: string;
  ctaText: string;
  ctaUrl: string;
  campaignId: string | null;
  isGlobal: boolean;
}): StudioForm {
  return {
    id: template.id,
    name: template.name,
    subject: template.subject,
    body: template.cleanBody,
    layout: (template.layout as EmailLayout) || "modern",
    type: (template.type as TemplateType) || "CUSTOM",
    description: template.description || "",
    ctaText: template.ctaText || "",
    ctaUrl: template.ctaUrl || "",
    campaignId: template.campaignId || "",
    isGlobal: template.isGlobal,
  };
}

export function starterToForm(starter: {
  name: string;
  type: TemplateType;
  subject: string;
  body: string;
  layout: EmailLayout;
  description: string;
  ctaText?: string;
  ctaUrl?: string;
}): StudioForm {
  return {
    name: starter.name,
    subject: starter.subject,
    body: starter.body,
    layout: starter.layout,
    type: starter.type,
    description: starter.description,
    ctaText: starter.ctaText || "",
    ctaUrl: starter.ctaUrl || "",
    campaignId: "",
    isGlobal: false,
  };
}
