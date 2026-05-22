/** Dutch labels for lead status values (shared API copy). */
export const LEAD_STATUS_LABELS_NL: Record<string, string> = {
  NEW: "nieuw",
  RESEARCHING: "onderzoek",
  CONTACTED: "gecontacteerd",
  RESPONDED: "gereageerd",
  QUALIFIED: "gekwalificeerd",
  PROPOSAL_SENT: "voorstel verstuurd",
  WON: "gewonnen",
  LOST: "verloren",
  ARCHIVED: "gearchiveerd",
};

export function leadStatusLabelNl(status: string): string {
  return LEAD_STATUS_LABELS_NL[status] ?? status.toLowerCase();
}
