"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@digitify/ui";
import { aspectRatioForPlacement } from "@digitify/media-studio";
import { CalendarDays, Film, Loader2, Sparkles } from "lucide-react";
import {
  CreativePreview,
  GenerateButton,
  GeneratorModeToggle,
  GeneratorShell,
  ModelMeta,
  ModelSelectField,
  PlacementFormatPicker,
  studioSectionClass,
} from "./creative-studio-ui";
import { trpc } from "@/lib/trpc/client";
import { useToast } from "@/components/feedback/toast-provider";
import { LIBRARY_SAVE_LABEL, MEDIA_MODELS_QUERY_OPTIONS, MUAPI_KEY_QUERY_OPTIONS } from "./constants";
import {
  filterModelsByMode,
  getModelQualities,
  pickDefaultModel,
  VIDEO_MODE_DEFAULTS,
  type ModelListItem,
  type VideoGeneratorMode,
} from "./generator-utils";
import { MediaJobProgress } from "./media-job-progress";
import { MuapiKeyGate } from "./muapi-key-gate";
import { ReferencePicker } from "./reference-picker";
import { BrandPromptPreview } from "./brand-prompt-preview";
import { useMediaJob } from "./use-media-job";
import { useRegeneratePrefill } from "./use-regenerate-prefill";

const MAX_STARTFRAME_BYTES = 10 * 1024 * 1024;

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Kon startframe niet lezen."));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.split(",")[1] ?? "");
    };
    reader.readAsDataURL(file);
  });
}

type Props = {
  socialPostId?: string | null;
};

export function VideoGenerator({ socialPostId }: Props) {
  const { showToast } = useToast();
  const models = trpc.media.listModels.useQuery(undefined, MEDIA_MODELS_QUERY_OPTIONS);
  const keyStatus = trpc.media.getMuapiKeyStatus.useQuery(undefined, MUAPI_KEY_QUERY_OPTIONS);
  const brandKit = trpc.media.getBrandKit.useQuery(undefined, MUAPI_KEY_QUERY_OPTIONS);

  const allVideoModels = useMemo(
    () => (models.data ?? []) as ModelListItem[],
    [models.data],
  );

  const [mode, setMode] = useState<VideoGeneratorMode>("T2V");
  const [modelSearch, setModelSearch] = useState("");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState(VIDEO_MODE_DEFAULTS.T2V);
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [placementFormat, setPlacementFormat] = useState("STORY");
  const [duration, setDuration] = useState("5");
  const [resolution, setResolution] = useState<string>("");
  const [quality, setQuality] = useState<string>("");
  const [startframeUrls, setStartframeUrls] = useState<string[]>([]);
  const [startframeFile, setStartframeFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [linkedSocialPostId, setLinkedSocialPostId] = useState<string | null>(socialPostId ?? null);

  const modeModels = useMemo(
    () => filterModelsByMode(allVideoModels, mode),
    [allVideoModels, mode],
  );

  const selectedModel = modeModels.find((item) => item.id === model) ?? allVideoModels.find((item) => item.id === model);
  const aspectOptions = selectedModel?.aspectRatios?.length
    ? selectedModel.aspectRatios
    : ["9:16", "16:9", "1:1"];
  const durationOptions = selectedModel?.durations?.length
    ? selectedModel.durations.map(String)
    : ["5", "10"];
  const resolutionOptions = selectedModel?.resolutions ?? [];
  const qualityOptions = getModelQualities(model, selectedModel);
  const hasStartframe = Boolean(startframeUrls.length || startframeFile);

  const applyPrefill = useCallback(
    (payload: {
      prompt: string;
      model: string;
      aspectRatio?: string;
      resolution?: string;
      quality?: string;
      duration?: string;
      imageUrl?: string;
      socialPostId?: string | null;
    }) => {
      setPrompt(payload.prompt);
      if (payload.imageUrl) {
        setMode("I2V");
        setStartframeUrls([payload.imageUrl]);
      }
      if (payload.aspectRatio) setAspectRatio(payload.aspectRatio);
      if (payload.resolution) setResolution(payload.resolution);
      if (payload.quality) setQuality(payload.quality);
      if (payload.duration) setDuration(payload.duration);
      if (payload.socialPostId) setLinkedSocialPostId(payload.socialPostId);
      const nextMode = payload.imageUrl ? "I2V" : "T2V";
      const pool = filterModelsByMode(allVideoModels, nextMode);
      setModel(pickDefaultModel(pool, payload.model));
    },
    [allVideoModels],
  );

  useRegeneratePrefill({ onPrefill: applyPrefill, expectedType: "VIDEO" });

  useEffect(() => {
    if (socialPostId) setLinkedSocialPostId(socialPostId);
  }, [socialPostId]);

  useEffect(() => {
    if (placementFormat === "NONE") return;
    setAspectRatio(
      aspectRatioForPlacement(
        placementFormat as "SQUARE" | "PORTRAIT" | "LANDSCAPE" | "STORY",
      ),
    );
  }, [placementFormat]);

  const startVideo = trpc.media.startVideoGeneration.useMutation({
    onSuccess: (result) => {
      setJobId(result.jobId);
      showToast({ title: "Videogeneratie gestart", description: "Dit kan enkele minuten duren." });
    },
    onError: (error) => showToast({ title: "Generatie mislukt", description: error.message, variant: "error" }),
  });

  const importToBlob = trpc.media.importToBlob.useMutation({
    onSuccess: () => showToast({ title: "Video opgeslagen in bibliotheek" }),
    onError: (error) => showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });

  const uploadReference = trpc.media.uploadReference.useMutation();

  const job = useMediaJob(jobId, {
    autoImport: brandKit.data?.autoImport,
    onCompleted: () => showToast({ title: "Video gegenereerd" }),
    onAutoImported: () => showToast({ title: "Automatisch opgeslagen in bibliotheek" }),
    onPollError: (message) => showToast({ title: "Status ophalen mislukt", description: message, variant: "error" }),
  });

  const isSubmitting = startVideo.isPending || uploadReference.isPending || job.isPolling || job.isAutoImporting;

  function handleModeChange(nextMode: VideoGeneratorMode) {
    setMode(nextMode);
    const pool = filterModelsByMode(allVideoModels, nextMode);
    setModel(pickDefaultModel(pool, VIDEO_MODE_DEFAULTS[nextMode]));
    if (nextMode === "T2V") {
      setStartframeUrls([]);
      setStartframeFile(null);
    }
  }

  function handleModelChange(nextModel: string) {
    setModel(nextModel);
    const nextModelDefinition = allVideoModels.find((item) => item.id === nextModel);
    if (nextModelDefinition?.defaultAspectRatio) {
      setAspectRatio(nextModelDefinition.defaultAspectRatio);
    }
    if (nextModelDefinition?.durations?.[0]) {
      setDuration(String(nextModelDefinition.durations[0]));
    }
    setResolution(nextModelDefinition?.resolutions?.[0] ?? "");
    setQuality(nextModelDefinition?.qualities?.[0] ?? "");
  }

  async function handleGenerate() {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt && !hasStartframe) return;
    if (mode === "I2V" && !hasStartframe) {
      showToast({
        title: "Startframe vereist",
        description: "Dit image-to-video model heeft een startframe nodig.",
        variant: "error",
      });
      return;
    }

    try {
      let resolvedImageUrl = startframeUrls[0] || undefined;
      if (startframeFile) {
        const base64 = await readFileAsBase64(startframeFile);
        const uploaded = await uploadReference.mutateAsync({
          filename: startframeFile.name,
          contentType: startframeFile.type || "image/png",
          base64,
        });
        resolvedImageUrl = uploaded.url;
      }

      startVideo.mutate({
        prompt: trimmedPrompt || undefined,
        model,
        aspectRatio,
        duration: Number(duration) || 5,
        resolution: resolution || undefined,
        quality: quality || undefined,
        imageUrl: mode === "I2V" ? resolvedImageUrl : resolvedImageUrl,
        socialPostId: linkedSocialPostId ?? undefined,
      });
    } catch (error) {
      showToast({
        title: "Startframe uploaden mislukt",
        description: error instanceof Error ? error.message : "Kon startframe niet uploaden.",
        variant: "error",
      });
    }
  }

  return (
    <MuapiKeyGate
      isLoading={keyStatus.isLoading}
      hasKey={keyStatus.data?.hasKey}
      description="Voeg je persoonlijke MuAPI-sleutel toe om video's te genereren."
    >
      <GeneratorShell
        icon={Film}
        title="Video / Reel genereren"
        description="Tekst-naar-video of animeer een startframe voor reels en stories."
        costLabel={selectedModel?.costLabel}
        brandActive={brandKit.data?.enabled}
      >
        <GeneratorModeToggle
          value={mode}
          onChange={handleModeChange}
          options={[
            { value: "T2V", label: "Tekst → video", hint: "Vanaf prompt" },
            { value: "I2V", label: "Startframe → video", hint: "Met afbeelding" },
          ]}
        />

        <div className="space-y-2">
          <Label htmlFor="video-prompt">Prompt {mode === "I2V" ? "(optioneel)" : ""}</Label>
          <Textarea
            id="video-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={4}
            className="min-h-[120px] resize-y border-border/70 bg-background/50"
            placeholder="Beschrijf beweging, sfeer en onderwerp..."
          />
          <BrandPromptPreview
            brand={brandKit.data}
            prompt={prompt}
            modelType={mode === "I2V" ? "VIDEO_I2V" : "VIDEO"}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2 md:col-span-1">
            <Label>Model</Label>
            <ModelSelectField
              models={modeModels}
              mode={mode}
              value={model}
              onChange={handleModelChange}
              isLoading={models.isLoading}
              search={modelSearch}
              onSearchChange={setModelSearch}
            />
            <ModelMeta description={selectedModel?.description} costDetail={selectedModel?.costDetail} />
          </div>
          <div className="space-y-2">
            <PlacementFormatPicker value={placementFormat} onChange={setPlacementFormat} />
            <Label>Beeldverhouding</Label>
            <Select value={aspectRatio} onValueChange={setAspectRatio}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {aspectOptions.map((ratio) => (
                  <SelectItem key={ratio} value={ratio}>{ratio}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Duur (sec)</Label>
            {durationOptions.length > 1 ? (
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {durationOptions.map((value) => (
                    <SelectItem key={value} value={value}>{value}s</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={duration} onChange={(event) => setDuration(event.target.value)} type="number" min={1} max={60} />
            )}
          </div>
        </div>

        {resolutionOptions.length || qualityOptions.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {resolutionOptions.length ? (
              <div className="space-y-2">
                <Label>Resolutie</Label>
                <Select value={resolution || resolutionOptions[0]} onValueChange={setResolution}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {resolutionOptions.map((value) => (
                      <SelectItem key={value} value={value}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {qualityOptions.length ? (
              <div className="space-y-2">
                <Label>Kwaliteit / modus</Label>
                <Select value={quality || qualityOptions[0]} onValueChange={setQuality}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {qualityOptions.map((value) => (
                      <SelectItem key={value} value={value}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
        ) : null}

        {mode === "I2V" ? (
          <div className={studioSectionClass}>
            <ReferencePicker
              label="Startframe bibliotheek"
              selectedUrls={startframeUrls}
              onChange={(urls) => {
                setStartframeUrls(urls.slice(0, 1));
                if (urls.length) handleModeChange("I2V");
              }}
              maxItems={1}
              multi={false}
            />
            <div className="space-y-2">
              <Label htmlFor="video-startframe-file">Startframe uploaden</Label>
              <Input
                id="video-startframe-file"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  if (file && file.size > MAX_STARTFRAME_BYTES) {
                    showToast({ title: "Bestand te groot", description: "Maximaal 10MB.", variant: "error" });
                    return;
                  }
                  setStartframeFile(file);
                  if (file) handleModeChange("I2V");
                }}
              />
              {startframeFile ? (
                <p className="text-xs text-muted-foreground">Geselecteerd: {startframeFile.name}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        <GenerateButton
          onClick={() => void handleGenerate()}
          disabled={(!prompt.trim() && !hasStartframe) || (mode === "I2V" && !hasStartframe) || isSubmitting}
          isLoading={isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Genereer video
        </GenerateButton>

        <MediaJobProgress
          status={job.status}
          elapsedSeconds={job.elapsedSeconds}
          pollError={job.pollError}
          onRetry={job.refresh}
          hint="Video's kunnen 2–5 minuten duren."
        />

        {job.outputUrl ? (
          <CreativePreview
            label="Gegenereerde video"
            actions={
              <>
                {!job.blobUrl && jobId ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={importToBlob.isPending}
                    onClick={() => importToBlob.mutate({ jobId })}
                    title="Sla permanent op in je Digitify-bibliotheek"
                  >
                    {LIBRARY_SAVE_LABEL}
                  </Button>
                ) : null}
                <Button size="sm" asChild>
                  <Link href={`/social?videoJob=${jobId}`}>Gebruik in Social Post</Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/social?tab=agenda&videoJob=${jobId}`}>
                    <CalendarDays className="mr-2 h-3.5 w-3.5" />
                    Plan in agenda
                  </Link>
                </Button>
              </>
            }
          >
            <video src={job.blobUrl || job.outputUrl} controls preload="metadata" className="max-h-[28rem] w-full" />
          </CreativePreview>
        ) : null}

        {job.errorMessage ? (
          <p className="text-sm text-destructive" role="alert">{job.errorMessage}</p>
        ) : null}
      </GeneratorShell>
    </MuapiKeyGate>
  );
}
