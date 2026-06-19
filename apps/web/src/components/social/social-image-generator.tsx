"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@digitify/ui";
import { ImageIcon, Loader2, Sparkles, Wand2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useToast } from "@/components/feedback/toast-provider";
import { useMediaJob } from "@/components/creative-studio/use-media-job";
import { formatModelOptionLabel } from "@/lib/format-model-label";
import type { FeedAspectFormat, PlacementAssets, SocialPlacement } from "@/components/social/social-placement-editor";
import { SocialComposerSection } from "@/components/social/social-composer-section";

const MEDIA_MODELS_QUERY_OPTIONS = {
  staleTime: 30 * 60_000,
  gcTime: 60 * 60_000,
  refetchOnWindowFocus: false,
} as const;

const MUAPI_KEY_QUERY_OPTIONS = {
  staleTime: 5 * 60_000,
  refetchOnWindowFocus: false,
} as const;

type Props = {
  disabled?: boolean;
  caption: string;
  template: string;
  feedFormat: FeedAspectFormat;
  placements: SocialPlacement[];
  carouselEnabled?: boolean;
  socialPostId?: string;
  brandKitId?: string;
  onImageReady: (assets: PlacementAssets) => void;
};

function placementFormat(feedFormat: FeedAspectFormat, placements: SocialPlacement[]): "SQUARE" | "PORTRAIT" | "LANDSCAPE" | "STORY" {
  if (!placements.includes("FEED") && (placements.includes("STORY") || placements.includes("REEL"))) return "STORY";
  if (feedFormat === "PORTRAIT" || feedFormat === "PORTRAIT_34") return "PORTRAIT";
  if (feedFormat === "LANDSCAPE") return "LANDSCAPE";
  return "SQUARE";
}

export function SocialImageGenerator({
  disabled,
  caption,
  template,
  feedFormat,
  placements,
  carouselEnabled,
  socialPostId,
  brandKitId,
  onImageReady,
}: Props) {
  const { showToast } = useToast();
  const keyStatus = trpc.media.getMuapiKeyStatus.useQuery(undefined, MUAPI_KEY_QUERY_OPTIONS);
  const models = trpc.media.listModels.useQuery(undefined, MEDIA_MODELS_QUERY_OPTIONS);
  const [model, setModel] = useState("flux-2-dev");
  const [jobId, setJobId] = useState<string | null>(null);

  const startImage = trpc.media.startImageGeneration.useMutation({
    onSuccess: (result) => {
      setJobId(result.jobId);
      if (result.status === "COMPLETED" && result.outputUrl) {
        void finalizeImage(result.jobId, result.outputUrl);
      }
    },
    onError: (error) => showToast({ title: "Afbeelding genereren mislukt", description: error.message, variant: "error" }),
  });

  const importToBlob = trpc.media.importToBlob.useMutation();

  const job = useMediaJob(jobId, {
    onCompleted: (outputUrl) => {
      if (jobId) void finalizeImage(jobId, outputUrl);
    },
  });

  async function finalizeImage(activeJobId: string, outputUrl: string) {
    try {
      let imageUrl = outputUrl;
      const imported = await importToBlob.mutateAsync({ jobId: activeJobId });
      if (imported.blobUrl) imageUrl = imported.blobUrl;

      const nextAssets: PlacementAssets = {};
      if (placements.includes("FEED")) nextAssets.FEED = { imageUrl };
      if (placements.includes("STORY")) nextAssets.STORY = { imageUrl };
      if (placements.includes("REEL") && !nextAssets.REEL?.videoUrl) {
        nextAssets.REEL = { imageUrl };
      }
      onImageReady(nextAssets);
      showToast({ title: "Afbeelding toegevoegd aan post" });
      setJobId(null);
    } catch (error) {
      showToast({
        title: "Opslaan mislukt",
        description: error instanceof Error ? error.message : "Kon afbeelding niet importeren.",
        variant: "error",
      });
    }
  }

  const promptSource = caption.trim() || template.trim();
  const imageModels = (models.data ?? []).filter((item) => item.type === "IMAGE");
  const selectedModel = imageModels.find((item) => item.id === model);
  const isGenerating = startImage.isPending || job.isPolling || importToBlob.isPending;

  if (keyStatus.isLoading) {
    return <div className="h-10 animate-pulse rounded-xl bg-muted" />;
  }

  const sectionBadge = isGenerating
    ? "Bezig..."
    : job.outputUrl
      ? "Preview klaar"
      : carouselEnabled
        ? "Carousel"
        : "Optioneel";

  return (
    <SocialComposerSection
      title="AI-afbeelding"
      description="Genereer een beeld vanuit je caption of briefing."
      icon={Wand2}
      badge={sectionBadge}
      badgeVariant={job.outputUrl ? "success" : isGenerating ? "info" : "secondary"}
      defaultOpen={isGenerating || Boolean(job.outputUrl)}
      className="border-dashed"
    >
      {!keyStatus.data?.hasKey ? (
        <Button size="sm" variant="outline" className="w-full" asChild>
          <Link href="/settings/integrations?tab=muapi">
            <Sparkles className="mr-2 h-3 w-3" />
            MuAPI-key instellen
          </Link>
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Model</p>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="h-8 w-full max-w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {imageModels.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {formatModelOptionLabel(item.label, item.costLabel)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={disabled || !promptSource || isGenerating}
            onClick={() =>
              startImage.mutate({
                prompt: promptSource,
                model,
                placementFormat: placementFormat(feedFormat, placements),
                socialPostId,
                brandKitId,
              })
            }
          >
            {isGenerating ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Wand2 className="mr-2 h-3 w-3" />}
            Genereer afbeelding
          </Button>

          {!promptSource ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Schrijf eerst een caption of briefing in stap Tekst.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Prompt: <span className="line-clamp-2 text-foreground">{promptSource}</span>
            </p>
          )}

          <Button size="sm" variant="ghost" className="w-full" asChild>
            <Link
              href={
                socialPostId
                  ? `/creative-studio?tab=images&socialPostId=${socialPostId}`
                  : "/creative-studio?tab=images"
              }
            >
              <Sparkles className="mr-2 h-3 w-3" />
              Open in Creative Studio
              {selectedModel?.costLabel ? ` · ${selectedModel.costLabel}` : ""}
            </Link>
          </Button>

          {job.outputUrl ? (
            <div className="overflow-hidden rounded-lg border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={job.outputUrl}
                alt="Gegenereerde preview"
                loading="lazy"
                decoding="async"
                className="max-h-40 w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              <ImageIcon className="h-3.5 w-3.5 shrink-0" />
              Nog geen AI-afbeelding gegenereerd
            </div>
          )}
        </div>
      )}
    </SocialComposerSection>
  );
}
