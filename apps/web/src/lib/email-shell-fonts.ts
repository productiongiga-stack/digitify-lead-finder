export type ShellFontFamily =
  | "arial"
  | "helvetica"
  | "verdana"
  | "trebuchet"
  | "tahoma"
  | "calibri"
  | "lucida"
  | "georgia"
  | "times"
  | "garamond"
  | "palatino"
  | "courier";

export type ShellLineHeight = "tight" | "normal" | "relaxed";
export type ShellHeaderWeight = "semibold" | "bold" | "extrabold";
export type ShellHeaderCase = "normal" | "uppercase";

export const SHELL_FONT_STACKS: Record<ShellFontFamily, string> = {
  arial: "Arial,Helvetica,sans-serif",
  helvetica: "Helvetica,Arial,sans-serif",
  verdana: "Verdana,Geneva,sans-serif",
  trebuchet: "'Trebuchet MS',Helvetica,sans-serif",
  tahoma: "Tahoma,Geneva,Verdana,sans-serif",
  calibri: "Calibri,Arial,Helvetica,sans-serif",
  lucida: "'Lucida Grande','Lucida Sans Unicode',Geneva,Verdana,sans-serif",
  georgia: "Georgia,'Times New Roman',Times,serif",
  times: "'Times New Roman',Times,serif",
  garamond: "Garamond,Georgia,serif",
  palatino: "'Palatino Linotype',Palatino,Georgia,serif",
  courier: "'Courier New',Courier,monospace",
};

export const WIZARD_FONT_OPTIONS: Array<{
  id: ShellFontFamily;
  label: string;
  category: "sans" | "serif" | "mono";
}> = [
  { id: "arial", label: "Arial", category: "sans" },
  { id: "helvetica", label: "Helvetica", category: "sans" },
  { id: "verdana", label: "Verdana", category: "sans" },
  { id: "tahoma", label: "Tahoma", category: "sans" },
  { id: "trebuchet", label: "Trebuchet", category: "sans" },
  { id: "calibri", label: "Calibri", category: "sans" },
  { id: "lucida", label: "Lucida", category: "sans" },
  { id: "georgia", label: "Georgia", category: "serif" },
  { id: "times", label: "Times", category: "serif" },
  { id: "garamond", label: "Garamond", category: "serif" },
  { id: "palatino", label: "Palatino", category: "serif" },
  { id: "courier", label: "Courier", category: "mono" },
];

export const FONT_PAIRING_PRESETS: Array<{
  id: string;
  label: string;
  headerFont: ShellFontFamily;
  bodyFont: ShellFontFamily;
}> = [
  { id: "zakelijk", label: "Zakelijk", headerFont: "arial", bodyFont: "arial" },
  { id: "editorial", label: "Editorial", headerFont: "georgia", bodyFont: "arial" },
  { id: "warm", label: "Warm", headerFont: "palatino", bodyFont: "georgia" },
  { id: "strak", label: "Strak", headerFont: "helvetica", bodyFont: "verdana" },
  { id: "klassiek", label: "Klassiek", headerFont: "garamond", bodyFont: "times" },
  { id: "modern", label: "Modern", headerFont: "calibri", bodyFont: "trebuchet" },
  { id: "vriendelijk", label: "Vriendelijk", headerFont: "lucida", bodyFont: "tahoma" },
  { id: "typewriter", label: "Typewriter", headerFont: "courier", bodyFont: "courier" },
];

export const LINE_HEIGHT_VALUES: Record<ShellLineHeight, string> = {
  tight: "1.55",
  normal: "1.75",
  relaxed: "1.92",
};

export const HEADER_WEIGHT_VALUES: Record<ShellHeaderWeight, string> = {
  semibold: "600",
  bold: "700",
  extrabold: "800",
};

export function shellFontStack(font: ShellFontFamily): string {
  return SHELL_FONT_STACKS[font];
}

/** @deprecated Maps legacy fontStyle presets to explicit font families. */
export function fontsFromLegacyStyle(fontStyle?: "modern" | "classic") {
  if (fontStyle === "classic") {
    return { headerFont: "georgia" as const, bodyFont: "arial" as const };
  }
  return { headerFont: "arial" as const, bodyFont: "arial" as const };
}
