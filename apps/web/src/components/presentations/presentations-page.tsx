"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Input, Skeleton } from "@digitify/ui";
import { FileText, FolderOpen, Plus, Presentation as PresentationIcon, Upload } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { userFacingError } from "@/lib/user-facing-error";
import { useToast } from "@/components/feedback/toast-provider";

async function uploadPdf(file: File) {
  const form = new FormData();
  form.set("file", file);
  form.set("idempotencyKey", `presentation:${file.name}:${file.size}:${file.lastModified}`);
  const response = await fetch("/api/files/upload", { method: "POST", body: form });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "PDF uploaden mislukt.");
  return payload as { id: string };
}

export function PresentationsPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const presentations = trpc.presentation.list.useQuery();
  const create = trpc.presentation.create.useMutation({
    onSuccess: (presentation) => {
      void utils.presentation.list.invalidate();
      window.location.href = `/presentations/${presentation.id}`;
    },
    onError: (error) => showToast({ title: "Presentatie aanmaken mislukt", description: userFacingError(error, "Controleer de titel en probeer opnieuw."), variant: "error" }),
  });

  async function handlePdf(file?: File) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      showToast({ title: "Kies een PDF", description: "Alleen PDF-bestanden kunnen als presentatiebron worden gebruikt.", variant: "error" });
      return;
    }
    try {
      const uploaded = await uploadPdf(file);
      create.mutate({ title: file.name.replace(/\.pdf$/i, ""), sourceFileId: uploaded.id });
    } catch (error) {
      showToast({ title: "PDF uploaden mislukt", description: userFacingError(error, "Probeer het bestand opnieuw te uploaden."), variant: "error" });
    }
  }

  const items = (presentations.data ?? []).filter((item) => item.title.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="app-page space-y-6">
      <div className="app-page-header flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="app-page-heading">
          <div className="mb-2 flex items-center gap-2 text-primary"><PresentationIcon className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wide">Marketing Studio</span></div>
          <h1 className="app-page-title">Presentations</h1>
          <p className="app-page-subtitle">Maak interactieve presentaties met een duidelijk verhaal.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={inputRef} className="sr-only" type="file" accept="application/pdf" onChange={(event) => void handlePdf(event.target.files?.[0])} />
          <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={create.isPending}><Upload className="mr-2 h-4 w-4" />PDF gebruiken</Button>
          <Button asChild><Link href="/presentations/new"><Plus className="mr-2 h-4 w-4" />Nieuwe presentatie</Link></Button>
        </div>
      </div>
      <Card><CardContent className="p-4"><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Zoek presentaties" /></CardContent></Card>
      {presentations.isLoading ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-36 rounded-xl" />)}</div> : items.length === 0 ? <Card><CardContent className="p-0"><EmptyState icon={<FolderOpen />} title="Nog geen presentaties" description="Start met een lege presentatie of upload de Bauvora-PDF." action={<Button asChild><Link href="/presentations/new"><Plus className="mr-2 h-4 w-4" />Eerste presentatie maken</Link></Button>} /></CardContent></Card> : <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{items.map((item) => <Link key={item.id} href={`/presentations/${item.id}`} className="group"><Card className="h-full transition hover:-translate-y-0.5 hover:border-primary/50"><CardHeader><CardTitle className="truncate text-base">{item.title}</CardTitle><p className="text-xs text-muted-foreground">Laatst gewijzigd {new Date(item.updatedAt).toLocaleDateString("nl-BE")}</p></CardHeader><CardContent><div className="flex items-center gap-2 text-sm text-muted-foreground"><FileText className="h-4 w-4" />{item.slides.length ? `${item.slides.length}+ slides` : "Lege presentatie"}</div></CardContent></Card></Link>)}</div>}
    </div>
  );
}
