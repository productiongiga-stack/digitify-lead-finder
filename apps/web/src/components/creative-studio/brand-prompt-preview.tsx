"use client";

import { useMemo } from "react";
import { applyBrandToGeneration, type CreativeBrandContext, type MediaModelType } from "@digitify/media-studio";
import { Palette } from "lucide-react";
import Link from "next/link";

type Props = {
  brand?: CreativeBrandContext | null;
  prompt: string;
  modelType: MediaModelType;
};

export function BrandPromptPreview({ brand, prompt, modelType }: Props) {
  const preview = useMemo(() => {
    if (!brand?.enabled) return null;
    const result = applyBrandToGeneration(brand, {
      prompt: prompt.trim() || "Voorbeeldprompt",
      modelType,
    });
    if (!result.brandApplied) return null;
    return result.prompt;
  }, [brand, modelType, prompt]);

  if (!preview) return null;

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
      <div className="mb-1.5 flex items-center gap-1.5 font-medium text-foreground">
        <Palette className="h-3.5 w-3.5 text-primary" />
        Merkkit wordt toegevoegd aan de prompt
      </div>
      <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">{preview}</p>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Pas je merkkit aan via{" "}
        <Link href="/creative-studio?tab=brand" className="text-primary hover:underline">
          Creative Studio → Merkkit
        </Link>
        .
      </p>
    </div>
  );
}
