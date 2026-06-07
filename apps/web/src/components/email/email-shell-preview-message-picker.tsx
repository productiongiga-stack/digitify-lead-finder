"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Input } from "@digitify/ui";
import { Check, ChevronsUpDown, Loader2, Mail, Search } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import {
  buildShellPreviewMessageCatalog,
  findShellPreviewMessage,
  GENERIC_SHELL_PREVIEW_MESSAGE,
  groupShellPreviewMessages,
  type ShellPreviewMessage,
} from "@/lib/email-shell-preview-messages";

type EmailShellPreviewMessagePickerProps = {
  enabled?: boolean;
  value: string;
  onChange: (message: ShellPreviewMessage) => void;
  /** Hide label row — for inline use in preview toolbar */
  compact?: boolean;
};

export function useShellPreviewMessageCatalog(enabled = true) {
  const systemQuery = trpc.template.listSystemMessages.useQuery(undefined, {
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const starterQuery = trpc.template.starterPack.useQuery(undefined, {
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const catalog = useMemo(
    () => buildShellPreviewMessageCatalog(systemQuery.data?.items, starterQuery.data?.items),
    [systemQuery.data?.items, starterQuery.data?.items],
  );

  const groups = useMemo(() => groupShellPreviewMessages(catalog), [catalog]);

  return {
    catalog,
    groups,
    isLoading: systemQuery.isLoading || starterQuery.isLoading,
  };
}

export function EmailShellPreviewMessagePicker({
  enabled = true,
  value,
  onChange,
  compact = false,
}: EmailShellPreviewMessagePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const { groups, catalog, isLoading } = useShellPreviewMessageCatalog(enabled);
  const selected = findShellPreviewMessage(catalog, value);

  const filteredGroups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return groups;
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.label.toLowerCase().includes(needle) ||
            item.subject.toLowerCase().includes(needle) ||
            item.id.toLowerCase().includes(needle),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, query]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className={compact ? "relative" : "relative space-y-1.5"}>
      {compact ? null : (
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
            Voorbeeldbericht
          </label>
          <Link
            href="/templates"
            className="text-[10px] font-medium text-primary underline-offset-2 hover:underline"
          >
            Standaard berichten
          </Link>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-8 items-center gap-2 rounded-md border border-border/70 bg-background px-2.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Berichten laden…
        </div>
      ) : (
        <>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
            className={[
              "w-full justify-between bg-background px-2 text-xs font-normal",
              compact ? "h-7" : "h-8",
            ].join(" ")}
          >
            <span className="truncate">{selected.label}</span>
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>

          {open ? (
            <div className="absolute left-0 right-0 top-[calc(100%-4px)] z-50 mt-1 overflow-hidden rounded-md border border-border bg-background shadow-lg">
              <div className="border-b border-border/60 p-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Zoek op naam of onderwerp…"
                    className="h-8 pl-8 text-xs"
                    autoFocus
                  />
                </div>
              </div>
              <div className="max-h-[min(280px,45vh)] overflow-y-auto p-1">
                {filteredGroups.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-muted-foreground">Geen berichten gevonden.</p>
                ) : (
                  filteredGroups.map((group) => (
                    <div key={group.label} className="py-1">
                      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {group.label}
                      </p>
                      {group.items.map((item) => {
                        const active = item.id === value;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              onChange(findShellPreviewMessage(catalog, item.id));
                              setOpen(false);
                              setQuery("");
                            }}
                            className={[
                              "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                              active ? "bg-primary/10 text-primary" : "hover:bg-muted/60",
                            ].join(" ")}
                          >
                            <Check
                              className={[
                                "mt-0.5 h-3.5 w-3.5 shrink-0",
                                active ? "opacity-100" : "opacity-0",
                              ].join(" ")}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block font-medium">{item.label}</span>
                              {item.subject ? (
                                <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                                  {item.subject}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </>
      )}

      {!compact && selected.id !== GENERIC_SHELL_PREVIEW_MESSAGE.id ? (
        <p className="line-clamp-1 text-[10px] text-muted-foreground">
          Onderwerp: {selected.subject || "—"}
        </p>
      ) : null}
    </div>
  );
}
