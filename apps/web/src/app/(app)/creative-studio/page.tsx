"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { uploadSocialAssetFile } from "@/lib/persist-social-assets";
import { Button, Input, Label } from "@digitify/ui";
import {
  ImageIcon,
  Film,
  Mic,
  Megaphone,
  CalendarDays,
  ArrowLeft,
  Library,
  Palette,
  Wallet,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import {
  StudioContext,
  StudioHelp,
  type StudioState,
} from "@/components/creative-studio/studio-context";
import {
  CreativeCreditsPanel,
  CreativePricingAdmin,
} from "@/components/creative-studio/creative-credits-panel";
import { GenerationHistory } from "@/components/creative-studio/generation-history";
import { BrandKitPanel } from "@/components/creative-studio/brand-kit-panel";
const ImageGenerator = dynamic(
  () =>
    import("@/components/creative-studio/image-generator").then(
      (m) => m.ImageGenerator,
    ),
  { ssr: false },
);
const VideoGenerator = dynamic(
  () =>
    import("@/components/creative-studio/video-generator").then(
      (m) => m.VideoGenerator,
    ),
  { ssr: false },
);
const LipSyncGenerator = dynamic(
  () =>
    import("@/components/creative-studio/lip-sync-generator").then(
      (m) => m.LipSyncGenerator,
    ),
  { ssr: false },
);
const MarketingAdGenerator = dynamic(
  () =>
    import("@/components/creative-studio/marketing-ad-generator").then(
      (m) => m.MarketingAdGenerator,
    ),
  { ssr: false },
);
const SocialComposer = dynamic(
  () => import("../social/social-page-inner").then((m) => m.SocialPageInner),
  { ssr: false },
);
type Goal = "social" | "ads" | "images" | "video" | "lipsync";
const goals = [
  {
    id: "social",
    label: "Social post",
    icon: CalendarDays,
    hint: "Maak en plan een post",
  },
  {
    id: "ads",
    label: "Advertentiemateriaal",
    icon: Megaphone,
    hint: "Voor Meta of Google Ads",
  },
  {
    id: "images",
    label: "Afbeelding maken of bewerken",
    icon: ImageIcon,
    hint: "Van idee of bestaand beeld",
  },
  {
    id: "video",
    label: "Video maken",
    icon: Film,
    hint: "Van tekst of een startbeeld",
  },
  {
    id: "lipsync",
    label: "Sprekende video",
    icon: Mic,
    hint: "Combineer beeld met audio",
  },
] as const;
const steps = ["Doel en merk", "Inhoud", "Maken en bekijken", "Gebruiken"];
export default function CreativeStudioPage() {
  const router = useRouter();
  const params = useSearchParams();
  const paramsRef = useRef(params.toString());
  paramsRef.current = params.toString();
  const routerRef = useRef(router);
  routerRef.current = router;
  const tab = params.get("tab");
  const draftParam = params.get("draft");
  const [goal, setGoal] = useState<Goal | null>(
    goals.some((g) => g.id === tab) ? (tab as Goal) : null,
  );
  const [step, setStep] = useState(0);
  const [state, setState] = useState<StudioState>({
    generatorType:
      tab === "ads"
        ? "ads"
        : tab === "video"
          ? "video"
          : tab === "lipsync"
            ? "lipsync"
            : "images",
    brandKitId: params.get("brandKitId") || "",
    targetPlanId: params.get("targetPlanId") || undefined,
  });
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const draftRef = useRef<{ id?: string; revision: number }>({ revision: 0 });
  const savedSnapshot = useRef("");
  const saving = useRef(false);
  const saveInFlight = useRef<Promise<boolean> | null>(null);
  const latest = useRef({ goal, step, state });
  latest.current = { goal, step, state };
  const saveMutation = trpc.media.saveCreativeDraft.useMutation();
  const saveMutate = useRef(saveMutation.mutateAsync);
  saveMutate.current = saveMutation.mutateAsync;
  const drafts = trpc.media.listCreativeDrafts.useQuery();
  const draft = trpc.media.getCreativeDraft.useQuery(
    { id: draftParam || "" },
    { enabled: Boolean(draftParam), retry: false },
  );
  const kits = trpc.social.listBrandKits.useQuery();
  const metaTargets = trpc.metaAds.listDrafts.useQuery(undefined, {
    enabled: goal === "ads" && state.destination !== "google",
  });
  const googleTargets = trpc.googleAds.listDrafts.useQuery(undefined, {
    enabled: goal === "ads" && state.destination === "google",
  });
  const targetPlans =
    state.destination === "google" ? googleTargets.data : metaTargets.data;
  const wallet = trpc.media.getCreativeCredits.useQuery(undefined, {
    staleTime: 10000,
  });
  const connection = trpc.social.connectionStatus.useQuery(undefined, {
    enabled: goal === "social",
    staleTime: 60000,
  });
  const handoff = trpc.media.prepareCreativeHandoff.useMutation();
  const [socialReady, setSocialReady] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const type = state.generatorType || "images";
  const jobId = state.fields?.[`${type}:jobId`] as string | undefined;
  const job = trpc.media.getJobStatus.useQuery(
    { jobId: jobId || "" },
    {
      enabled: Boolean(jobId),
      retry: false,
      refetchInterval: (q) =>
        q.state.data?.status === "COMPLETED" ||
        q.state.data?.status === "FAILED"
          ? false
          : 3000,
    },
  );
  const uploadedUrl = state.fields?.["upload:url"] as string | undefined;
  const uploadedType = String(state.fields?.["upload:type"] || "IMAGE");
  const creativeBrief = String(
    state.fields?.[`${state.generatorType || "images"}:prompt`] || "",
  );
  const creative = useMemo(
    () =>
      jobId
        ? {
            jobId,
            type: job.data?.type || "IMAGE",
            socialPostId: job.data?.socialPostId || undefined,
            brief: creativeBrief,
            brandKitId: state.brandKitId,
          }
        : uploadedUrl
          ? {
              assetUrl: uploadedUrl,
              type: uploadedType,
              brandKitId: state.brandKitId,
            }
          : undefined,
    [
      jobId,
      job.data?.type,
      job.data?.socialPostId,
      state.brandKitId,
      creativeBrief,
      uploadedUrl,
      uploadedType,
    ],
  );
  useEffect(() => {
    if (!tab && !draftParam) setGoal(null);
  }, [tab, draftParam]);
  const loadedRef = useRef("");
  useEffect(() => {
    if (
      !draft.data ||
      loadedRef.current === draft.data.id ||
      draftRef.current.id === draft.data.id
    )
      return;
    loadedRef.current = draft.data.id;
    draftRef.current = { id: draft.data.id, revision: draft.data.revision };
    setGoal(draft.data.goal as Goal);
    setStep(draft.data.step);
    const restored = draft.data.state as StudioState;
    const fields = { ...restored.fields };
    for (const [key, value] of Object.entries(fields)) {
      const index = key.indexOf(":social:");
      if (index !== -1 && !(key.slice(index + 1) in fields))
        fields[key.slice(index + 1)] = value;
    }
    setState({ ...restored, fields });
    setSaved(true);
  }, [draft.data]);
  const save = useCallback(async (): Promise<boolean> => {
    if (!latest.current.goal) return false;
    if (saveInFlight.current) return saveInFlight.current;
    const operation = (async (): Promise<boolean> => {
    const snapshot = JSON.stringify(latest.current);
    if (snapshot === savedSnapshot.current) {
      setSaved(true);
      return true;
    }
    saving.current = true;
    try {
      const current = latest.current;
      const fields = current.state.fields;
      const activeJob = fields?.[
        `${current.state.generatorType || "images"}:jobId`
      ] as string | undefined;
      const wasNew = !draftRef.current.id;
      const result = await saveMutate.current({
        ...draftRef.current,
        goal: current.goal!,
        step: current.step,
        state: current.state as Record<string, unknown>,
        jobId: activeJob || null,
      });
      draftRef.current = { id: result.id, revision: result.revision };
      if (wasNew || !new URLSearchParams(paramsRef.current).has("draft")) {
        const nextParams = new URLSearchParams(paramsRef.current);
        nextParams.set("draft", result.id);
        routerRef.current.replace(`/creative-studio?${nextParams}`);
      }
      savedSnapshot.current = snapshot;
      setSaved(true);
      setSaveError("");
      return true;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Opslaan mislukt.");
      return false;
    } finally {
      saving.current = false;
    }
    })();
    saveInFlight.current = operation;
    try {
      return await operation;
    } finally {
      if (saveInFlight.current === operation) saveInFlight.current = null;
    }
  }, []);
  useEffect(() => {
    if (!goal || (draftParam && !draft.data)) return;
    setSaved(false);
    const timer = setTimeout(() => void save(), 600);
    return () => clearTimeout(timer);
  }, [goal, step, state, draftParam, draft.data, save]);
  // An edit made while a save was running is saved by the next interval.
  useEffect(() => {
    const timer = setInterval(() => {
      // Autosave retries after a transient API/database error. The error stays
      // visible so the user knows what happened, while the next attempt can
      // recover without requiring a full page refresh.
      if (!saving.current) void save();
    }, 2000);
    return () => clearInterval(timer);
  }, [save]);
  function changeMediaType(next: string) {
    setSocialReady(false);
    setState((previous) => {
      const old = previous.generatorType || "images";
      const format = String(
        previous.fields?.[`${old}:placementFormat`] ||
          (goal === "ads"
            ? previous.slot === "square"
              ? "SQUARE"
              : "LANDSCAPE"
            : "SQUARE"),
      );
      const ratio =
        format === "STORY"
          ? "9:16"
          : format === "LANDSCAPE"
            ? "16:9"
            : format === "PORTRAIT"
              ? "4:5"
              : "1:1";
      return {
        ...previous,
        generatorType: next,
        fields: {
          ...previous.fields,
          [`${next}:placementFormat`]: format,
          [`${next}:aspectRatio`]: ratio,
        },
      };
    });
  }
  function begin(next: Goal) {
    if (saving.current) return;
    draftRef.current = { revision: 0 };
    savedSnapshot.current = "";
    loadedRef.current = "";
    setGoal(next);
    setStep(0);
    setSaveError("");
    setSocialReady(false);
    setState({
      generatorType:
        next === "video" ? "video" : next === "lipsync" ? "lipsync" : "images",
      brandKitId: kits.data?.kits.find((k) => k.isDefault)?.id || "",
      destination: next === "ads" ? "meta" : "social",
      fields:
        next === "ads"
          ? {
              "images:aspectRatio": "16:9",
              "images:placementFormat": "LANDSCAPE",
            }
          : {},
    });
    router.replace(`/creative-studio?tab=${next}`);
  }
  async function handleUseResult(destination: "social" | "meta" | "google") {
    if (type === "upload" && uploadedUrl && destination === "social") {
      await save();
      setSocialReady(true);
      return;
    }
    if (!jobId) return;
    await save();
    try {
      const result = await handoff.mutateAsync({
        jobId,
        destination,
        brandKitId: state.brandKitId || undefined,
        draftId: draftRef.current.id,
        targetPlanId: goal === "ads" ? state.targetPlanId : undefined,
        slot: state.slot === "square" ? "square" : "landscape",
      });
      if (destination === "social" && goal === "social") setSocialReady(true);
      else router.push(result.href);
    } catch {
      /* mutation renders its actionable error below */
    }
  }
  const secondary = ["history", "brand", "credits", "pricing"].includes(
    tab || "",
  );
  const brandMissing = Boolean(
    kits.data &&
      state.brandKitId &&
      !kits.data.kits.some((kit) => kit.id === state.brandKitId),
  );
  const jobMetadata = job.data?.metadata as
    | Record<string, unknown>
    | null
    | undefined;
  const matchesInputs =
    !jobId ||
    (state.fields?.[`${type}:staleJobId`] !== jobId &&
      String(jobMetadata?.brandKitId || "") ===
        String(state.brandKitId || "") &&
      (state.fields?.[`${type}:prompt`] === undefined ||
        state.fields[`${type}:prompt`] === job.data?.prompt) &&
      (state.fields?.[`${type}:model`] === undefined ||
        state.fields[`${type}:model`] === job.data?.model) &&
      ["aspectRatio", "resolution", "quality", "duration"].every(
        (field) =>
          state.fields?.[`${type}:${field}`] === undefined ||
          String(state.fields[`${type}:${field}`] || "") ===
            String(jobMetadata?.[field] || ""),
      ));
  const ready =
    type === "upload"
      ? Boolean(uploadedUrl)
      : job.data?.status === "COMPLETED" && matchesInputs;

  return (
    <StudioContext.Provider
      value={{
        state,
        setState,
        step,
        draftId: draftRef.current.id || draftParam || undefined,
      }}
    >
      <div className="mx-auto max-w-6xl space-y-5 p-4 pb-24 sm:p-6 sm:pb-24">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Creative Studio</h1>
            <p className="text-sm text-muted-foreground">
              Van idee naar content.
            </p>
          </div>
          <nav aria-label="Creative Studio" className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/creative-studio">Nieuw</Link>
            </Button>
            {[
              { id: "history", label: "Bibliotheek", icon: Library },
              { id: "brand", label: "Merkkits", icon: Palette },
              { id: "credits", label: "Credits", icon: Wallet },
            ].map((item) => (
              <Button
                key={item.id}
                variant={tab === item.id ? "default" : "outline"}
                size="sm"
                asChild
              >
                <Link href={`/creative-studio?tab=${item.id}`}>
                  <item.icon className="mr-1 h-4 w-4" />
                  {item.label}
                </Link>
              </Button>
            ))}
          </nav>
        </header>
        {tab === "history" ? (
          <GenerationHistory />
        ) : tab === "brand" ? (
          <>
            <div className="flex items-center gap-3">
              <h2 className="font-semibold">Gedeelde merkkits</h2>
              <Button asChild variant="outline">
                <Link href="/social?tab=composer">
                  Merken beheren in Social Planner
                </Link>
              </Button>
            </div>
            <BrandKitPanel />
          </>
        ) : tab === "credits" ? (
          <CreativeCreditsPanel />
        ) : tab === "pricing" ? (
          <CreativePricingAdmin />
        ) : (
          <>
            {(!goal || step === 0) && (
              <>
                <h2 className="text-lg font-semibold">Wat wil je maken?</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {goals.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => begin(item.id)}
                      className={`rounded-xl border p-5 text-left transition hover:border-primary focus-visible:ring-2 focus-visible:ring-primary ${goal === item.id ? "border-primary bg-primary/5" : "bg-card"}`}
                    >
                      <item.icon className="mb-3 h-6 w-6 text-primary" />
                      <span className="block font-semibold">{item.label}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {item.hint}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {!goal && drafts.data && drafts.data.length > 0 && (
              <div className="space-y-2">
                <h2 className="font-semibold">Verder werken</h2>
                {drafts.data.map((item) => (
                  <Button
                    key={item.id}
                    asChild
                    variant="outline"
                    className="mr-2"
                  >
                    <Link href={`/creative-studio?draft=${item.id}`}>
                      {goals.find((g) => g.id === item.goal)?.label} · stap{" "}
                      {item.step + 1}
                    </Link>
                  </Button>
                ))}
              </div>
            )}
            {draft.isError && (
              <p role="alert" className="text-destructive">
                {draft.error.message}
              </p>
            )}
            {goal && (
              <>
                <nav aria-label="Voortgang" className="grid grid-cols-4 gap-2">
                  {steps.map((label, index) => (
                    <button
                      key={label}
                      disabled={index > step}
                      onClick={() => setStep(index)}
                      aria-current={index === step ? "step" : undefined}
                      className={`rounded-lg border px-2 py-3 text-xs sm:text-sm ${index === step ? "border-primary bg-primary/10 font-semibold" : "text-muted-foreground"}`}
                    >
                      {index + 1}. {label}
                    </button>
                  ))}
                </nav>
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {saved ? "Concept opgeslagen" : "Concept opslaan…"}
                  </span>
                  {wallet.data?.enabled && (
                    <Link href="/creative-studio?tab=credits">
                      {wallet.data.available} credits
                    </Link>
                  )}
                </div>
                {jobId && !matchesInputs && step === 2 && (
                  <p role="alert" className="text-sm">
                    ! Deze creatie hoort bij eerdere instellingen. Maak een
                    nieuwe variant.
                  </p>
                )}
                {brandMissing && (
                  <p role="alert" className="text-sm text-destructive">
                    ! Je gekozen merkkit bestaat niet meer.{" "}
                    <button className="underline" onClick={() => setStep(0)}>
                      Kies een merk
                    </button>
                    .
                  </p>
                )}
                {saveError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-destructive p-3 text-sm text-destructive"
                  >
                    ! {saveError}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void save()}
                    >
                      Opnieuw opslaan
                    </Button>
                  </div>
                )}
                {step === 0 && (
                  <div className="space-y-4 rounded-xl border p-5">
                    <Label>
                      Merk
                      <select
                        className="mt-2 block w-full rounded-lg border bg-background p-3"
                        value={state.brandKitId || ""}
                        onChange={(e) =>
                          setState((s) => ({
                            ...s,
                            brandKitId: e.target.value,
                            fields: { ...s.fields, [`${type}:jobId`]: null },
                          }))
                        }
                      >
                        <option value="">Standaard bedrijfsmerk</option>
                        {kits.data?.kits.map((kit) => (
                          <option key={kit.id} value={kit.id}>
                            {kit.name}
                          </option>
                        ))}
                      </select>
                    </Label>
                    <StudioHelp label="Uitleg merkkit">
                      Logo, stijl en merkstem gaan mee naar je creatie en post.
                    </StudioHelp>
                    {(goal === "social" || goal === "ads") && (
                      <Label>
                        Maak
                        <select
                          className="mt-2 block w-full rounded-lg border bg-background p-3"
                          value={type}
                          onChange={(e) => changeMediaType(e.target.value)}
                        >
                          <option value="images">Afbeelding</option>
                          {goal === "social" && (
                            <option value="upload">
                              Eigen afbeelding of video uploaden
                            </option>
                          )}
                          {state.destination !== "google" && (
                            <>
                              <option value="video">Video</option>
                              {goal === "ads" && (
                                <option value="ads">
                                  Productadvertentievideo
                                </option>
                              )}
                            </>
                          )}
                        </select>
                      </Label>
                    )}
                    {goal === "social" && (
                      <>
                        <Label>
                          Account
                          <select
                            value={String(
                              state.fields?.[`social:selectedPageId`] || "",
                            )}
                            className="mt-2 block w-full rounded-lg border bg-background p-3"
                            onChange={(e) =>
                              setState((s) => ({
                                ...s,
                                fields: {
                                  ...s.fields,
                                  [`social:selectedPageId`]: e.target.value,
                                },
                              }))
                            }
                          >
                            <option value="">Kies een pagina</option>
                            {connection.data?.pages?.map((page) => (
                              <option key={page.id} value={page.id}>
                                {page.name}
                              </option>
                            ))}
                          </select>
                        </Label>
                        <Label>
                          Kanaal
                          <select
                            className="mt-2 block w-full rounded-lg border bg-background p-3"
                            onChange={(e) =>
                              setState((s) => ({
                                ...s,
                                fields: {
                                  ...s.fields,
                                  [`social:targetFacebook`]:
                                    e.target.value !== "instagram",
                                  [`social:targetInstagram`]:
                                    e.target.value !== "facebook",
                                },
                              }))
                            }
                            value={
                              state.fields?.[`social:targetFacebook`] === false
                                ? "instagram"
                                : state.fields?.[`social:targetInstagram`] ===
                                    false
                                  ? "facebook"
                                  : "both"
                            }
                          >
                            <option value="both">Facebook en Instagram</option>
                            <option value="facebook">Facebook</option>
                            <option value="instagram">Instagram</option>
                          </select>
                        </Label>
                        <Label>
                          Plaatsing
                          <select
                            className="mt-2 block w-full rounded-lg border bg-background p-3"
                            value={String(
                              state.fields?.[`${type}:placementFormat`] ||
                                "SQUARE",
                            )}
                            onChange={(e) =>
                              setState((s) => ({
                                ...s,
                                fields: {
                                  ...s.fields,
                                  [`${type}:placementFormat`]: e.target.value,
                                  [`${type}:aspectRatio`]:
                                    e.target.value === "STORY" ? "9:16" : "1:1",
                                  [`social:placements`]: [
                                    e.target.value === "STORY"
                                      ? "STORY"
                                      : "FEED",
                                  ],
                                },
                              }))
                            }
                          >
                            <option value="SQUARE">Feed</option>
                            <option value="STORY">Story</option>
                          </select>
                        </Label>
                        {!connection.data?.pages?.length && (
                          <p className="text-sm">
                            ! Geen account gekoppeld. Je kunt content maken en
                            later een account koppelen.
                          </p>
                        )}
                      </>
                    )}
                    {goal === "ads" && (
                      <>
                        <Label>
                          Bestemming
                          <select
                            className="mt-2 block w-full rounded-lg border bg-background p-3"
                            value={state.destination || "meta"}
                            onChange={(e) =>
                              setState((s) => ({
                                ...s,
                                destination: e.target.value,
                                targetPlanId: undefined,
                                generatorType:
                                  e.target.value === "google"
                                    ? "images"
                                    : s.generatorType,
                              }))
                            }
                          >
                            <option value="meta">Meta Ads</option>
                            <option value="google">Google Ads</option>
                          </select>
                        </Label>
                        <Label>
                          Advertentieconcept
                          <select
                            className="mt-2 block w-full rounded-lg border bg-background p-3"
                            value={state.targetPlanId || ""}
                            onChange={(e) =>
                              setState((previous) => ({
                                ...previous,
                                targetPlanId: e.target.value || undefined,
                              }))
                            }
                          >
                            <option value="">Nieuw concept</option>
                            {targetPlans?.map((plan) => (
                              <option key={plan.id} value={plan.id}>
                                {plan.name}
                              </option>
                            ))}
                          </select>
                        </Label>
                        <Label>
                          Formaat
                          <select
                            className="mt-2 block w-full rounded-lg border bg-background p-3"
                            value={state.slot || "landscape"}
                            onChange={(e) =>
                              setState((s) => ({
                                ...s,
                                slot: e.target.value,
                                fields: {
                                  ...s.fields,
                                  [`${type}:aspectRatio`]:
                                    e.target.value === "square"
                                      ? "1:1"
                                      : "16:9",
                                  [`${type}:placementFormat`]:
                                    e.target.value === "square"
                                      ? "SQUARE"
                                      : "LANDSCAPE",
                                },
                              }))
                            }
                          >
                            <option value="landscape">Liggend</option>
                            <option value="square">Vierkant</option>
                          </select>
                        </Label>
                      </>
                    )}
                  </div>
                )}
                <div hidden={step !== 1 && step !== 2}>
                  {type === "upload" ? (
                    <div className="space-y-4 rounded-xl border p-5">
                      <Label>
                        Afbeelding of video
                        <Input
                          type="file"
                          accept="image/*,video/*"
                          disabled={uploading}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setUploading(true);
                            setUploadError("");
                            try {
                              const url = await uploadSocialAssetFile(file);
                              setState((current) => ({
                                ...current,
                                fields: {
                                  ...current.fields,
                                  "upload:url": url,
                                  "upload:type": file.type.startsWith("video/")
                                    ? "VIDEO"
                                    : "IMAGE",
                                },
                              }));
                            } catch (error) {
                              setUploadError(
                                error instanceof Error
                                  ? error.message
                                  : "Upload mislukt.",
                              );
                            } finally {
                              setUploading(false);
                            }
                          }}
                        />
                      </Label>
                      {uploading && <p>Uploaden…</p>}
                      {uploadError && (
                        <p role="alert" className="text-destructive">
                          {uploadError}
                        </p>
                      )}
                      {uploadedUrl &&
                        (uploadedType === "VIDEO" ? (
                          <video
                            src={uploadedUrl}
                            controls
                            className="max-h-80 w-full"
                          />
                        ) : (
                          <img
                            src={uploadedUrl}
                            alt="Je upload"
                            className="max-h-80 w-full object-contain"
                          />
                        ))}
                    </div>
                  ) : type === "images" ? (
                    <ImageGenerator socialPostId={params.get("socialPostId")} />
                  ) : type === "video" ? (
                    <VideoGenerator socialPostId={params.get("socialPostId")} />
                  ) : type === "ads" ? (
                    <MarketingAdGenerator />
                  ) : (
                    <LipSyncGenerator
                      socialPostId={params.get("socialPostId")}
                    />
                  )}
                </div>
                {step === 3 && (
                  <div className="space-y-4">
                    {goal === "social" && socialReady && creative ? (
                      <SocialComposer
                        creative={creative}
                        onSaveConcept={save}
                      />
                    ) : (
                      <div className="space-y-3 rounded-xl border p-5">
                        <h2 className="text-lg font-semibold">
                          Je creatie gebruiken
                        </h2>
                        <Button
                          disabled={!ready || handoff.isPending}
                          onClick={() =>
                            void handleUseResult(
                              goal === "ads"
                                ? state.destination === "google"
                                  ? "google"
                                  : "meta"
                                : "social",
                            )
                          }
                        >
                          {handoff.isPending
                            ? "Opslaan…"
                            : goal === "social"
                              ? "Post afwerken en inplannen"
                              : goal === "ads"
                                ? "Gebruik in advertentie"
                                : "Gebruik in Social Planner"}
                        </Button>
                        {job.data?.blobUrl && (
                          <Button variant="outline" asChild>
                            <a href={job.data.blobUrl} download>
                              Download
                            </a>
                          </Button>
                        )}
                        <Button variant="outline" asChild>
                          <Link href="/creative-studio?tab=history">
                            Bekijk bibliotheek
                          </Link>
                        </Button>
                      </div>
                    )}
                    {handoff.error && (
                      <p className="text-destructive" role="alert">
                        ! {handoff.error.message}
                      </p>
                    )}
                  </div>
                )}
                <footer className="flex justify-between border-t pt-4">
                  <Button
                    variant="ghost"
                    disabled={step === 0}
                    onClick={() => setStep((s) => s - 1)}
                  >
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    Terug
                  </Button>
                  {step < 3 && (
                    <Button
                      disabled={
                        brandMissing ||
                        (step === 2 && !ready)
                      }
                      onClick={() => {
                        void save().then((didSave) => {
                          if (didSave) setStep((s) => s + 1);
                        });
                      }}
                    >
                      {step === 2 ? "Gebruik resultaat" : "Volgende"}
                    </Button>
                  )}
                </footer>
              </>
            )}
          </>
        )}
        {secondary && (
          <Button variant="ghost" asChild>
            <Link href="/creative-studio">Terug naar maken</Link>
          </Button>
        )}
      </div>
    </StudioContext.Provider>
  );
}
