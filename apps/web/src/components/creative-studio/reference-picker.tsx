"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Label } from "@digitify/ui";
import { Check, ImageIcon, Trash2, X } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { studioSectionClass } from "./creative-studio-ui";

type Props = {
  selectedUrls: string[];
  onChange: (urls: string[]) => void;
  maxItems?: number;
  multi?: boolean;
  label?: string;
};

export function ReferencePicker({
  selectedUrls,
  onChange,
  maxItems = 14,
  multi = true,
  label = "Referentiebibliotheek",
}: Props) {
  const [open, setOpen] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<string[]>(selectedUrls);
  const references = trpc.media.listReferenceUploads.useQuery();
  const removeReference = trpc.media.removeReferenceUpload.useMutation({
    onSuccess: () => void references.refetch(),
  });

  const items = references.data?.items ?? [];

  const orderedSelection = useMemo(() => {
    if (!multi) return selectedUrls.slice(0, 1);
    return selectedUrls;
  }, [multi, selectedUrls]);

  function toggleUrl(url: string) {
    if (!multi) {
      setPendingSelection([url]);
      onChange([url]);
      setOpen(false);
      return;
    }
    setPendingSelection((current) => {
      if (current.includes(url)) return current.filter((entry) => entry !== url);
      if (current.length >= maxItems) return current;
      return [...current, url];
    });
  }

  function applySelection() {
    onChange(pendingSelection.slice(0, maxItems));
    setOpen(false);
  }

  return (
    <div className={studioSectionClass}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Label>{label}</Label>
          <p className="text-xs text-muted-foreground">
            Hergebruik eerder geüploade referenties uit je workspace.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => {
          setPendingSelection(orderedSelection);
          setOpen((value) => !value);
        }}>
          <ImageIcon className="mr-2 h-3.5 w-3.5" />
          Bibliotheek
          {orderedSelection.length ? (
            <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px]">
              {orderedSelection.length}
            </Badge>
          ) : null}
        </Button>
      </div>

      {orderedSelection.length ? (
        <div className="flex flex-wrap gap-2">
          {orderedSelection.map((url, index) => (
            <div key={url} className="relative h-14 w-14 overflow-hidden rounded-lg border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              {multi ? (
                <span className="absolute left-1 top-1 rounded bg-background/90 px-1 text-[10px] font-semibold">
                  {index + 1}
                </span>
              ) : null}
              <button
                type="button"
                className="absolute right-1 top-1 rounded bg-background/90 p-0.5"
                onClick={() => onChange(orderedSelection.filter((entry) => entry !== url))}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {open ? (
        <div className="space-y-3 rounded-xl border bg-background/80 p-3">
          {references.isLoading ? (
            <p className="text-sm text-muted-foreground">Bibliotheek laden...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nog geen uploads. Upload een referentiebeeld om het hier te bewaren.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {items.map((item) => {
                const isSelected = pendingSelection.includes(item.url);
                const order = pendingSelection.indexOf(item.url);
                return (
                  <div key={item.id} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => toggleUrl(item.url)}
                      className={cn(
                        "relative aspect-square w-full overflow-hidden rounded-lg border transition",
                        isSelected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.url} alt={item.filename} className="h-full w-full object-cover" />
                      {isSelected ? (
                        <span className="absolute inset-0 flex items-center justify-center bg-primary/20">
                          {multi ? (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                              {order + 1}
                            </span>
                          ) : (
                            <Check className="h-5 w-5 text-primary" />
                          )}
                        </span>
                      ) : null}
                    </button>
                    <div className="flex items-center justify-between gap-1">
                      <p className="truncate text-[10px] text-muted-foreground">{item.filename}</p>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => removeReference.mutate({ referenceId: item.id })}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {multi ? (
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
                Annuleren
              </Button>
              <Button type="button" size="sm" onClick={applySelection}>
                Gebruik selectie ({pendingSelection.length})
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

    </div>
  );
}
