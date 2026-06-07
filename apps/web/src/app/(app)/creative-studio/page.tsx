"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@digitify/ui";
import { Building2, Clock3, Film, ImageIcon, Megaphone, Mic } from "lucide-react";
import { CreativeStudioHero, CreativeStudioStats } from "@/components/creative-studio/creative-studio-ui";
import { MUAPI_KEY_QUERY_OPTIONS } from "@/components/creative-studio/constants";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

const ImageGenerator = dynamic(
  () => import("@/components/creative-studio/image-generator").then((m) => m.ImageGenerator),
  { ssr: false },
);
const VideoGenerator = dynamic(
  () => import("@/components/creative-studio/video-generator").then((m) => m.VideoGenerator),
  { ssr: false },
);
const LipSyncGenerator = dynamic(
  () => import("@/components/creative-studio/lip-sync-generator").then((m) => m.LipSyncGenerator),
  { ssr: false },
);
const MarketingAdGenerator = dynamic(
  () => import("@/components/creative-studio/marketing-ad-generator").then((m) => m.MarketingAdGenerator),
  { ssr: false },
);
const BrandKitPanel = dynamic(
  () => import("@/components/creative-studio/brand-kit-panel").then((m) => m.BrandKitPanel),
  { ssr: false },
);
const GenerationHistory = dynamic(
  () => import("@/components/creative-studio/generation-history").then((m) => m.GenerationHistory),
  { ssr: false },
);

const VALID_TABS = ["images", "video", "lipsync", "ads", "brand", "history"] as const;
type CreativeTab = (typeof VALID_TABS)[number];

const TAB_ITEMS: Array<{ value: CreativeTab; label: string; icon: typeof ImageIcon }> = [
  { value: "images", label: "Afbeeldingen", icon: ImageIcon },
  { value: "video", label: "Video", icon: Film },
  { value: "lipsync", label: "Lip sync", icon: Mic },
  { value: "ads", label: "Advertenties", icon: Megaphone },
  { value: "brand", label: "Merkkit", icon: Building2 },
  { value: "history", label: "Historie", icon: Clock3 },
];

export default function CreativeStudioPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<CreativeTab>("images");

  const socialPostId = searchParams.get("socialPostId");

  const keyStatus = trpc.media.getMuapiKeyStatus.useQuery(undefined, MUAPI_KEY_QUERY_OPTIONS);
  const balance = trpc.media.getBalance.useQuery(undefined, {
    enabled: Boolean(keyStatus.data?.hasKey),
    retry: false,
  });
  const brandKit = trpc.media.getBrandKit.useQuery(undefined, MUAPI_KEY_QUERY_OPTIONS);
  const usageStats = trpc.media.getUsageStats.useQuery(undefined, {
    enabled: Boolean(keyStatus.data?.hasKey),
    staleTime: 30_000,
  });

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && VALID_TABS.includes(tab as CreativeTab)) {
      setActiveTab(tab as CreativeTab);
    }
  }, [searchParams]);

  const handleTabChange = useCallback(
    (tab: string) => {
      if (!VALID_TABS.includes(tab as CreativeTab)) return;
      setActiveTab(tab as CreativeTab);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      router.replace(`/creative-studio?${params.toString()}`);
    },
    [router, searchParams],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <CreativeStudioHero />

      <CreativeStudioStats
        isLoading={keyStatus.isLoading || brandKit.isLoading || usageStats.isLoading}
        hasKey={keyStatus.data?.hasKey}
        balance={balance.data?.balance}
        brandEnabled={brandKit.data?.enabled}
        monthGenerations={usageStats.data?.monthGenerations}
        monthSpendEur={usageStats.data?.monthSpendEur}
        failedJobs={usageStats.data?.failedJobs}
      />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList
          aria-label="Creative Studio secties"
          className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl border bg-muted/40 p-1"
        >
          {TAB_ITEMS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={cn(
                "gap-2 rounded-lg px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm",
              )}
            >
              <tab.icon className="h-4 w-4 shrink-0 opacity-70" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="brand" className="mt-0 space-y-6">
          <BrandKitPanel />
        </TabsContent>

        <TabsContent value="images" className="mt-0 space-y-8">
          <ImageGenerator socialPostId={socialPostId} />
          <GenerationHistory type="IMAGE" compact />
        </TabsContent>

        <TabsContent value="video" className="mt-0 space-y-8">
          <VideoGenerator socialPostId={socialPostId} />
          <GenerationHistory type="VIDEO" compact />
        </TabsContent>

        <TabsContent value="lipsync" className="mt-0 space-y-8">
          <LipSyncGenerator socialPostId={socialPostId} />
          <GenerationHistory type="LIP_SYNC" compact />
        </TabsContent>

        <TabsContent value="ads" className="mt-0 space-y-8">
          <MarketingAdGenerator />
          <GenerationHistory type="MARKETING_AD" compact />
        </TabsContent>

        <TabsContent value="history" className="mt-0 space-y-6">
          <GenerationHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
