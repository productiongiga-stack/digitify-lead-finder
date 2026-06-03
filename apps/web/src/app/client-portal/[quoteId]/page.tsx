"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(value || 0);
}

export default function ClientPortalPage() {
  const params = useParams<{ quoteId: string }>();
  const search = useSearchParams();
  const token = search.get("token") || "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState<any>(null);
  const [uploading, setUploading] = useState(false);

  const quoteId = String(params.quoteId || "");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/public/portal/${encodeURIComponent(quoteId)}?token=${encodeURIComponent(token)}`);
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Portal laden mislukt.");
      } else {
        setPayload(data);
      }
    } catch {
      setError("Portal laden mislukt.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (quoteId && token) load();
    else setLoading(false);
  }, [quoteId, token]);

  const progress = useMemo(() => {
    if (!payload?.quote) return 0;
    const status = payload.quote.status;
    if (status === "ACCEPTED") return 65;
    if (status === "SENT" || status === "VIEWED") return 40;
    if (status === "DRAFT") return 20;
    return 30;
  }, [payload]);

  async function approveQuote() {
    const response = await fetch(`/api/public/portal/${encodeURIComponent(quoteId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action: "approve" }),
    });
    if (response.ok) {
      load();
      return;
    }
    const data = await response.json().catch(() => ({}));
    setError(data.error || "Offerte goedkeuren mislukt.");
  }

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i] || 0);
      const dataUrl = `data:${file.type || "application/octet-stream"};base64,${btoa(binary)}`;
      const response = await fetch(`/api/public/portal/${encodeURIComponent(quoteId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          action: "upload",
          name: file.name,
          type: file.type,
          dataUrl,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || "Bestand uploaden mislukt.");
        return;
      }
      load();
    } catch {
      setError("Bestand uploaden mislukt.");
    } finally {
      setUploading(false);
    }
  }

  if (!token) {
    return <div className="mx-auto max-w-3xl p-6 text-sm text-destructive">Deze portal-link is onvolledig.</div>;
  }

  if (loading) {
    return <div className="mx-auto max-w-4xl p-6 text-sm text-muted-foreground">Client portal laden...</div>;
  }

  if (error) {
    return <div className="mx-auto max-w-4xl p-6 text-sm text-destructive">{error}</div>;
  }

  const bookingHref = `${payload.bookingEmbedUrl}${payload.bookingEmbedUrl.includes("?") ? "&" : "?"}fromPortal=1`;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{payload.companyName || "Portal"}</p>
        <h1 className="mt-1 text-xl font-semibold">Client portal · {payload.quote.quoteNumber}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hallo {payload.quote.clientName}, hier kan je offerte, boekingen en projectbestanden opvolgen.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Offerte status: {payload.quote.status}</p>
            <p className="text-xs text-muted-foreground">
              Totaal: {formatCurrency(payload.quote.total)} · BTW: {formatCurrency(payload.quote.vatAmount)}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            onClick={approveQuote}
            disabled={payload.quote.status === "ACCEPTED"}
          >
            {payload.quote.status === "ACCEPTED" ? "Al goedgekeurd" : "Offerte goedkeuren"}
          </button>
        </div>
        <div className="mt-3 h-2 rounded-full bg-muted">
          <div className="h-2 rounded-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Offerte detail</h2>
        <div className="mt-2 space-y-1">
          {payload.quote.items.map((item: any) => (
            <div key={item.id} className="flex items-center justify-between text-sm">
              <span>{item.name} ({item.quantity}x)</span>
              <span>{formatCurrency(item.total)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Boek een service</h2>
        <p className="mt-1 text-xs text-muted-foreground">Plan hier meteen je afspraak na goedkeuring.</p>
        <div className="mt-3">
          <Link
            href={bookingHref}
            className="inline-flex rounded-lg border px-3 py-2 text-sm hover:bg-accent"
          >
            Open booking widget
          </Link>
        </div>
        {(payload.bookings || []).length > 0 ? (
          <div className="mt-3 space-y-1">
            {payload.bookings.map((booking: any) => (
              <p key={booking.id} className="text-xs text-muted-foreground">
                {new Date(booking.date).toLocaleString("nl-BE")} · {booking.status}
              </p>
            ))}
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Bestanden</h2>
        <p className="mt-1 text-xs text-muted-foreground">Upload extra bestanden die bij dit project horen.</p>
        <label className="mt-3 inline-flex cursor-pointer rounded-lg border px-3 py-2 text-sm hover:bg-accent">
          Bestand uploaden
          <input
            type="file"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              uploadFile(file);
              event.currentTarget.value = "";
            }}
          />
        </label>
        {uploading ? <p className="mt-2 text-xs text-muted-foreground">Upload bezig...</p> : null}
        {(payload.files || []).length > 0 ? (
          <div className="mt-3 space-y-2">
            {payload.files.map((file: any) => (
              <div key={file.id} className="rounded-lg border p-2 text-xs">
                <p className="font-medium">{file.name}</p>
                <p className="text-muted-foreground">{new Date(file.uploadedAt).toLocaleString("nl-BE")}</p>
                <a href={file.dataUrl} download={file.name} className="text-primary hover:underline">
                  Download
                </a>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
