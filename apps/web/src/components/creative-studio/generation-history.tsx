"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@digitify/ui";
import { Download, ExternalLink, ImageIcon, Megaphone, RefreshCcw, Trash2, Video } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useToast } from "@/components/feedback/toast-provider";
import { LIBRARY_SAVE_LABEL } from "./constants";
import {
  CreativeEmptyState,
  HistorySectionHeader,
  studioCardClass,
} from "./creative-studio-ui";
import { cn } from "@/lib/utils";

const HISTORY_QUERY_OPTIONS = {
  staleTime: 15_000,
  refetchOnWindowFocus: false,
} as const;

function typeLabel(type: string) {
  if (type === "VIDEO") return "Video";
  if (type === "MARKETING_AD") return "Advertentie";
  if (type === "LIP_SYNC") return "Lip sync";
  return "Afbeelding";
}

function typeIcon(type: string) {
  if (type === "VIDEO" || type === "MARKETING_AD" || type === "LIP_SYNC") return Video;
  return ImageIcon;
}

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "COMPLETED") return "default";
  if (status === "FAILED") return "destructive";
  if (status === "PROCESSING" || status === "PENDING") return "secondary";
  return "outline";
}

function statusLabel(status: string) {
  if (status === "PENDING") return "Wachtrij";
  if (status === "PROCESSING") return "Bezig";
  if (status === "COMPLETED") return "Klaar";
  if (status === "FAILED") return "Mislukt";
  return status;
}

function studioTabForType(type: string) {
  if (type === "VIDEO") return "video";
  if (type === "MARKETING_AD") return "ads";
  if (type === "LIP_SYNC") return "lipsync";
  return "images";
}

type Props = {
  type?: "IMAGE" | "VIDEO" | "MARKETING_AD" | "LIP_SYNC";
  compact?: boolean;
};

export function GenerationHistory({ type, compact = false }: Props) {
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const pageSize = compact ? 3 : 12;

  const history = trpc.media.listHistory.useQuery(
    { type, page, pageSize },
    {
      ...HISTORY_QUERY_OPTIONS,
      refetchInterval: (query) => {
        const hasActive = query.state.data?.items.some(
          (item) => item.status === "PENDING" || item.status === "PROCESSING",
        );
        return hasActive ? 5000 : false;
      },
    },
  );

  const importToBlob = trpc.media.importToBlob.useMutation({
    onSuccess: () => {
      void history.refetch();
      showToast({ title: "Opgeslagen in bibliotheek" });
    },
    onError: (error) =>
      showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });

  const deleteGeneration = trpc.media.deleteGeneration.useMutation({
    onSuccess: () => {
      void history.refetch();
      showToast({ title: "Generatie verwijderd" });
    },
    onError: (error) =>
      showToast({ title: "Verwijderen mislukt", description: error.message, variant: "error" }),
  });

  const totalPages = useMemo(() => {
    if (!history.data?.total) return 1;
    return Math.max(1, Math.ceil(history.data.total / pageSize));
  }, [history.data?.total, pageSize]);

  if (history.isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: compact ? 2 : 3 }).map((_, index) => (
          <Skeleton key={index} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (history.isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-destructive" role="alert">
          Historie laden mislukt: {history.error.message}
          <div className="mt-3">
            <Button size="sm" variant="outline" onClick={() => void history.refetch()}>
              Opnieuw proberen
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!history.data?.items.length) {
    return (
      <>
        {compact ? <HistorySectionHeader href="/creative-studio?tab=history" /> : null}
        <CreativeEmptyState
          icon={ImageIcon}
          title="Nog geen creaties"
          description="Je gegenereerde afbeeldingen, video's en ads verschijnen hier zodra je begint."
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      {compact ? (
        <HistorySectionHeader href="/creative-studio?tab=history" />
      ) : (
        <div className="flex items-center justify-between rounded-xl border bg-muted/20 px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Historie</h2>
            <p className="text-sm text-muted-foreground">Al je AI-generaties op één plek</p>
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {history.data.total} item{history.data.total === 1 ? "" : "s"}
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {history.data.items.map((item) => {
          const Icon = typeIcon(item.type);
          const previewUrl = item.blobUrl || item.outputUrl;
          const itemType = item.type as string;
          const isVideo = itemType === "VIDEO" || itemType === "MARKETING_AD" || itemType === "LIP_SYNC";
          const metaAdsLink =
            itemType === "MARKETING_AD" || itemType === "LIP_SYNC"
              ? `/meta-ads?adJob=${item.id}`
              : undefined;
          const socialLink =
            itemType === "IMAGE"
              ? `/social?imageJob=${item.id}`
              : itemType === "VIDEO" || itemType === "LIP_SYNC"
                ? `/social?videoJob=${item.id}`
                : undefined;
          const regenerateLink = `/creative-studio?tab=${studioTabForType(item.type)}&regenerate=${item.id}`;

          return (
            <Card
              key={item.id}
              className={cn(
                studioCardClass,
                "group overflow-hidden transition-transform hover:-translate-y-0.5",
              )}
            >
              <div className="relative aspect-[4/3] bg-gradient-to-br from-muted to-muted/40">
                {previewUrl ? (
                  isVideo ? (
                    <video src={previewUrl} className="h-full w-full object-cover" muted playsInline controls preload="none" />
                  ) : (
                    <img src={previewUrl} alt={item.prompt} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  )
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <Icon className="h-8 w-8" />
                  </div>
                )}
                <div className="absolute inset-x-0 top-0 flex flex-wrap gap-1 bg-gradient-to-b from-black/50 to-transparent p-2">
                  <Badge variant="secondary" className="bg-background/90 backdrop-blur">
                    {typeLabel(item.type)}
                  </Badge>
                  <Badge variant={statusBadgeVariant(item.status)} className="bg-background/90 backdrop-blur">
                    {statusLabel(item.status)}
                  </Badge>
                </div>
              </div>
              <CardHeader className="space-y-1 p-4 pb-2">
                <CardTitle className="line-clamp-2 text-sm leading-snug">{item.prompt}</CardTitle>
                <CardDescription className="text-xs">
                  {new Date(item.createdAt).toLocaleString("nl-BE")}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1.5 border-t border-border/50 bg-muted/10 p-3">
                {item.outputUrl && !item.blobUrl ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={importToBlob.isPending}
                    onClick={() => importToBlob.mutate({ jobId: item.id })}
                  >
                    {LIBRARY_SAVE_LABEL}
                  </Button>
                ) : null}
                {socialLink ? (
                  <Button size="sm" asChild>
                    <Link href={socialLink}>Gebruik in post</Link>
                  </Button>
                ) : null}
                {metaAdsLink ? (
                  <Button size="sm" variant="outline" asChild>
                    <Link href={metaAdsLink}>
                      <Megaphone className="mr-2 h-3.5 w-3.5" />
                      Naar Meta Ads
                    </Link>
                  </Button>
                ) : null}
                {previewUrl ? (
                  <>
                    <Button size="sm" variant="ghost" asChild>
                      <a href={previewUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-2 h-3.5 w-3.5" />
                        Open
                      </a>
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <a href={previewUrl} download>
                        <Download className="mr-2 h-3.5 w-3.5" />
                        Download
                      </a>
                    </Button>
                  </>
                ) : null}
                <Button size="sm" variant="outline" asChild>
                  <Link href={regenerateLink}>
                    <RefreshCcw className="mr-2 h-3.5 w-3.5" />
                    Opnieuw
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={deleteGeneration.isPending}
                  onClick={() => deleteGeneration.mutate({ jobId: item.id })}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Verwijder
                </Button>
                <Button size="sm" variant="link" asChild>
                  <Link href={`/creative-studio?tab=${studioTabForType(item.type)}`}>
                    Naar generator
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!compact && totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Vorige
          </Button>
          <span className="text-sm text-muted-foreground">
            Pagina {page} van {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          >
            Meer laden
          </Button>
        </div>
      ) : null}
    </div>
  );
}
