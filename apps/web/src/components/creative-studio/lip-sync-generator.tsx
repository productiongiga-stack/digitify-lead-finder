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
import { CalendarDays, Loader2, Mic, Sparkles } from "lucide-react";
import {
  CreativePreview,
  GenerateButton,
  GeneratorModeToggle,
  GeneratorShell,
  ModelMeta,
  studioSectionClass,
} from "./creative-studio-ui";
import { trpc } from "@/lib/trpc/client";
import { useToast } from "@/components/feedback/toast-provider";
import { LIBRARY_SAVE_LABEL, MEDIA_MODELS_QUERY_OPTIONS, MUAPI_KEY_QUERY_OPTIONS } from "./constants";
import { type ModelListItem } from "./generator-utils";
import { MediaJobProgress } from "./media-job-progress";
import { MuapiKeyGate } from "./muapi-key-gate";
import { ReferencePicker } from "./reference-picker";
import { useMediaJob } from "./use-media-job";
import { useRegeneratePrefill } from "./use-regenerate-prefill";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

type LipSyncMode = "PORTRAIT" | "VIDEO";

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Kon bestand niet lezen."));
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

export function LipSyncGenerator({ socialPostId }: Props) {
  const { showToast } = useToast();
  const models = trpc.media.listModels.useQuery(undefined, MEDIA_MODELS_QUERY_OPTIONS);
  const keyStatus = trpc.media.getMuapiKeyStatus.useQuery(undefined, MUAPI_KEY_QUERY_OPTIONS);
  const brandKit = trpc.media.getBrandKit.useQuery(undefined, MUAPI_KEY_QUERY_OPTIONS);

  const lipSyncModels = useMemo(
    () => (models.data ?? []).filter((model) => model.type === "LIP_SYNC") as ModelListItem[],
    [models.data],
  );

  const [mode, setMode] = useState<LipSyncMode>("PORTRAIT");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("infinitetalk-image-to-video");
  const [resolution, setResolution] = useState("720p");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [linkedSocialPostId, setLinkedSocialPostId] = useState<string | null>(socialPostId ?? null);

  const filteredModels = useMemo(
    () =>
      lipSyncModels.filter((entry) =>
        mode === "PORTRAIT" ? entry.lipSyncMode === "PORTRAIT" : entry.lipSyncMode === "VIDEO",
      ),
    [lipSyncModels, mode],
  );

  const selectedModel = filteredModels.find((item) => item.id === model) ?? filteredModels[0];
  const resolutionOptions = selectedModel?.resolutions ?? ["720p"];

  const applyPrefill = useCallback(
    (payload: {
      prompt: string;
      model: string;
      resolution?: string;
      imageUrl?: string;
      socialPostId?: string | null;
    }) => {
      setPrompt(payload.prompt);
      if (payload.resolution) setResolution(payload.resolution);
      if (payload.imageUrl) {
        setMode("PORTRAIT");
        setImageUrls([payload.imageUrl]);
      }
      if (payload.socialPostId) setLinkedSocialPostId(payload.socialPostId);
      setModel(payload.model);
    },
    [],
  );

  useRegeneratePrefill({ onPrefill: applyPrefill, expectedType: "LIP_SYNC" });

  useEffect(() => {
    if (socialPostId) setLinkedSocialPostId(socialPostId);
  }, [socialPostId]);

  useEffect(() => {
    if (!filteredModels.some((entry) => entry.id === model) && filteredModels[0]) {
      setModel(filteredModels[0].id);
      setResolution(filteredModels[0].resolutions?.[0] ?? "720p");
    }
  }, [filteredModels, model]);

  const startLipSync = trpc.media.startLipSyncGeneration.useMutation({
    onSuccess: (result) => {
      setJobId(result.jobId);
      showToast({ title: "Lip sync gestart", description: "Dit kan enkele minuten duren." });
    },
    onError: (error) => showToast({ title: "Lip sync mislukt", description: error.message, variant: "error" }),
  });

  const importToBlob = trpc.media.importToBlob.useMutation({
    onSuccess: () => showToast({ title: "Video opgeslagen in bibliotheek" }),
    onError: (error) => showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });

  const uploadMedia = trpc.media.uploadMediaFile.useMutation();

  const job = useMediaJob(jobId, {
    autoImport: brandKit.data?.autoImport,
    onCompleted: () => showToast({ title: "Lip sync video klaar" }),
    onAutoImported: () => showToast({ title: "Automatisch opgeslagen in bibliotheek" }),
    onPollError: (message) => showToast({ title: "Status ophalen mislukt", description: message, variant: "error" }),
  });

  const isSubmitting = startLipSync.isPending || uploadMedia.isPending || job.isPolling || job.isAutoImporting;

  async function handleGenerate() {
    if (!audioUrl.trim() && !audioFile) {
      showToast({ title: "Audio vereist", description: "Upload een audiobestand.", variant: "error" });
      return;
    }
    if (mode === "PORTRAIT" && !imageUrls.length) {
      showToast({ title: "Portret vereist", description: "Kies een portretafbeelding.", variant: "error" });
      return;
    }
    if (mode === "VIDEO" && !videoUrl.trim()) {
      showToast({ title: "Video vereist", description: "Voeg een videobestand toe.", variant: "error" });
      return;
    }

    try {
      let resolvedAudioUrl = audioUrl.trim();
      if (audioFile) {
        const base64 = await readFileAsBase64(audioFile);
        const uploaded = await uploadMedia.mutateAsync({
          filename: audioFile.name,
          contentType: audioFile.type || "audio/mpeg",
          base64,
        });
        resolvedAudioUrl = uploaded.url;
      }

      startLipSync.mutate({
        prompt: prompt.trim() || undefined,
        model,
        resolution: resolution || undefined,
        imageUrl: mode === "PORTRAIT" ? imageUrls[0] : undefined,
        videoUrl: mode === "VIDEO" ? videoUrl.trim() : undefined,
        audioUrl: resolvedAudioUrl,
        socialPostId: linkedSocialPostId ?? undefined,
      });
    } catch (error) {
      showToast({
        title: "Upload mislukt",
        description: error instanceof Error ? error.message : "Kon media niet uploaden.",
        variant: "error",
      });
    }
  }

  return (
    <MuapiKeyGate
      isLoading={keyStatus.isLoading}
      hasKey={keyStatus.data?.hasKey}
      description="Voeg je persoonlijke MuAPI-sleutel toe om lip sync video's te maken."
    >
      <GeneratorShell
        icon={Mic}
        title="Lip Sync Studio"
        description="Maak pratende video's van een portret of sync audio op bestaande video."
        costLabel={selectedModel?.costLabel}
        brandActive={brandKit.data?.enabled}
      >
        <GeneratorModeToggle
          value={mode}
          onChange={setMode}
          options={[
            { value: "PORTRAIT", label: "Portret + audio", hint: "Talking head" },
            { value: "VIDEO", label: "Video + audio", hint: "Lipsync" },
          ]}
        />

        <div className="space-y-2">
          <Label htmlFor="lipsync-prompt">Prompt (optioneel)</Label>
          <Textarea
            id="lipsync-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={3}
            placeholder="Bijvoorbeeld: natuurlijke hoofdbewegingen, vriendelijke presentatiestijl"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {filteredModels.map((item) => (
                  <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ModelMeta description={selectedModel?.description} costDetail={selectedModel?.costDetail} />
          </div>
          {resolutionOptions.length ? (
            <div className="space-y-2">
              <Label>Resolutie</Label>
              <Select value={resolution} onValueChange={setResolution}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {resolutionOptions.map((value) => (
                    <SelectItem key={value} value={value}>{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        <div className={studioSectionClass}>
          {mode === "PORTRAIT" ? (
            <ReferencePicker
              label="Portretafbeelding"
              selectedUrls={imageUrls}
              onChange={(urls) => setImageUrls(urls.slice(0, 1))}
              maxItems={1}
              multi={false}
            />
          ) : (
            <div className="space-y-2">
              <Label htmlFor="lipsync-video-url">Video URL</Label>
              <Input
                id="lipsync-video-url"
                value={videoUrl}
                onChange={(event) => setVideoUrl(event.target.value)}
                placeholder="https://..."
              />
              <Input
                type="file"
                accept="video/*"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (file.size > MAX_UPLOAD_BYTES) {
                    showToast({ title: "Video te groot", description: "Max 25MB.", variant: "error" });
                    return;
                  }
                  const base64 = await readFileAsBase64(file);
                  const uploaded = await uploadMedia.mutateAsync({
                    filename: file.name,
                    contentType: file.type || "video/mp4",
                    base64,
                  });
                  setVideoUrl(uploaded.url);
                }}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="lipsync-audio">Audio</Label>
            <Input
              id="lipsync-audio"
              value={audioUrl}
              onChange={(event) => setAudioUrl(event.target.value)}
              placeholder="Audio URL (optioneel als je uploadt)"
            />
            <Input
              type="file"
              accept="audio/*"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                if (file && file.size > MAX_UPLOAD_BYTES) {
                  showToast({ title: "Audio te groot", description: "Max 25MB.", variant: "error" });
                  return;
                }
                setAudioFile(file);
              }}
            />
            {audioFile ? (
              <p className="text-xs text-muted-foreground">Geselecteerd: {audioFile.name}</p>
            ) : null}
          </div>
        </div>

        <GenerateButton onClick={() => void handleGenerate()} disabled={isSubmitting} isLoading={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Genereer lip sync
        </GenerateButton>

        <MediaJobProgress
          status={job.status}
          elapsedSeconds={job.elapsedSeconds}
          pollError={job.pollError}
          onRetry={job.refresh}
          hint="Lip sync kan 2–8 minuten duren."
        />

        {job.outputUrl ? (
          <CreativePreview
            label="Lip sync resultaat"
            actions={
              <>
                {!job.blobUrl && jobId ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={importToBlob.isPending}
                    onClick={() => importToBlob.mutate({ jobId })}
                  >
                    {LIBRARY_SAVE_LABEL}
                  </Button>
                ) : null}
                <Button size="sm" asChild>
                  <Link href={`/social?videoJob=${jobId}`}>Gebruik in Social Reel</Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/meta-ads?adJob=${jobId}`}>Naar Meta Ads</Link>
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
