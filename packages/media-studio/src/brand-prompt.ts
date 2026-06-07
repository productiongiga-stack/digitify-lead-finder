import type { MediaModelType } from "./models";

export type CreativeBrandContext = {
  enabled: boolean;
  includeLogo: boolean;
  companyName?: string;
  slogan?: string;
  primaryColor?: string;
  niche?: string;
  website?: string;
  brandVoice?: string;
  brandKeywords?: string;
  brandAvoid?: string;
  brandSummary?: string;
  trainingNotes?: string;
  businessContext?: string;
  logoUrl?: string;
  autoImport?: boolean;
};

export type BrandGenerationInput = {
  prompt: string;
  modelType: MediaModelType;
  imageUrl?: string;
  imagesList?: string[];
};

export type BrandGenerationResult = {
  prompt: string;
  imageUrl?: string;
  imagesList?: string[];
  brandApplied: boolean;
};

function compactLines(parts: Array<string | undefined>): string[] {
  return parts.map((part) => part?.trim()).filter((part): part is string => Boolean(part));
}

export function buildBrandPromptSuffix(brand: CreativeBrandContext): string {
  if (!brand.enabled) return "";

  const lines = compactLines([
    brand.companyName ? `Merk: ${brand.companyName}` : undefined,
    brand.slogan ? `Slogan: ${brand.slogan}` : undefined,
    brand.niche ? `Sector/niche: ${brand.niche}` : undefined,
    brand.website ? `Website: ${brand.website}` : undefined,
    brand.primaryColor ? `Primaire merkkleur: ${brand.primaryColor}` : undefined,
    brand.brandVoice ? `Tone of voice: ${brand.brandVoice}` : undefined,
    brand.brandKeywords ? `Merkwoorden: ${brand.brandKeywords}` : undefined,
    brand.brandSummary ? `Bedrijfscontext: ${brand.brandSummary}` : undefined,
    brand.trainingNotes ? `Extra bedrijfsinfo: ${brand.trainingNotes}` : undefined,
    brand.businessContext ? `Diensten & aanbod: ${brand.businessContext}` : undefined,
    brand.brandAvoid ? `Vermijd: ${brand.brandAvoid}` : undefined,
    "Maak een on-brand marketingbeeld dat past bij dit bedrijf. Gebruik de merknaam, slogan en kleuren consistent in stijl en sfeer.",
    brand.includeLogo && brand.logoUrl
      ? "Er is een logo-referentie meegegeven: respecteer vorm, kleur en herkenbaarheid van het logo in het eindresultaat."
      : undefined,
  ]);

  if (!lines.length) return "";
  return `\n\n--- Merkcontext ---\n${lines.join("\n")}`;
}

export function applyBrandToGeneration(
  brand: CreativeBrandContext,
  input: BrandGenerationInput,
): BrandGenerationResult {
  const suffix = buildBrandPromptSuffix(brand);
  if (!suffix) {
    return {
      prompt: input.prompt,
      imageUrl: input.imageUrl,
      imagesList: input.imagesList,
      brandApplied: false,
    };
  }

  let imageUrl = input.imageUrl;
  let imagesList = input.imagesList ? [...input.imagesList] : undefined;

  if (brand.includeLogo && brand.logoUrl) {
    if (input.modelType === "IMAGE_I2I" || input.modelType === "MARKETING_AD") {
      imagesList = [brand.logoUrl, ...(imagesList ?? [])].filter(
        (url, index, urls) => urls.indexOf(url) === index,
      );
    } else if (!imageUrl && (!imagesList || imagesList.length === 0)) {
      imageUrl = brand.logoUrl;
    }
  }

  return {
    prompt: `${input.prompt.trim()}${suffix}`,
    imageUrl,
    imagesList,
    brandApplied: true,
  };
}
