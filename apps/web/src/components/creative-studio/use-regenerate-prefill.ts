"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { metadataRecord } from "./generator-utils";

type PrefillHandlers = {
  onPrefill: (payload: {
    prompt: string;
    model: string;
    aspectRatio?: string;
    resolution?: string;
    quality?: string;
    duration?: string;
    imageUrl?: string;
    imagesList?: string[];
    socialPostId?: string | null;
  }) => void;
  expectedType?: "IMAGE" | "VIDEO" | "MARKETING_AD" | "LIP_SYNC";
};

export function useRegeneratePrefill({ onPrefill, expectedType }: PrefillHandlers) {
  const searchParams = useSearchParams();
  const regenerateId = searchParams.get("regenerate");

  const regenerateQuery = trpc.media.getRegeneratePayload.useQuery(
    { jobId: regenerateId ?? "" },
    { enabled: Boolean(regenerateId) },
  );

  const appliedJobId = useRef<string | null>(null);

  useEffect(() => {
    if (!regenerateQuery.data) return;
    if (expectedType && regenerateQuery.data.type !== expectedType) return;
    if (appliedJobId.current === regenerateQuery.data.jobId) return;

    const metadata = metadataRecord(regenerateQuery.data.metadata);
    appliedJobId.current = regenerateQuery.data.jobId;
    onPrefill({
      prompt: regenerateQuery.data.prompt,
      model: regenerateQuery.data.model,
      aspectRatio: typeof metadata.aspectRatio === "string" ? metadata.aspectRatio : undefined,
      resolution: typeof metadata.resolution === "string" ? metadata.resolution : undefined,
      quality: typeof metadata.quality === "string" ? metadata.quality : undefined,
      duration: metadata.duration != null ? String(metadata.duration) : undefined,
      imageUrl:
        typeof metadata.imageUrl === "string"
          ? metadata.imageUrl
          : typeof metadata.videoUrl === "string"
            ? metadata.videoUrl
            : undefined,
      imagesList: Array.isArray(metadata.imagesList)
        ? metadata.imagesList.filter((item): item is string => typeof item === "string")
        : undefined,
      socialPostId: regenerateQuery.data.socialPostId,
    });
  }, [expectedType, onPrefill, regenerateQuery.data]);
}
