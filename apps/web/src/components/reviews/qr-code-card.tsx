"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "@digitify/ui";
import { Check, Copy, Download, ExternalLink, QrCode } from "lucide-react";
import { safeExternalUrl } from "@/lib/utils";

type ReviewQrCodeCardProps = {
  title: string;
  url: string;
  description?: string;
  filename?: string;
};

export function ReviewQrCodeCard({
  title,
  url,
  description,
  filename = "review-qr",
}: ReviewQrCodeCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const normalizedUrl = useMemo(() => url.trim(), [url]);
  const openLinkUrl = useMemo(() => safeExternalUrl(normalizedUrl), [normalizedUrl]);

  useEffect(() => {
    if (!normalizedUrl) {
      setQrDataUrl("");
      return;
    }

    let cancelled = false;
    void import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(normalizedUrl, {
          width: 240,
          margin: 1,
          color: {
            dark: "#0f172a",
            light: "#ffffff",
          },
        }),
      )
      .then((dataUrl: string) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl("");
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedUrl]);

  function handleCopy() {
    navigator.clipboard.writeText(normalizedUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function handleDownload() {
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `${filename}.png`;
    link.click();
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <QrCode className="h-4 w-4" />
          {title}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-3">
          {qrDataUrl ? (
            <div className="rounded-2xl bg-white p-2 shadow-sm">
              <img
                src={qrDataUrl}
                alt={title}
                className="h-[160px] w-[160px] rounded-xl object-contain sm:h-[180px] sm:w-[180px]"
              />
            </div>
          ) : (
            <div className="flex h-[160px] w-[160px] items-center justify-center rounded-2xl bg-white text-sm text-slate-400 shadow-sm sm:h-[180px] sm:w-[180px]">
              QR laden...
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>QR link</Label>
          <Input value={normalizedUrl} readOnly className="text-[11px]" />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleCopy} disabled={!normalizedUrl}>
            {copied ? <Check className="mr-2 h-3.5 w-3.5" /> : <Copy className="mr-2 h-3.5 w-3.5" />}
            {copied ? "Gekopieerd" : "Kopieer link"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleDownload} disabled={!qrDataUrl}>
            <Download className="mr-2 h-3.5 w-3.5" />
            Download PNG
          </Button>
          {openLinkUrl ? (
            <a href={openLinkUrl} target="_blank" rel="noopener noreferrer">
              <Button type="button" variant="outline" size="sm">
                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                Open link
              </Button>
            </a>
          ) : (
            <Button type="button" variant="outline" size="sm" disabled>
              <ExternalLink className="mr-2 h-3.5 w-3.5" />
              Open link
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
