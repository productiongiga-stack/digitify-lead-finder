"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@digitify/ui";
import {
  isImageIcon,
  QUOTE_CONFIGURATOR_EMOJI_OPTIONS,
  type QuoteIconLibraryItem,
} from "@/lib/quote-configurator-utils";
import { ConfiguratorIcon } from "@/components/quotes/quote-embed-layout";

type QuoteIconPickerProps = {
  value: string;
  onChange: (value: string) => void;
  iconLibrary: QuoteIconLibraryItem[];
  placeholder?: string;
  allowUpload?: boolean;
  onUpload?: (file: File) => Promise<void>;
  compact?: boolean;
  className?: string;
};

export function QuoteIconPicker({
  value,
  onChange,
  iconLibrary,
  placeholder = "Icoon kiezen",
  allowUpload = false,
  onUpload,
  compact = false,
  className = "",
}: QuoteIconPickerProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const libraryUrls = new Set(iconLibrary.map((item) => item.url.trim()));

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen((current) => !current);
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || !onUpload) return;
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
        className={`flex w-full cursor-pointer items-center gap-2 rounded-md border border-input bg-background text-left text-sm hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
          compact ? "h-8 px-2" : "h-10 px-3"
        }`}
      >
        <span
          className={`flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/50 ${
            compact ? "h-6 w-6 text-sm" : "h-7 w-7 text-base"
          }`}
        >
          {value ? (
            <ConfiguratorIcon value={value} label={placeholder} />
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {value ? (isImageIcon(value) ? "Afbeelding" : value) : placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
      </div>

      {open ? (
        <div
          id={listId}
          className="absolute left-0 right-0 z-50 mt-1 max-h-[min(320px,70vh)] overflow-y-auto rounded-xl border border-border bg-popover p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-foreground">Emoji</p>
            {value ? (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3 w-3" />
                Geen
              </button>
            ) : null}
          </div>
          <div className="grid grid-cols-8 gap-1 sm:grid-cols-10">
            {QUOTE_CONFIGURATOR_EMOJI_OPTIONS.map((emoji) => {
              const selected = value === emoji;
              return (
                <button
                  key={`emoji-${emoji}`}
                  type="button"
                  title={emoji}
                  onClick={() => {
                    onChange(emoji);
                    setOpen(false);
                  }}
                  className={`flex h-8 w-8 items-center justify-center rounded-md text-base transition hover:bg-muted ${
                    selected ? "bg-primary/15 ring-2 ring-primary/40" : ""
                  }`}
                >
                  {emoji}
                </button>
              );
            })}
          </div>

          {iconLibrary.length > 0 || allowUpload ? (
            <>
              <p className="mb-2 mt-3 text-xs font-semibold text-foreground">Geüploade iconen</p>
              <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
                {iconLibrary.map((item) => {
                  const selected = value === item.url;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      title={item.label || "Icoon"}
                      onClick={() => {
                        onChange(item.url);
                        setOpen(false);
                      }}
                      className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border bg-muted/30 p-1 transition hover:bg-muted ${
                        selected ? "border-primary ring-2 ring-primary/30" : "border-border/70"
                      }`}
                    >
                      <img src={item.url} alt={item.label || ""} className="h-full w-full object-contain" />
                    </button>
                  );
                })}
                {allowUpload && onUpload ? (
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-border/80 bg-muted/20 text-[10px] text-muted-foreground transition hover:bg-muted/50 disabled:opacity-60"
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <ImagePlus className="h-4 w-4" />
                        Upload
                      </>
                    )}
                  </button>
                ) : null}
              </div>
            </>
          ) : null}

          {value && isImageIcon(value) && !libraryUrls.has(value.trim()) ? (
            <div className="mt-3 border-t border-border/60 pt-3">
              <p className="mb-1.5 text-[11px] text-muted-foreground">Huidige afbeelding (niet in bibliotheek)</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-primary ring-2 ring-primary/30"
              >
                <img src={value} alt="" className="h-full w-full object-contain" />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
        className="hidden"
        onChange={(event) => void handleFileChange(event)}
      />
    </div>
  );
}

type QuoteIconLibraryPanelProps = {
  iconLibrary: QuoteIconLibraryItem[];
  onChange: (items: QuoteIconLibraryItem[]) => void;
  onUploadFile: (file: File) => Promise<string | null>;
};

export function QuoteIconLibraryPanel({ iconLibrary, onChange, onUploadFile }: QuoteIconLibraryPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const url = await onUploadFile(file);
      if (!url) return;
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `icon-${Date.now()}`;
      onChange([...iconLibrary, { id, url, label: file.name.replace(/\.[^.]+$/, "") }]);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-muted/15 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Iconenbibliotheek</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Upload PNG, JPG, WebP of SVG. Kies daarna iconen bij categorieën en producten in de configurator.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
          {uploading ? "Uploaden..." : "Icoon uploaden"}
        </Button>
      </div>

      {iconLibrary.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/70 bg-background/60 px-3 py-6 text-center text-xs text-muted-foreground">
          Nog geen iconen. Upload uw eerste icoon om ze in de configurator te kunnen kiezen.
        </p>
      ) : (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
          {iconLibrary.map((item) => (
            <div
              key={item.id}
              className="group relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-background p-2"
            >
              <img src={item.url} alt={item.label || ""} className="h-full w-full object-contain" />
              <button
                type="button"
                title="Verwijderen"
                onClick={() => onChange(iconLibrary.filter((entry) => entry.id !== item.id))}
                className="absolute right-1 top-1 rounded-md bg-background/90 p-0.5 text-muted-foreground opacity-0 shadow-sm transition group-hover:opacity-100 hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
        className="hidden"
        onChange={(event) => void handleUpload(event)}
      />
    </div>
  );
}
