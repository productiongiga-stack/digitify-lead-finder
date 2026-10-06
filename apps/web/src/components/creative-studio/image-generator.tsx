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
import { CalendarDays, ImageIcon, Loader2, Sparkles } from "lucide-react";
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
  IMAGE_MODE_DEFAULTS,
  pickDefaultModel,
  type ImageGeneratorMode,
  type ModelListItem,
} from "./generator-utils";
import { MediaJobProgress } from "./media-job-progress";
import { MuapiKeyGate } from "./muapi-key-gate";
import { ReferencePicker } from "./reference-picker";
import { BrandPromptPreview } from "./brand-prompt-preview";
import { StudioContext, StudioSection, useStudioField, useCreativeQuote, CreditQuote } from "./studio-context";
import { useContext, useRef } from "react";
import { useMediaJob } from "./use-media-job";
import { useRegeneratePrefill } from "./use-regenerate-prefill";

const MAX_REFERENCE_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_REFERENCE_IMAGES = 14;

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Kon referentiebeeld niet lezen."));
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

export function ImageGenerator({ socialPostId }: Props) {
  const { showToast } = useToast();
  const studio = useContext(StudioContext);
  const requestKey = useRef<string | null>(null);
  const models = trpc.media.listModels.useQuery(undefined, MEDIA_MODELS_QUERY_OPTIONS);
  const keyStatus = trpc.media.getMuapiKeyStatus.useQuery(undefined, MUAPI_KEY_QUERY_OPTIONS);
  const brandKit = trpc.media.getCreativeBrand.useQuery({ brandKitId: studio?.state.brandKitId || undefined }, MUAPI_KEY_QUERY_OPTIONS);

  const allImageModels = useMemo(
    () => (models.data ?? []) as ModelListItem[],
    [models.data],
  );

  const [mode, setMode] = useStudioField<ImageGeneratorMode>("mode", "T2I");
  const [referenceUploading,setReferenceUploading] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [prompt, setPrompt] = useStudioField("prompt", "");
  const [model, setModel] = useStudioField("model", IMAGE_MODE_DEFAULTS.T2I);
  const [aspectRatio, setAspectRatio] = useStudioField("aspectRatio", "1:1");
  const [placementFormat, setPlacementFormat] = useStudioField("placementFormat", "NONE");
  const [resolution, setResolution] = useStudioField<string>("resolution", "");
  const [quality, setQuality] = useStudioField<string>("quality", "");
  const [referenceUrls, setReferenceUrls] = useStudioField<string[]>("referenceUrls", []);
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [jobId, setJobId] = useStudioField<string | null>("jobId", null);
  const [linkedSocialPostId, setLinkedSocialPostId] = useStudioField<string | null>("linkedSocialPostId", socialPostId ?? null);

  const modeModels = useMemo(
    () => filterModelsByMode(allImageModels, mode),
    [allImageModels, mode],
  );

  const pricing = useCreativeQuote(model, { resolution: resolution || undefined, quality: quality || undefined, duration: undefined, aspectRatio: aspectRatio });
  const selectedModel = modeModels.find((item) => item.id === model) ?? allImageModels.find((item) => item.id === model);
  const aspectOptions = selectedModel?.aspectRatios?.length
    ? selectedModel.aspectRatios
    : ["1:1", "4:5", "9:16", "16:9"];
  const resolutionOptions = selectedModel?.resolutions ?? [];
  const qualityOptions = getModelQualities(model, selectedModel);
  const maxReferences = selectedModel?.maxReferenceImages ?? MAX_REFERENCE_IMAGES;
  const hasReferenceImages = referenceUrls.length > 0 || referenceFiles.length > 0;

  const applyPrefill = useCallback(
    (payload: {
      prompt: string;
      model: string;
      aspectRatio?: string;
      resolution?: string;
      quality?: string;
      imagesList?: string[];
      socialPostId?: string | null;
    }) => {
      setPrompt(payload.prompt);
      if (payload.imagesList?.length) {
        setMode("I2I");
        setReferenceUrls(payload.imagesList);
      }
      if (payload.aspectRatio) setAspectRatio(payload.aspectRatio);
      if (payload.resolution) setResolution(payload.resolution);
      if (payload.quality) setQuality(payload.quality);
      if (payload.socialPostId) setLinkedSocialPostId(payload.socialPostId);
      const nextMode = payload.imagesList?.length ? "I2I" : "T2I";
      const pool = filterModelsByMode(allImageModels, nextMode);
      setModel(pickDefaultModel(pool, payload.model));
    },
    [allImageModels],
  );

  useRegeneratePrefill({ onPrefill: applyPrefill, expectedType: "IMAGE" });

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

  const startImage = trpc.media.startImageGeneration.useMutation({
    onSuccess: (result) => {
      setJobId(result.jobId);
      requestKey.current = null;
      if (result.status === "COMPLETED" && result.outputUrl) {
        showToast({ title: "Afbeelding klaar" });
      } else {
        showToast({ title: "Generatie gestart", description: "Even geduld, we pollen de status..." });
      }
    },
    onError: (error) => showToast({ title: "Generatie mislukt", description: error.message, variant: "error" }),
  });

  const importToBlob = trpc.media.importToBlob.useMutation({
    onSuccess: () => showToast({ title: "Opgeslagen in bibliotheek" }),
    onError: (error) => showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });

  const uploadReference = trpc.media.uploadReference.useMutation();

  const job = useMediaJob(jobId, {
    autoImport: brandKit.data?.autoImport,
    onCompleted: () => showToast({ title: "Afbeelding gegenereerd" }),
    onAutoImported: () => showToast({ title: "Automatisch opgeslagen in bibliotheek" }),
    onPollError: (message) => showToast({ title: "Status ophalen mislukt", description: message, variant: "error" }),
  });

  const isSubmitting = referenceUploading || startImage.isPending || uploadReference.isPending || job.isPolling || job.isAutoImporting;

  function handleModeChange(nextMode: ImageGeneratorMode) {
    setMode(nextMode);
    const pool = filterModelsByMode(allImageModels, nextMode);
    setModel(pickDefaultModel(pool, IMAGE_MODE_DEFAULTS[nextMode]));
    if (nextMode === "T2I") {
      setReferenceUrls([]);
      setReferenceFiles([]);
    }
  }

  function handleModelChange(nextModel: string) {
    setModel(nextModel);
    const nextModelDefinition = allImageModels.find((item) => item.id === nextModel);
    if (nextModelDefinition?.defaultAspectRatio) {
      setAspectRatio(nextModelDefinition.defaultAspectRatio);
    }
    setResolution(nextModelDefinition?.resolutions?.[0] ?? "");
    setQuality(nextModelDefinition?.qualities?.[0] ?? "");
  }

  async function handleReferenceFilesChange(files: FileList | null) {
    const nextFiles = Array.from(files ?? []);
    if (nextFiles.length > maxReferences) {
      setReferenceError(`Maximaal ${maxReferences} referentiebeelden per generatie.`);
      setReferenceFiles(nextFiles.slice(0, maxReferences));
      return;
    }
    const invalidFile = nextFiles.find((file) => !file.type.startsWith("image/"));
    if (invalidFile) {
      setReferenceError("Alleen afbeeldingen zijn toegestaan als referentie.");
      return;
    }
    const oversizedFile = nextFiles.find((file) => file.size > MAX_REFERENCE_IMAGE_BYTES);
    if (oversizedFile) {
      setReferenceError("Referentiebeelden mogen maximaal 10MB per bestand zijn.");
      return;
    }
    setReferenceError(null);
    setReferenceFiles(nextFiles);
    if (!nextFiles.length) return;
    handleModeChange("I2I");
    setReferenceUploading(true);
    try {
      const uploaded:string[]=[];
      for (const file of nextFiles) {
        const result=await uploadReference.mutateAsync({filename:file.name,contentType:file.type,base64:await readFileAsBase64(file)});
        uploaded.push(result.url);
      }
      setReferenceUrls(current=>Array.from(new Set([...current,...uploaded])).slice(0,maxReferences));
      setReferenceFiles([]);
    } catch(error) {setReferenceError(error instanceof Error ? error.message : "Upload mislukt. Probeer opnieuw.");}
    finally {setReferenceUploading(false);}
  }

  async function handleGenerate() {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return;
    if (mode === "I2I" && !hasReferenceImages) {
      showToast({
        title: "Referentiebeeld vereist",
        description: "Kies een referentiebeeld of plak een URL voor bewerken.",
        variant: "error",
      });
      return;
    }

    try {
      const uploadedUrls = await Promise.all(
        referenceFiles.map(async (file) => {
          const base64 = await readFileAsBase64(file);
          const result = await uploadReference.mutateAsync({
            filename: file.name,
            contentType: file.type || "image/png",
            base64,
          });
          return result.url;
        }),
      );
      const references = [...referenceUrls, ...uploadedUrls].slice(0, maxReferences);
      setReferenceUrls(references);
      startImage.mutate({
        requestKey: requestKey.current || (requestKey.current = crypto.randomUUID()),
        expectedCredits: pricing.quote.data?.credits,
        draftId: studio?.draftId,
        brandKitId: studio?.state.brandKitId || undefined,
        prompt: trimmedPrompt,
        model,
        aspectRatio,
        resolution: resolution || undefined,
        quality: quality || undefined,
        imagesList: mode === "I2I" && references.length ? references : undefined,
        socialPostId: linkedSocialPostId ?? undefined,
      });
    } catch (error) {
      showToast({
        title: "Referentie uploaden mislukt",
        description: error instanceof Error ? error.message : "Kon referentiebeelden niet uploaden.",
        variant: "error",
      });
    }
  }

  return (
    <MuapiKeyGate
      isLoading={keyStatus.isLoading}
      hasKey={keyStatus.data?.hasKey}
      description="Voeg je persoonlijke MuAPI-sleutel toe om afbeeldingen te genereren."
    >
      <GeneratorShell
        icon={ImageIcon}
        title="Afbeelding genereren"
        description="Tekst-naar-afbeelding of bewerk bestaande referenties voor social posts."
        costLabel={keyStatus.data?.central ? undefined : selectedModel?.costLabel}
        brandActive={brandKit.data?.enabled}
      >
        <StudioSection kind="content">
        <GeneratorModeToggle
          value={mode}
          onChange={handleModeChange}
          options={[
            { value: "T2I", label: "Nieuwe afbeelding" },
            { value: "I2I", label: "Bestaand beeld aanpassen" },
          ]}
        />

        <div className="space-y-2">
          <Label htmlFor="image-prompt">Beschrijf je idee</Label>
          <Textarea
            id="image-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={4}
            className="min-h-[120px] resize-y border-border/70 bg-background/50"
            placeholder="Bijvoorbeeld: minimalistische productfoto op marmeren achtergrond, warm licht, premium look"
          />
          <BrandPromptPreview
            brand={brandKit.data}
            prompt={prompt}
            modelType={mode === "I2I" ? "IMAGE_I2I" : "IMAGE"}
          />
        </div>

        <StudioSection kind="advanced">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
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
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {aspectOptions.map((ratio) => (
                  <SelectItem key={ratio} value={ratio}>
                    {ratio}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                <Label>Kwaliteit</Label>
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

        </StudioSection>
        {mode === "I2I" ? (
          <div className={studioSectionClass}>
            <ReferencePicker
              selectedUrls={referenceUrls}
              onChange={(urls) => {
                setReferenceUrls(urls);
                if (urls.length) handleModeChange("I2I");
              }}
              maxItems={maxReferences}
            />
            <div className="space-y-1">
              <Label htmlFor="image-reference-url">Referentie URL toevoegen</Label>
              <Input
                id="image-reference-url"
                placeholder="https://..."
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  const value = (event.target as HTMLInputElement).value.trim();
                  if (!value) return;
                  setReferenceUrls((current) => Array.from(new Set([...current, value])).slice(0, maxReferences));
                  (event.target as HTMLInputElement).value = "";
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="image-reference-files">Nieuwe referenties uploaden</Label>
              <Input
                id="image-reference-files"
                type="file"
                accept="image/*"
                multiple
                disabled={referenceUploading}
                onChange={(event) => void handleReferenceFilesChange(event.target.files)}
              />
              <p className="text-xs text-muted-foreground">
                Tot {maxReferences} referenties · max 10MB per bestand
              </p>
            </div>
            {referenceFiles.length ? (
              <p className="text-xs text-muted-foreground">
                Geselecteerd: {referenceFiles.map((file) => file.name).join(", ")}
              </p>
            ) : null}
            {referenceError ? (
              <p className="text-sm text-destructive" role="alert">{referenceError}</p>
            ) : null}
          </div>
        ) : null}

        </StudioSection>
        <StudioSection kind="result">
        <CreditQuote pricing={pricing} />
        <GenerateButton
          onClick={handleGenerate}
          disabled={!pricing.canGenerate ||
            !prompt.trim() ||
            Boolean(referenceError) ||
            (mode === "I2I" && !hasReferenceImages) ||
            isSubmitting
          }
          isLoading={isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Genereer afbeelding
        </GenerateButton>

        <MediaJobProgress
          status={job.status}
          elapsedSeconds={job.elapsedSeconds}
          pollError={job.pollError}
          onRetry={job.refresh}
          hint="Afbeeldingen zijn meestal binnen 1 minuut klaar."
        />

        {job.outputUrl ? (
          <CreativePreview
            label="Gegenereerde afbeelding"
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
                  <Link href={`/social?imageJob=${jobId}`}>Gebruik in Social Post</Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/social?tab=agenda&imageJob=${jobId}`}>
                    <CalendarDays className="mr-2 h-3.5 w-3.5" />
                    Plan in agenda
                  </Link>
                </Button>
              </>
            }
          >
            <img
              src={job.blobUrl || job.outputUrl}
              alt="Gegenereerde afbeelding"
              loading="lazy"
              decoding="async"
              className="max-h-[28rem] w-full object-contain"
            />
          </CreativePreview>
        ) : null}

        {job.errorMessage ? (
          <p className="text-sm text-destructive" role="alert">{job.errorMessage}</p>
        ) : null}
        </StudioSection>
      </GeneratorShell>
    </MuapiKeyGate>
  );
}
