"use client";

import { useEffect, useState } from "react";

export function PdfSlideBackground({ fileId, page, shareToken }: { fileId: string; page: number; shareToken?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void import("pdfjs-dist/legacy/build/pdf.mjs").then(async (pdfjs) => {
      const response = await fetch(shareToken ? `/api/presentations/share/${encodeURIComponent(shareToken)}/file` : `/api/files/${fileId}/preview`);
      if (!response.ok) throw new Error("PDF kan niet worden geladen.");
      const data = await response.arrayBuffer();
      const pdfDocument = await pdfjs.getDocument({ data }).promise;
      const pdfPage = await pdfDocument.getPage(page);
      const viewport = pdfPage.getViewport({ scale: 1.5 });
      const canvas = globalThis.document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await pdfPage.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }).promise;
      if (active) setSrc(canvas.toDataURL("image/jpeg", 0.9));
    }).catch(() => { if (active) setSrc(null); });
    return () => { active = false; };
  }, [fileId, page, shareToken]);
  return src ? <img src={src} alt="" className="absolute inset-0 h-full w-full object-contain" /> : <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">PDF-pagina laden…</div>;
}
