"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@digitify/ui";
import { ImageIcon, Loader2, Sparkles, Wand2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useToast } from "@/components/feedback/toast-provider";
import { useMediaJob } from "@/components/creative-studio/use-media-job";
import { formatModelOptionLabel } from "@/lib/format-model-label";
import type { FeedAspectFormat, PlacementAssets, SocialPlacement } from "@/components/social/social-placement-editor";

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
  socialPostId?: string;
  brandKitId?: string;
  onImageReady: (assets: PlacementAssets) => void;
};

function placementFormat(feedFormat: FeedAspectFormat, placements: SocialPlacement[]): "SQUARE" | "PORTRAIT" | "LANDSCAPE" | "STORY" {
  if (!placements.includes("FEED") && (placements.includes("STORY") || placements.includes("REEL"))) return "STORY";
  if (feedFormat === "PORTRAIT") return "PORTRAIT";
  if (feedFormat === "LANDSCAPE") return "LANDSCAPE";
  return "SQUARE";
}

export function SocialImageGenerator({
  disabled,
  caption,
  template,
  feedFormat,
  placements,
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

  if (keyStatus.isLoading) {
    return <div className="h-8 animate-pulse rounded-md bg-muted" />;
  }

  if (!keyStatus.data?.hasKey) {
    return (
      <Button size="sm" variant="outline" className="w-full" asChild>
        <Link href="/settings/integrations?tab=muapi">
          <Sparkles className="mr-2 h-3 w-3" />
          MuAPI-key instellen
        </Link>
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-dashed p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">AI-afbeelding</Label>
        <Select value={model} onValueChange={setModel}>
          <SelectTrigger className="h-8 w-[160px]">
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
        disabled={disabled || !promptSource || startImage.isPending || job.isPolling || importToBlob.isPending}
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
        {startImage.isPending || job.isPolling || importToBlob.isPending ? (
          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
        ) : (
          <Wand2 className="mr-2 h-3 w-3" />
        )}
        Genereer afbeelding
      </Button>
      <p className="text-xs text-muted-foreground">
        Gebruikt je caption of briefing als prompt. Resultaat wordt automatisch aan je placements gekoppeld.
      </p>
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
        </Link>
      </Button>
      {job.outputUrl ? (
        <div className="overflow-hidden rounded-lg border">
          <img src={job.outputUrl} alt="Gegenereerde preview" loading="lazy" decoding="async" className="max-h-40 w-full object-cover" />
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ImageIcon className="h-3.5 w-3.5" />
          Nog geen AI-afbeelding gegenereerd
        </div>
      )}
    </div>
  );
}
