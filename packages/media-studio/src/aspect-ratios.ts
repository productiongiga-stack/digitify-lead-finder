export type SocialPlacementFormat = "SQUARE" | "PORTRAIT" | "LANDSCAPE" | "STORY";

export const PLACEMENT_ASPECT_RATIOS: Record<SocialPlacementFormat, string> = {
  SQUARE: "1:1",
  PORTRAIT: "4:5",
  LANDSCAPE: "16:9",
  STORY: "9:16",
};

export const ASPECT_RATIO_OPTIONS = [
  { value: "1:1", label: "Vierkant (1:1)" },
  { value: "4:5", label: "Portret (4:5)" },
  { value: "9:16", label: "Story/Reel (9:16)" },
  { value: "16:9", label: "Landschap (16:9)" },
  { value: "3:4", label: "Portret (3:4)" },
] as const;

export function aspectRatioForPlacement(format: SocialPlacementFormat): string {
  return PLACEMENT_ASPECT_RATIOS[format];
}

export function aspectRatioForFeedFormat(format: SocialPlacementFormat): string {
  if (format === "LANDSCAPE") return "16:9";
  return aspectRatioForPlacement(format);
}
