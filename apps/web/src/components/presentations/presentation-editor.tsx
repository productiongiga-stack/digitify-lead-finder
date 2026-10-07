"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea } from "@digitify/ui";
import { ArrowLeft, ExternalLink, Link2, Plus, Sparkles, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { userFacingError } from "@/lib/user-facing-error";
import { useToast } from "@/components/feedback/toast-provider";
import { PdfSlideBackground } from "./pdf-slide-background";

type Slide = { id: string; orderIndex: number; title: string | null; body: string | null; backgroundUrl: string | null; sourcePage: number | null; hotspots: Array<{ id: string; targetSlideId: string; label: string | null; x: number; y: number; width: number; height: number }> };

export function PresentationEditor({ id }: { id?: string }) {
  const routerId = id;
  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const existing = trpc.presentation.get.useQuery({ id: routerId! }, { enabled: Boolean(routerId) });
  const create = trpc.presentation.create.useMutation({ onSuccess: (presentation) => { window.location.href = `/presentations/${presentation.id}`; }, onError: (error) => showToast({ title: "Presentatie aanmaken mislukt", description: userFacingError(error, "Controleer de titel en probeer opnieuw."), variant: "error" }) });
  const update = trpc.presentation.update.useMutation({ onSuccess: () => void utils.presentation.get.invalidate({ id: routerId! }), onError: (error) => showToast({ title: "Opslaan mislukt", description: userFacingError(error, "De presentatie kon niet worden opgeslagen."), variant: "error" }) });
  const addSlide = trpc.presentation.addSlide.useMutation({ onSuccess: () => void utils.presentation.get.invalidate({ id: routerId! }), onError: (error) => showToast({ title: "Slide toevoegen mislukt", description: userFacingError(error, "Probeer de slide opnieuw toe te voegen."), variant: "error" }) });
  const updateSlide = trpc.presentation.updateSlide.useMutation({ onSuccess: () => void utils.presentation.get.invalidate({ id: routerId! }), onError: (error) => showToast({ title: "Slide opslaan mislukt", description: userFacingError(error, "Probeer de slide opnieuw op te slaan."), variant: "error" }) });
  const deleteSlide = trpc.presentation.deleteSlide.useMutation({ onSuccess: () => void utils.presentation.get.invalidate({ id: routerId! }) });
  const createHotspot = trpc.presentation.createHotspot.useMutation({ onSuccess: () => void utils.presentation.get.invalidate({ id: routerId! }), onError: (error) => showToast({ title: "Knop toevoegen mislukt", description: userFacingError(error, "Kies een geldige doel-slide."), variant: "error" }) });
  const createShare = trpc.presentation.createShare.useMutation();
  const seedFromPdf = trpc.presentation.seedFromPdf.useMutation({ onSuccess: () => void utils.presentation.get.invalidate({ id: routerId! }) });
  const generateOutline = trpc.presentation.generateOutline.useMutation({ onError: (error) => showToast({ title: "AI-hulp niet beschikbaar", description: userFacingError(error, "Koppel eerst een AI-provider."), variant: "error" }) });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [activeSlideId, setActiveSlideId] = useState<string | null>(null);
  const [brief, setBrief] = useState("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [pdfSeeded, setPdfSeeded] = useState(false);
  const [slideTitle, setSlideTitle] = useState("");
  const [slideBody, setSlideBody] = useState("");

  const presentation = existing.data;
  const slides = useMemo(() => (presentation?.slides ?? []) as Slide[], [presentation?.slides]);
  const active = slides.find((slide) => slide.id === activeSlideId) ?? slides[0];

  useEffect(() => {
    setSlideTitle(active?.title ?? "");
    setSlideBody(active?.body ?? "");
  }, [active?.id, active?.title, active?.body]);

  useEffect(() => {
    const current = presentation;
    if (!current?.sourceFileId || slides.length || pdfSeeded || seedFromPdf.isPending) return;
    let active = true;
    void import("pdfjs-dist/legacy/build/pdf.mjs").then(async (pdfjs) => {
      const response = await fetch(`/api/files/${current.sourceFileId}/preview`);
      if (!response.ok) throw new Error("PDF kan niet worden geladen.");
      const data = await response.arrayBuffer();
      const pdfDocument = await pdfjs.getDocument({ data }).promise;
      if (!active) return;
      setPdfSeeded(true);
      seedFromPdf.mutate({ presentationId: current.id, pageCount: pdfDocument.numPages });
    }).catch(() => { if (active) setPdfSeeded(true); });
    return () => { active = false; };
  }, [pdfSeeded, presentation, seedFromPdf, slides.length]);

  if (!routerId) {
    return <div className="app-page"><Card><CardHeader><CardTitle>Nieuwe presentatie</CardTitle></CardHeader><CardContent className="space-y-4"><Label htmlFor="new-presentation-title">Titel</Label><Input id="new-presentation-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Bijvoorbeeld: Bauvora bedrijfsvoorstelling" /><Label htmlFor="new-presentation-description">Korte omschrijving</Label><Textarea id="new-presentation-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Wat wil je vertellen?" /><div className="flex justify-end"><Button disabled={!title.trim() || create.isPending} onClick={() => create.mutate({ title: title.trim(), description: description.trim() || undefined })}>Start presentatie</Button></div></CardContent></Card></div>;
  }
  if (existing.isLoading) return <div className="app-page"><Card><CardContent className="p-8">Presentatie laden…</CardContent></Card></div>;
  if (!presentation) return <div className="app-page"><Card><CardContent className="p-8">Presentatie niet gevonden.</CardContent></Card></div>;
  const currentPresentation = presentation;

  function saveActiveSlide() {
    if (!active) return;
    updateSlide.mutate({ id: active.id, title: slideTitle, body: slideBody });
  }

  async function share() {
    const result = await createShare.mutateAsync({ presentationId: currentPresentation.id });
    const url = `${window.location.origin}/presentations/share/${result.token}`;
    setShareUrl(url);
    await navigator.clipboard?.writeText(url);
    showToast({ title: "Deellink gemaakt", description: "De link is naar je klembord gekopieerd." });
  }

  function applyOutline() {
    const result = generateOutline.data;
    if (!result) return;
    for (const slide of result.slides) addSlide.mutate({ presentationId: currentPresentation.id, title: slide.title, body: slide.body });
    showToast({ title: "AI-voorstel toegevoegd", description: "Controleer de slides en pas claims aan vóór delen." });
  }

  async function exportPptx() {
    const response = await fetch(`/api/presentations/${currentPresentation.id}/pptx`);
    if (!response.ok) throw new Error("PPTX exporteren mislukt.");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${currentPresentation.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "presentatie"}.pptx`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return <div className="app-page space-y-5">
    <div className="app-page-header flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div className="app-page-heading"><Link href="/presentations" className="mb-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-1 h-4 w-4" />Presentaties</Link><h1 className="app-page-title">{currentPresentation.title}</h1><p className="app-page-subtitle">Werk slides, navigatie en interactieve knoppen uit.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => window.print()}>PDF via afdrukken</Button><Button variant="outline" onClick={() => void exportPptx()} disabled={!slides.length}>PPTX export</Button><Button variant="outline" onClick={() => void share()} disabled={createShare.isPending}><Link2 className="mr-2 h-4 w-4" />Deellink</Button><Button onClick={() => update.mutate({ id: currentPresentation.id, status: "PUBLISHED" })}>Publiceren</Button></div></div>
    {shareUrl ? <Card className="border-emerald-200 bg-emerald-50/60"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"><span className="break-all">{shareUrl}</span><Button size="sm" variant="outline" asChild><a href={shareUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Open reader</a></Button></CardContent></Card> : null}
    <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)_320px]">
      <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">Slides</CardTitle><Button size="icon" variant="outline" onClick={() => addSlide.mutate({ presentationId: presentation.id, title: "Nieuwe slide" })}><Plus className="h-4 w-4" /></Button></CardHeader><CardContent className="space-y-2">{slides.map((slide, index) => <button key={slide.id} type="button" onClick={() => setActiveSlideId(slide.id)} className={`w-full rounded-lg border p-3 text-left text-sm ${active?.id === slide.id ? "border-primary bg-primary/5" : "border-border"}`}><span className="text-xs text-muted-foreground">{index + 1}</span><span className="ml-2 font-medium">{slide.title || "Zonder titel"}</span></button>)}{slides.length === 0 ? <p className="text-sm text-muted-foreground">Voeg je eerste slide toe.</p> : null}</CardContent></Card>
      <Card className="min-h-[520px]"><CardContent className="flex h-full items-center justify-center p-4"><div className="relative aspect-video w-full max-w-4xl overflow-hidden rounded-xl border bg-slate-950 shadow-2xl">{active?.backgroundUrl ? <img src={active.backgroundUrl} alt="" className="absolute inset-0 h-full w-full object-contain" /> : presentation.sourceFileId && active?.sourcePage ? <PdfSlideBackground fileId={presentation.sourceFileId} page={active.sourcePage} /> : <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-primary/60" />}<div className="absolute inset-0 bg-black/10" />{active ? <div className="absolute inset-0 p-8 text-white"><h2 className="max-w-2xl text-3xl font-bold">{active.title || "Titel van de slide"}</h2><p className="mt-4 max-w-2xl whitespace-pre-wrap text-base text-white/85">{active.body || "Voeg tekst toe in het rechterpaneel."}</p>{active.hotspots.map((hotspot) => <button key={hotspot.id} type="button" onClick={() => setActiveSlideId(hotspot.targetSlideId)} className="absolute rounded-md border border-white/70 bg-white/20 px-2 py-1 text-xs backdrop-blur" style={{ left: `${hotspot.x * 100}%`, top: `${hotspot.y * 100}%`, width: `${hotspot.width * 100}%`, height: `${hotspot.height * 100}%` }}>{hotspot.label || "Ga verder"}</button>)}</div> : null}</div></CardContent></Card>
      <div className="space-y-4"><Card><CardHeader><CardTitle className="text-base">Slide bewerken</CardTitle></CardHeader><CardContent className="space-y-3">{active ? <><Label htmlFor="slide-title">Titel</Label><Input id="slide-title" value={slideTitle} onChange={(event) => setSlideTitle(event.target.value)} /><Label htmlFor="slide-body">Tekst</Label><Textarea id="slide-body" rows={8} value={slideBody} onChange={(event) => setSlideBody(event.target.value)} /><Button className="w-full" onClick={saveActiveSlide} disabled={updateSlide.isPending}>Opslaan</Button><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => createHotspot.mutate({ slideId: active.id, targetSlideId: slides.find((slide) => slide.id !== active.id)?.id || active.id, x: 0.72, y: 0.78, width: 0.2, height: 0.08, label: "Volgende" })} disabled={slides.length < 2}><Link2 className="mr-2 h-4 w-4" />Knop toevoegen</Button><Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteSlide.mutate({ id: active.id })}><Trash2 className="mr-2 h-4 w-4" />Verwijder</Button></div></> : <p className="text-sm text-muted-foreground">Selecteer een slide.</p>}</CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" />AI-hulp</CardTitle></CardHeader><CardContent className="space-y-3"><Textarea rows={4} value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="Wat moet deze presentatie uitleggen?" /><Button className="w-full" disabled={brief.trim().length < 10 || generateOutline.isPending} onClick={() => generateOutline.mutate({ presentationId: presentation.id, brief: brief.trim() })}>{generateOutline.isPending ? "Voorstel maken…" : "Maak slidevoorstel"}</Button>{generateOutline.data ? <Button variant="outline" className="w-full" onClick={applyOutline}>Voorstel toevoegen</Button> : null}<p className="text-xs text-muted-foreground">AI maakt een bewerkbaar voorstel. Controleer feiten en cijfers vóór publicatie.</p></CardContent></Card></div>
    </div>
  </div>;
}
