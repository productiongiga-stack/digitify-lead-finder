"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CreateModal,
  EmptyState,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@digitify/ui";
import { Library, Plus, Trash2 } from "lucide-react";

type TemplateType = "EMAIL" | "QUOTE" | "REPORT" | "CHATBOT" | "FOLLOW_UP" | "ADS";

const TEMPLATE_TYPES: TemplateType[] = ["EMAIL", "QUOTE", "REPORT", "CHATBOT", "FOLLOW_UP", "ADS"];

export default function TemplatesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<TemplateType>("EMAIL");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const utils = trpc.useUtils();
  const list = trpc.template.list.useQuery();

  const create = trpc.template.create.useMutation({
    onSuccess: () => {
      utils.template.list.invalidate();
      setCreateOpen(false);
      setName("");
      setType("EMAIL");
      setSubject("");
      setContent("");
    },
  });
  const remove = trpc.template.remove.useMutation({
    onSuccess: () => utils.template.list.invalidate(),
  });

  const custom = list.data?.custom || [];

  return (
    <div className="app-page">
      <div className="app-page-header">
        <div className="app-page-heading">
          <h1 className="app-page-title">Template Library</h1>
          <p className="app-page-subtitle">Herbruikbare templates voor e-mails, offertes, rapporten, chatbot replies, follow-ups en ads.</p>
        </div>
        <div className="app-page-actions">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nieuw template
          </Button>
        </div>
      </div>

      <Card className="app-surface">
        <CardHeader>
          <CardTitle className="text-sm">Custom templates</CardTitle>
        </CardHeader>
        <CardContent>
          {custom.length === 0 ? (
            <EmptyState
              icon={<Library />}
              title="Geen custom templates"
              description="Voeg templates toe zodat teamleden sneller consistente output maken."
            />
          ) : (
            <div className="grid gap-3">
              {custom.map((item) => (
                <div key={item.id} className="rounded-2xl border border-border/60 bg-background/45 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{item.name}</p>
                        <Badge variant="outline">{item.type}</Badge>
                      </div>
                      {item.subject ? (
                        <p className="mt-1 text-xs text-muted-foreground">Subject: {item.subject}</p>
                      ) : null}
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.content}</p>
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove.mutate({ id: item.id })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="app-surface">
        <CardHeader>
          <CardTitle className="text-sm">Bestaande systeemtemplates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(list.data?.builtIn?.email || []).slice(0, 6).map((item) => (
            <div key={`email-${item.id}`} className="rounded-2xl border border-border/60 bg-background/45 p-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">EMAIL</Badge>
                <p className="text-sm font-medium">{item.name}</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{item.subject}</p>
            </div>
          ))}
          {(list.data?.builtIn?.report || []).slice(0, 4).map((item) => (
            <div key={`report-${item.id}`} className="rounded-2xl border border-border/60 bg-background/45 p-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">REPORT</Badge>
                <p className="text-sm font-medium">{item.name}</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{item.subject}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <CreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Nieuw template"
        description="Maak een herbruikbare template voor je workflows."
        submitLabel="Opslaan"
        submitDisabled={!name.trim() || !content.trim()}
        pending={create.isPending}
        onSubmit={() =>
          create.mutate({
            type,
            name: name.trim(),
            subject: subject.trim() || undefined,
            content: content.trim(),
          })
        }
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(value) => setType(value as TemplateType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEMPLATE_TYPES.map((entry) => (
                  <SelectItem key={entry} value={entry}>{entry}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Naam</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Subject (optioneel)</Label>
            <Input value={subject} onChange={(event) => setSubject(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Content</Label>
            <Textarea rows={8} value={content} onChange={(event) => setContent(event.target.value)} />
          </div>
        </div>
      </CreateModal>
    </div>
  );
}
