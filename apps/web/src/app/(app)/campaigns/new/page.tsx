"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Textarea,
  Label,
} from "@digitify/ui";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  CAMPAIGN_PROFILE_OPTIONS,
  type CampaignProfileType,
} from "@/lib/campaign-profile";
import { useToast } from "@/components/feedback/toast-provider";

export default function NewCampaignPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const [profileType, setProfileType] = useState<CampaignProfileType>("LEAD_OUTREACH");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    niche: "",
    region: "",
    targetAudience: "",
    idealScore: 70,
    toneOfVoice: "",
    goal: "",
  });

  const createCampaign = trpc.campaign.create.useMutation({
    onSuccess: (campaign) => {
      setSubmitError(null);
      utils.campaign.list.invalidate();
      showToast({
        title: "Campagneprofiel aangemaakt",
        description: campaign.name,
        variant: "success",
      });
      router.push(`/campaigns/${campaign.id}`);
    },
    onError: (error) => {
      const message = error.message || "Campagneprofiel aanmaken mislukt.";
      setSubmitError(message);
      showToast({
        title: "Aanmaken mislukt",
        description: message,
        variant: "error",
      });
    },
  });

  const isReview = profileType === "REVIEW_REQUEST";
  const nameValid = form.name.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nameValid) return;
    setSubmitError(null);
    createCampaign.mutate({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      targetAudience: form.targetAudience.trim() || undefined,
      toneOfVoice: form.toneOfVoice.trim() || undefined,
      goal: form.goal.trim() || undefined,
      profileType,
      idealScore: isReview ? undefined : form.idealScore,
      niche: isReview ? undefined : form.niche.trim() || undefined,
      region: isReview ? undefined : form.region.trim() || undefined,
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Link href="/campaigns">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Nieuw campagneprofiel</h1>
          <p className="text-sm text-muted-foreground">
            Kies het type automatisering en vul de basis in
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {CAMPAIGN_PROFILE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = profileType === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setProfileType(option.value)}
              className={cn(
                "rounded-xl border p-4 text-left transition-all",
                selected
                  ? "border-primary/50 bg-primary/5 ring-2 ring-primary/20"
                  : "border-border/60 bg-card hover:border-primary/25",
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                    selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold">{option.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Basisinformatie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Naam *</Label>
              <Input
                placeholder={
                  isReview ? "bv. Review na project afronding" : "bv. Webdesign Gent"
                }
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Beschrijving</Label>
              <Textarea
                placeholder="Beschrijf het doel van dit profiel..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            {!isReview ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Niche</Label>
                  <Input
                    placeholder="bv. Webdesign"
                    value={form.niche}
                    onChange={(e) => setForm({ ...form, niche: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Regio</Label>
                  <Input
                    placeholder="bv. Gent"
                    value={form.region}
                    onChange={(e) => setForm({ ...form, region: e.target.value })}
                  />
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              {isReview ? "Review-flow" : "Targeting"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Doelgroep</Label>
              <Textarea
                placeholder={
                  isReview
                    ? "bv. Klanten na oplevering, met e-mailadres"
                    : "bv. KMO's zonder moderne website"
                }
                value={form.targetAudience}
                onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
              />
            </div>
            {!isReview ? (
              <div className="space-y-2">
                <Label>Ideale score (minimaal)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.idealScore}
                  onChange={(e) =>
                    setForm({ ...form, idealScore: parseInt(e.target.value, 10) || 0 })
                  }
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Tone of voice</Label>
              <Input
                placeholder="bv. Vriendelijk en professioneel"
                value={form.toneOfVoice}
                onChange={(e) => setForm({ ...form, toneOfVoice: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Doelstelling</Label>
              <Input
                placeholder={
                  isReview
                    ? "bv. 30% meer Google-reviews per kwartaal"
                    : "bv. 20 gekwalificeerde leads per maand"
                }
                value={form.goal}
                onChange={(e) => setForm({ ...form, goal: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-2">
          {submitError ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {submitError}
            </p>
          ) : null}
          <Button type="submit" disabled={!nameValid || createCampaign.isPending}>
            {createCampaign.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Profiel aanmaken
          </Button>
        </div>
      </form>
    </div>
  );
}
