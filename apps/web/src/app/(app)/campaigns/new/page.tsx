"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Textarea, Label } from "@digitify/ui";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

export default function NewCampaignPage() {
  const router = useRouter();
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
      router.push(`/campaigns/${campaign.id}`);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createCampaign.mutate({
      ...form,
      idealScore: form.idealScore || undefined,
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Link href="/campaigns">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Nieuwe Campagne</h1>
          <p className="text-sm text-muted-foreground">Maak een nieuwe lead generation campagne aan</p>
        </div>
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
                placeholder="bv. Webdesign Gent"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Beschrijving</Label>
              <Textarea
                placeholder="Beschrijf het doel van deze campagne..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
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
                  placeholder="bv. Gent, Oost-Vlaanderen"
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Targeting</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Doelgroep</Label>
              <Textarea
                placeholder="bv. KMO's zonder moderne website"
                value={form.targetAudience}
                onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Ideale Score (minimaal)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.idealScore}
                onChange={(e) => setForm({ ...form, idealScore: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Tone of Voice</Label>
              <Input
                placeholder="bv. Professioneel maar toegankelijk"
                value={form.toneOfVoice}
                onChange={(e) => setForm({ ...form, toneOfVoice: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Doelstelling</Label>
              <Input
                placeholder="bv. 20 nieuwe leads per maand"
                value={form.goal}
                onChange={(e) => setForm({ ...form, goal: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Button type="submit" disabled={!form.name || createCampaign.isPending}>
            {createCampaign.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Campagne Aanmaken
          </Button>
        </div>
      </form>
    </div>
  );
}
