"use client";

import { StudioHelp } from "./studio-context";
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

  return <StudioHelp label="Hoe wordt mijn merk gebruikt?"><p className="mb-2 font-medium">Je merkkit wordt automatisch toegepast.</p><p className="whitespace-pre-wrap">{preview}</p></StudioHelp>;
}
