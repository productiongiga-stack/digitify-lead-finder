"use client";

import { useMemo, useState } from "react";
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
  Skeleton,
  Textarea,
} from "@digitify/ui";
import { Loader2, Megaphone, Sparkles } from "lucide-react";
import {
  CreativePreview,
  GenerateButton,
  GeneratorShell,
  ModelMeta,
  studioSectionClass,
} from "./creative-studio-ui";
import { trpc } from "@/lib/trpc/client";
import { useToast } from "@/components/feedback/toast-provider";
import { formatModelOptionLabel } from "@/lib/format-model-label";
import { cn } from "@/lib/utils";
import { LIBRARY_SAVE_LABEL, MEDIA_MODELS_QUERY_OPTIONS, MUAPI_KEY_QUERY_OPTIONS } from "./constants";
import { MediaJobProgress } from "./media-job-progress";
import { MuapiKeyGate } from "./muapi-key-gate";
import { useMediaJob } from "./use-media-job";

const MAX_REFERENCE_UPLOAD_SIZE = 10 * 1024 * 1024;

async function fileToBase64(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Bestand lezen mislukt"));
    reader.readAsDataURL(file);
  });
  const commaIndex = dataUrl.indexOf(",");
  return commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
}

export function MarketingAdGenerator() {
  const { showToast } = useToast();
  const keyStatus = trpc.media.getMuapiKeyStatus.useQuery(undefined, MUAPI_KEY_QUERY_OPTIONS);
  const brandKit = trpc.media.getBrandKit.useQuery(undefined, MUAPI_KEY_QUERY_OPTIONS);
  const models = trpc.media.listModels.useQuery(undefined, MEDIA_MODELS_QUERY_OPTIONS);
  const uploadReference = trpc.media.uploadReference.useMutation();

  const adModels = useMemo(
    () => (models.data ?? []).filter((model) => model.type === "MARKETING_AD"),
    [models.data],
  );

  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("seedance-2-vip-omni-reference");
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [duration, setDuration] = useState("5");
  const [resolution, setResolution] = useState<"720p" | "1080p">("720p");
  const [productImageUrl, setProductImageUrl] = useState("");
  const [avatarImageUrl, setAvatarImageUrl] = useState("");
  const [referenceVideoUrl, setReferenceVideoUrl] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);

  const selectedModel = adModels.find((item) => item.id === model);
  const resolutionOptions = (selectedModel?.resolutions ?? ["720p"]) as Array<"720p" | "1080p">;
  const supports1080p = resolutionOptions.includes("1080p");

  const startMarketingAd = trpc.media.startMarketingAd.useMutation({
    onSuccess: (result) => {
      setJobId(result.jobId);
      showToast({ title: "Advertentie-generatie gestart", description: "Dit kan enkele minuten duren." });
    },
    onError: (error) => showToast({ title: "Generatie mislukt", description: error.message, variant: "error" }),
  });

  const importToBlob = trpc.media.importToBlob.useMutation({
    onSuccess: () => showToast({ title: "Advertentie opgeslagen in bibliotheek" }),
    onError: (error) => showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });

  const job = useMediaJob(jobId, {
    autoImport: brandKit.data?.autoImport,
    onCompleted: () => showToast({ title: "Advertentievideo klaar" }),
    onAutoImported: () => showToast({ title: "Automatisch opgeslagen in bibliotheek" }),
    onPollError: (message) => showToast({ title: "Status ophalen mislukt", description: message, variant: "error" }),
  });

  function handleModelChange(nextModel: string) {
    setModel(nextModel);
    const next = adModels.find((item) => item.id === nextModel);
    if (next?.defaultAspectRatio) setAspectRatio(next.defaultAspectRatio);
    if (next?.durations?.[0]) setDuration(String(next.durations[0]));
    const nextRes = (next?.resolutions?.[0] ?? "720p") as "720p" | "1080p";
    setResolution(nextRes);
  }

  async function handleImageUpload(file: File | undefined, target: "product" | "avatar") {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast({ title: "Upload geweigerd", description: "Gebruik een afbeelding als referentie.", variant: "error" });
      return;
    }
    if (file.size > MAX_REFERENCE_UPLOAD_SIZE) {
      showToast({ title: "Upload te groot", description: "Referentiebeelden mogen maximaal 10MB zijn.", variant: "error" });
      return;
    }
    try {
      const base64 = await fileToBase64(file);
      const uploaded = await uploadReference.mutateAsync({
        filename: file.name,
        contentType: file.type,
        base64,
      });
      if (target === "product") setProductImageUrl(uploaded.url);
      else setAvatarImageUrl(uploaded.url);
      showToast({ title: "Referentie geüpload" });
    } catch (error) {
      showToast({
        title: "Upload mislukt",
        description: error instanceof Error ? error.message : "Kon referentie niet uploaden.",
        variant: "error",
      });
    }
  }

  const imagesList = [productImageUrl, avatarImageUrl].filter(Boolean);
  const isSubmitting = startMarketingAd.isPending || job.isPolling || uploadReference.isPending || job.isAutoImporting;

  return (
    <MuapiKeyGate
      isLoading={keyStatus.isLoading}
      hasKey={keyStatus.data?.hasKey}
      description="Voeg je persoonlijke MuAPI-sleutel toe om advertenties te genereren."
    >
      <GeneratorShell
        icon={Megaphone}
        title="Marketing advertentie"
        description="Product + avatar + script naar een korte video-ad voor Meta en social."
        costLabel={selectedModel?.costLabel}
        brandActive={brandKit.data?.enabled}
      >
          <div className="space-y-2">
            <Label htmlFor="ad-prompt">Ad-script</Label>
            <Textarea
              id="ad-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={4}
              className="min-h-[120px] resize-y border-border/70 bg-background/50"
              placeholder="Beschrijf je advertentie: product, doelgroep, tone of voice..."
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Model</Label>
              {models.isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={model} onValueChange={handleModelChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {adModels.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {formatModelOptionLabel(item.label, item.costLabel)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <ModelMeta description={selectedModel?.description} costDetail={selectedModel?.costDetail} />
            </div>
            <div className="space-y-2">
              <Label>Beeldverhouding</Label>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(selectedModel?.aspectRatios ?? ["9:16", "16:9", "4:3", "3:4", "1:1"]).map((ratio) => (
                    <SelectItem key={ratio} value={ratio}>{ratio}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Duur (sec)</Label>
              <Input value={duration} onChange={(event) => setDuration(event.target.value)} type="number" min={4} max={15} />
            </div>
            <div className="space-y-2">
              <Label>Resolutie</Label>
              {supports1080p ? (
                <Select value={resolution} onValueChange={(value) => setResolution(value as "720p" | "1080p")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {resolutionOptions.map((value) => (
                      <SelectItem key={value} value={value}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value="720p" readOnly />
              )}
            </div>
          </div>

          <div className={cn(studioSectionClass, "grid gap-4 md:grid-cols-2")}>
            <div className="space-y-2">
              <Label>Productafbeelding</Label>
              <Input type="file" accept="image/*" onChange={(event) => void handleImageUpload(event.target.files?.[0], "product")} />
              {productImageUrl ? (
                <img src={productImageUrl} alt="Product preview" className="h-24 w-24 rounded-xl border object-cover shadow-sm" />
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Avatar / referentie</Label>
              <Input type="file" accept="image/*" onChange={(event) => void handleImageUpload(event.target.files?.[0], "avatar")} />
              {avatarImageUrl ? (
                <img src={avatarImageUrl} alt="Avatar preview" className="h-24 w-24 rounded-xl border object-cover shadow-sm" />
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ad-format-video">Format-video URL (optioneel)</Label>
            <Input
              id="ad-format-video"
              value={referenceVideoUrl}
              onChange={(event) => setReferenceVideoUrl(event.target.value)}
              placeholder="https://...mp4"
            />
          </div>

          <GenerateButton
            onClick={() =>
              startMarketingAd.mutate({
                prompt: prompt.trim(),
                model,
                aspectRatio,
                duration: Number(duration) || 5,
                resolution: supports1080p ? resolution : "720p",
                imagesList,
                videoFiles: referenceVideoUrl.trim() ? [referenceVideoUrl.trim()] : undefined,
              })
            }
            disabled={!prompt.trim() || !productImageUrl || isSubmitting}
            isLoading={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Genereer advertentie
          </GenerateButton>

          <MediaJobProgress
            status={job.status}
            elapsedSeconds={job.elapsedSeconds}
            pollError={job.pollError}
            onRetry={job.refresh}
            hint="Advertenties kunnen 3–8 minuten duren."
          />

          {job.outputUrl ? (
            <CreativePreview
              label="Advertentievideo"
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
                    <Link href={`/meta-ads?adJob=${jobId}`}>Gebruik in Meta Ads</Link>
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
