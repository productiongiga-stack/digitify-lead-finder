// Trusted operator CLI only. No web/admin reset endpoint is intentionally provided.
// Load DATABASE_URL explicitly for the verified target environment before running.
import { parseArgs } from "node:util";
import { prisma } from "@digitify/db";
import { issueRecoveryGrant } from "../src/lib/two-factor";
import { notifyFactorChange } from "../src/lib/two-factor-notifications";
const { values } = parseArgs({ options: { user: { type: "string" }, operator: { type: "string" }, ticket: { type: "string" }, reason: { type: "string" }, reviewer: { type: "string" }, "identity-verified": { type: "boolean" }, execute: { type: "boolean" } } });
async function main() {
  if (!values.user || !values.operator || !values.ticket || !values.reason || !values["identity-verified"]) throw new Error("Verplicht: --user --operator --ticket --reason --identity-verified; OWNER/ADMIN ook --reviewer (onafhankelijke identiteitcontrole).");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: values.user }, select: { id: true, role: true, twoFactorEnabled: true } });
  if (["OWNER", "ADMIN"].includes(user.role) && (!values.reviewer || values.reviewer === values.operator)) throw new Error("Onafhankelijke tweede reviewer vereist.");
  if (!values.execute) { console.log("DRY RUN: gecontroleerd herstel voor", user.id, user.role, "Geen wijzigingen. Controleer database-identiteit en dossier vóór --execute."); return; }
  const token = await issueRecoveryGrant(prisma, user.id, { operatorId: values.operator, ticket: values.ticket, reason: values.reason, secondReviewerId: values.reviewer });
  await notifyFactorChange(prisma, user.id, "Gecontroleerd beveiligingsherstel is gestart. Alle sessies zijn ingetrokken. Gebruik de apart ontvangen vergunning binnen 24 uur om je authenticator opnieuw in te stellen.");
  // One-time handoff to the trusted operator, never emitted by the web server or audit log.
  console.log("EENMALIGE HERSTELVERGUNNING (deel alleen via gecontroleerd kanaal):", token);
}
main().catch(() => { console.error("Herstel niet uitgevoerd of onvolledig. Controleer argumenten, database en auditlog; geen automatische herhaling."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
