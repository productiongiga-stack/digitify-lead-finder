import { z } from "zod";

const id = z.string().regex(/^\d{1,20}$/);
export const googleEditorSelectionSchema = z.object({
  adGroupId: id.optional(), adId: id.optional(), assetGroupId: id.optional(),
}).strict().refine((v) => !(v.assetGroupId && (v.adGroupId || v.adId)) && (!v.adId || Boolean(v.adGroupId)),
  "Kies een Search-advertentiegroep/RSA of een PMax-assetgroep.");
export type GoogleEditorSelection = z.infer<typeof googleEditorSelectionSchema>;

export function adVersionTargetKey(version: { accountId: string; campaignId: string; snapshot: unknown }) {
  const target = (version.snapshot as { editorTarget?: GoogleEditorSelection })?.editorTarget;
  return [version.accountId, version.campaignId, target?.adGroupId || "", target?.adId || "", target?.assetGroupId || ""].join(":");
}
