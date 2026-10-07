"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { PdfSlideBackground } from "./pdf-slide-background";

type Slide = { id: string; title: string | null; body: string | null; backgroundUrl: string | null; sourcePage: number | null; hotspots: Array<{ id: string; targetSlideId: string; label: string | null; x: number; y: number; width: number; height: number }> };
type Presentation = { title: string; description: string | null; sourceFileId: string | null; slides: Slide[] };

export function PresentationShareReader({ token }: { token: string }) {
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    fetch(`/api/presentations/share/${encodeURIComponent(token)}`).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Presentatie niet beschikbaar.");
      setPresentation(payload.presentation);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "Presentatie niet beschikbaar."));
  }, [token]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight" || event.key === "PageDown") setIndex((value) => Math.min(value + 1, (presentation?.slides.length ?? 1) - 1));
      if (event.key === "ArrowLeft" || event.key === "PageUp") setIndex((value) => Math.max(value - 1, 0));
      if (event.key === "Home") setIndex(0);
      if (event.key === "End") setIndex(Math.max(0, (presentation?.slides.length ?? 1) - 1));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [presentation?.slides.length]);

  if (error) return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-center text-white"><div><h1 className="text-2xl font-semibold">Presentatie niet beschikbaar</h1><p className="mt-2 text-white/70">{error}</p></div></main>;
  if (!presentation) return <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">Laden…</main>;
  const slide = presentation.slides[index];
  if (!slide) return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">Deze presentatie bevat nog geen slides.</main>;
  const goTo = (id: string) => { const next = presentation.slides.findIndex((candidate) => candidate.id === id); if (next >= 0) setIndex(next); };
  return <main className={`min-h-screen bg-slate-950 text-white ${fullscreen ? "fixed inset-0 z-50" : ""}`}><div className="mx-auto flex min-h-screen max-w-[1600px] flex-col p-3 sm:p-6"><header className="mb-3 flex items-center justify-between gap-3"><div className="min-w-0"><h1 className="truncate text-lg font-semibold sm:text-xl">{presentation.title}</h1><p className="truncate text-xs text-white/60">{index + 1} / {presentation.slides.length}</p></div><button type="button" aria-label={fullscreen ? "Volledig scherm sluiten" : "Volledig scherm"} onClick={() => setFullscreen((value) => !value)} className="rounded-lg border border-white/20 p-2 hover:bg-white/10">{fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button></header><div className="flex flex-1 items-center justify-center"><div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl" tabIndex={0} aria-label={`Slide ${index + 1}`}><div className="absolute inset-0 transition duration-500">{slide.backgroundUrl ? <img src={slide.backgroundUrl} alt="" className="h-full w-full object-contain" /> : presentation.sourceFileId && slide.sourcePage ? <PdfSlideBackground fileId={presentation.sourceFileId} page={slide.sourcePage} shareToken={token} /> : null}<div className="absolute inset-0 bg-black/15" /></div><div className="absolute inset-0 p-7 sm:p-12"><h2 className="max-w-3xl text-3xl font-bold sm:text-5xl">{slide.title || ""}</h2><p className="mt-4 max-w-3xl whitespace-pre-wrap text-sm leading-7 text-white/85 sm:text-lg">{slide.body || ""}</p>{slide.hotspots.map((hotspot) => <button key={hotspot.id} type="button" onClick={() => goTo(hotspot.targetSlideId)} className="absolute rounded-lg border border-white/60 bg-white/15 px-3 py-2 text-xs font-semibold backdrop-blur transition hover:bg-white/30" style={{ left: `${hotspot.x * 100}%`, top: `${hotspot.y * 100}%`, width: `${hotspot.width * 100}%`, height: `${hotspot.height * 100}%` }}>{hotspot.label || "Ga verder"}</button>)}</div></div></div><footer className="mt-4 flex items-center justify-between"><button type="button" onClick={() => setIndex((value) => Math.max(value - 1, 0))} disabled={index === 0} className="inline-flex items-center rounded-lg border border-white/20 px-3 py-2 text-sm disabled:opacity-30"><ChevronLeft className="mr-1 h-4 w-4" />Vorige</button><div className="flex max-w-[60vw] gap-1 overflow-x-auto">{presentation.slides.map((candidate, candidateIndex) => <button key={candidate.id} type="button" aria-label={`Ga naar slide ${candidateIndex + 1}`} onClick={() => setIndex(candidateIndex)} className={`h-2 w-8 rounded-full ${candidateIndex === index ? "bg-white" : "bg-white/25"}`} />)}</div><button type="button" onClick={() => setIndex((value) => Math.min(value + 1, presentation.slides.length - 1))} disabled={index === presentation.slides.length - 1} className="inline-flex items-center rounded-lg border border-white/20 px-3 py-2 text-sm disabled:opacity-30">Volgende<ChevronRight className="ml-1 h-4 w-4" /></button></footer></div></main>;
}
