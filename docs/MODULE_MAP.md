# MODULE MAP — Digitify Lead Search

Feature → tRPC router → API lib → UI → tests.  
Alle paden relatief aan repo-root.

**Legenda:** 🔒 = module toggle (`moduleId` in `navigation.ts`)

### Persoonlijke authenticatorbeveiliging (2026-10-02)

DAL: `packages/api/src/lib/two-factor{,-crypto,-notifications}.ts`. Login: `apps/web/src/app/api/auth/login-start/route.ts` en `lib/auth/options.ts`. Persoonlijke REST-routes: `app/api/two-factor/`; scherm: `components/settings/two-factor-settings.tsx`; waarschuwing: `components/layout/two-factor-warning.tsx`. Operatorherstel: `packages/api/scripts/recover-two-factor.ts`. Geen technisch module-entitlement nodig: iedere rol kan het eigen account beveiligen. Tests: `two-factor{,-crypto,-http}.integration/test` in de API-package en `lib/auth/__tests__/two-factor-routes.test.ts` in web. Configuratie en releasepoort: `docs/TWO_FACTOR_AUTH.md`.

### Gedeelde Google/Meta Ads-workflow (2026-10-02)

Beide bestaande advertentierouters gebruiken `packages/api/src/routers/ads-workflow.procedures.ts`, de `ads-workflow*.ts` libraries en `apps/web/src/components/ads/`. Google-doelselectie: `google-editor-selection.ts` en `google-editor-target-picker.tsx`. Duurzame taken: `ads-background-jobs.ts`; uitvoerder: `apps/web/src/app/api/cron/ads-optimize/route.ts`. Opslag: AdVersion, AdChangeSet, AdApprovalRequest, AdSyncOperation, AiOptimizationRun en AdBackgroundJob. Tests: `ads-workflow{,-providers,-read,.integration}.test.ts`, `google-editor-selection.test.ts` en `ads-background-jobs.test.ts`. Functionele grenzen en configuratie: `docs/ADS_AUTOMATION.md`.

De gedeelde Phase-1 briefingwizard gebruikt `packages/api/src/routers/ads-wizard.router.ts`, `packages/api/src/lib/ads-wizard.ts`, model `AdsWizardProject` en `apps/web/src/components/ads/ads-campaign-wizard.tsx`. De wizard bewaart lokale concepten met idempotency en revision-locking. Phase 2 gebruikt `packages/api/src/lib/ads-wizard-ai.ts` voor evidencegebonden strategievoorstellen en gecontroleerde Meta-/Google-copy, en `packages/api/src/lib/ads-wizard-drafts.ts` om plannen veilig naar bestaande draftmodellen te materialiseren en vóór approval te controleren; Meta Phase 3 vult vanuit de AI-strategie adsets, varianten en gecontroleerde placements in; providerwrites blijven geblokkeerd. Tests: `packages/api/src/__tests__/ads-wizard.test.ts` en `ads-wizard-ai.test.ts`. Audit en capabilitymatrix: `docs/ADS_EDITOR_AUDIT.md`.

---

## Kern (altijd beschikbaar)

### Dashboard

| Laag | Pad |
|------|-----|
| Router | `packages/api/src/routers/dashboard.router.ts` |
| Cache | `packages/api/src/lib/dashboard-cache.ts` |
| UI | `apps/web/src/app/(app)/dashboard/page.tsx` |
| Components | `apps/web/src/components/dashboard/` |
| Tests | `apps/web/e2e/dashboard-smoke.spec.ts` |

### Leads

| Laag | Pad |
|------|-----|
| Router | `packages/api/src/routers/lead.router.ts` |
| Search router | `packages/api/src/routers/search.router.ts` |
| Scoring | `packages/api/src/lib/scoring-pipeline.ts`, `packages/scoring/` |
| Google Places | `packages/api/src/lib/google-places.ts` |
| UI list | `apps/web/src/app/(app)/leads/page.tsx` |
| UI search | `apps/web/src/app/(app)/leads/search/lead-search-inner.tsx` |
| UI detail | `apps/web/src/app/(app)/leads/[id]/page.tsx` |
| Tests | `packages/api/src/__tests__/core-flows.test.ts`, `apps/web/e2e/leads-smoke.spec.ts` |

### Pipeline & tags

| Laag | Pad |
|------|-----|
| Routers | `pipeline.router.ts`, `tag.router.ts` |
| Settings UI | `apps/web/src/app/(app)/settings/pipeline/page.tsx` |

---

## Prospectie

### Campagneprofielen 🔒 `campaigns`

| Laag | Pad |
|------|-----|
| Router | `packages/api/src/routers/campaign.router.ts` |
| Drip logic | `packages/api/src/lib/campaign-drip.ts` |
| Cron | `apps/web/src/app/api/cron/drip/route.ts` |
| UI | `apps/web/src/app/(app)/campaigns/` |
| Components | `apps/web/src/components/campaigns/` |

---

## Communicatie

### E-mail & Contacten 🔒 `contacts`

| Laag | Pad |
|------|-----|
| Router | `packages/api/src/routers/contact.router.ts` |
| Inbox router | `packages/api/src/routers/inbox.router.ts` |
| E-mail send | `packages/api/src/lib/email-sender.ts` (één SMTP per workspace; ADR-015) |
| Recipient-only scope | `EmailDraft.workspaceId` + optionele `leadId` |
| Draft meta | `packages/api/src/lib/outbound-draft-meta.ts` |
| UI center | `apps/web/src/app/(app)/contacts/contacts-page-inner.tsx` |
| UI compose | `apps/web/src/app/(app)/contacts/compose/` |
| UI inbox | `apps/web/src/app/(app)/contacts/inbox/inbox-page-inner.tsx` |
| UI approval | `apps/web/src/app/(app)/contacts/approval/` |
| Components | `apps/web/src/components/outbound/` |
| Tests | `packages/api/src/__tests__/outbound-flow.test.ts` |

### Standaard berichten / Template Studio 🔒 `templates`

| Laag | Pad |
|------|-----|
| Router | `packages/api/src/routers/template.router.ts` |
| E-mail templates | `packages/api/src/lib/email-templates.ts` |
| Legacy migrate | `packages/api/src/lib/migrate-legacy-template-library.ts` |
| UI | `apps/web/src/app/(app)/templates/page.tsx` |
| UI (contacts alias) | `apps/web/src/app/(app)/contacts/templates/page.tsx` |
| Components | `apps/web/src/components/templates/` |
| Tests | `packages/api/src/__tests__/email-templates.test.ts`, `template-list-campaign.integration.test.ts` |

---

## Verkoop

### CRM 🔒 `crm`

| Laag | Pad |
|------|-----|
| Router | `packages/api/src/routers/crm.router.ts` |
| UI | `apps/web/src/app/(app)/crm/page.tsx` |

### Taken 🔒 `tasks`

| Laag | Pad |
|------|-----|
| Router | `packages/api/src/routers/task.router.ts` |
| Migrate | `packages/api/src/lib/migrate-workspace-tasks.ts` |
| DB model | `WorkspaceTask` in schema |
| UI | `apps/web/src/app/(app)/tasks/page.tsx` |
| Tests | `packages/api/src/__tests__/migrate-workspace-tasks.test.ts` |

### Offertes 🔒 `quotes`

| Laag | Pad |
|------|-----|
| Router | `packages/api/src/routers/quote.router.ts` |
| Outbound e-mail | `packages/api/src/lib/quote-outbound-email.ts` |
| Public API | `apps/web/src/app/api/public/quotes/`, `api/quotes/` |
| Embed | `apps/web/src/app/embed/quotes/` |
| UI | `apps/web/src/app/(app)/quotes/` |
| Settings | `apps/web/src/app/(app)/settings/quotes/page.tsx` (groot bestand) |
| Components | `apps/web/src/components/quotes/` |
| Tests | `apps/web/e2e/portal-upload.spec.ts` |

### Facturen 🔒 `invoices`

| Laag | Pad |
|------|-----|
| Router | `packages/api/src/routers/invoice.router.ts` |
| Serializer | `packages/api/src/lib/invoice-serializer.ts` |
| Migrate | `packages/api/src/lib/migrate-workspace-invoices.ts` |
| PDF | `apps/web/src/app/api/invoices/[id]/pdf/route.ts` |
| UI | `apps/web/src/app/(app)/invoices/page.tsx` |
| Components | `apps/web/src/components/invoices/` |
| Tests | `packages/api/src/__tests__/migrate-workspace-invoices.test.ts` |

---

## Analyse

### Website auditor 🔒 `reports`

| Laag | Pad |
|------|-----|
| Router | `packages/api/src/routers/report.router.ts`, `audit.router.ts` |
| Audit engine | `packages/api/src/lib/website-audit.ts` |
| UI | `apps/web/src/app/(app)/reports/`, `apps/web/src/app/(app)/audit/` |
| Components | `apps/web/src/components/reports/` |

---

## Advertenties

### Meta Ads 🔒 `metaAds`

| Laag | Pad |
|------|-----|
| Router | `packages/api/src/routers/meta-ads.router.ts` |
| Meta API | `packages/api/src/lib/meta-ads.ts`, `meta-ads-ai.ts` |
| Shared Copilot | `packages/api/src/routers/ads-copilot.router.ts`, `packages/api/src/lib/ads-copilot.ts`, `ads-workflow.ts` |
| Editor & AI wizard | `packages/api/src/routers/ads-wizard.router.ts`, `packages/api/src/lib/ads-wizard.ts`, `ads-wizard-ai.ts`, `apps/web/src/components/ads/ads-campaign-wizard.tsx` (strategie naar approval-diff) |
| OAuth | `apps/web/src/app/api/integrations/meta/` |
| UI | `apps/web/src/app/(app)/meta-ads/meta-ads-page-inner.tsx` |
| Components | `apps/web/src/components/ads/meta-ads-*.tsx` |
| Tests | `packages/api/src/__tests__/meta-ads.router.test.ts`, `meta-ads-push.test.ts` |
| Safe push recovery | `metaAds.reconcilePush` checks the exact saved campaign ID without retrying a provider write |

### Google Ads 🔒 `googleAds`

| Laag | Pad |
|------|-----|
| Router | `packages/api/src/routers/google-ads.router.ts` |
| Google API | `packages/api/src/lib/google-ads.ts`, `google-ads-ai.ts`, `google-ads-oauth.ts` |
| Shared Copilot | `packages/api/src/routers/ads-copilot.router.ts`, `packages/api/src/lib/ads-copilot.ts`, `ads-workflow.ts` |
| Editor & AI wizard | `packages/api/src/routers/ads-wizard.router.ts`, `packages/api/src/lib/ads-wizard.ts`, `ads-wizard-ai.ts`, `apps/web/src/components/ads/ads-campaign-wizard.tsx` (strategie naar approval-diff) |
| OAuth | `apps/web/src/app/api/integrations/google-ads/` |
| UI | `apps/web/src/app/(app)/google-ads/google-ads-page-inner.tsx` |
| Components | `apps/web/src/components/ads/google-ads-page-fallback.tsx`, `ads-studio-*` |
| Tests | `packages/api/src/__tests__/google-ads.router.test.ts`, `google-ads-push.test.ts` |
| Safe push recovery | `googleAds.reconcilePush` checks the exact saved campaign resource without retrying a provider write |

---

## Marketing

### Social Planner 🔒 `social`

| Laag | Pad |
|------|-----|
| Router | `packages/api/src/routers/social.router.ts` |
| Publish | `packages/api/src/lib/social-publish.ts` |
| Placements | `packages/api/src/lib/social-placements.ts` |
| Prepare assets | `packages/api/src/lib/social-prepare-assets.ts` |
| Meta pages | `packages/api/src/lib/social-meta.ts` |
| Brand kits | `packages/api/src/lib/social-brand-kits.ts` |
| Image crop | `packages/api/src/lib/social-image-crop.ts` |
| Cron | `apps/web/src/app/api/cron/social-publish/route.ts` |
| UI page | `apps/web/src/app/(app)/social/social-page-inner.tsx` |
| UI queue | `apps/web/src/app/(app)/social/social-queue-panel.tsx` |
| Components | `apps/web/src/components/social/` |
| Client persist | `apps/web/src/lib/persist-social-assets.ts` |
| DB model | `SocialPost` |
| Tests | `packages/api/src/__tests__/social.router.test.ts`, `social-meta-publish.test.ts`, `social-brand-kits.test.ts`, `social-image.test.ts` |

**Recent (uncommitted):** Multi-upload (carousel) — gedeelde items voor Instagram carousel + Facebook multi-photo; labels "Item N".

### Creative Studio 🔒 `creativeStudio`

| Laag | Pad |
|------|-----|
| Router | `packages/api/src/routers/media.router.ts` |
| MuAPI client | `packages/media-studio/` |
| Key storage | `packages/api/src/lib/muapi-key.ts` |
| Blob import | `packages/api/src/lib/import-media-to-blob.ts` |
| Reconcile cron | `apps/web/src/app/api/cron/media-reconcile/route.ts` |
| MuAPI proxy | `apps/web/src/app/api/muapi/[...path]/route.ts` |
| UI | `apps/web/src/app/(app)/creative-studio/page.tsx` |
| Settings | `apps/web/src/app/(app)/settings/creative-studio/page.tsx` |
| Components | `apps/web/src/components/creative-studio/` |
| DB model | `MediaGeneration` |
| Docs | `docs/CREATIVE-STUDIO.md` |
| Tests | `packages/api/src/__tests__/reconcile-media-jobs.test.ts`, `media.router.integration.test.ts`, `apps/web/e2e/creative-studio.spec.ts` |

### Boekingen 🔒 `bookings`

| Laag | Pad |
|------|-----|
| Router | `packages/api/src/routers/booking.router.ts` |
| Utils | `packages/api/src/lib/booking-utils.ts`, `booking-webhooks.ts` |
| Calendar | `packages/api/src/lib/google-calendar.ts` |
| Public API | `apps/web/src/app/api/public/bookings/` |
| Cron sync | `apps/web/src/app/api/cron/bookings-sync/route.ts` |
| UI | `apps/web/src/app/(app)/bookings/` |
| Settings | `apps/web/src/app/(app)/settings/bookings/page.tsx` |
| Tests | `packages/api/src/__tests__/permissions-bookings.test.ts` |

### Domeinen 🔒 `domains`

| Laag | Pad |
|------|-----|
| Router | `packages/api/src/routers/domain.router.ts` |
| Insights | `packages/api/src/lib/domain-insights.ts` |
| Tracker | `apps/web/src/app/api/public/tracker/route.ts`, `apps/web/src/app/tracker.js/route.ts` |
| UI | `apps/web/src/app/(app)/domains/` |
| Components | `apps/web/src/components/domains/` |

### Reviews 🔒 `reviews`

| Laag | Pad |
|------|-----|
| Router | `packages/api/src/routers/review.router.ts` |
| Public API | `apps/web/src/app/api/public/reviews/` |
| UI | `apps/web/src/app/(app)/reviews/page.tsx` |
| Settings | `apps/web/src/app/(app)/settings/reviews/page.tsx` |

### Chatbot 🔒 `chatbot`

| Laag | Pad |
|------|-----|
| Router | `packages/api/src/routers/chatbot.router.ts` |
| Public API | `apps/web/src/app/api/public/chatbot/` |
| Widget | `apps/web/src/app/chatbot/widget.js/route.ts` |
| UI | `apps/web/src/app/(app)/chatbot/chatbot-inner.tsx` |
| Settings | `apps/web/src/app/(app)/settings/chatbot/page.tsx`, `chatbot/settings/` |
| AI reply | `packages/api/src/lib/inbox-ai-reply.ts` |

---

## Platform & instellingen

### Workspace & team

| Laag | Pad |
|------|-----|
| Routers | `workspace.router.ts`, `user.router.ts`, `registration.router.ts` |
| Members | `packages/api/src/lib/workspace-members.ts` |
| Registry | `packages/api/src/lib/workspace-registry.ts` |
| Settings | `packages/api/src/routers/settings.router.ts` |
| UI workspaces | `apps/web/src/app/(app)/settings/workspaces/page.tsx` |
| UI team | `apps/web/src/app/(app)/settings/team/page.tsx` |
| Tests | `workspace-members.test.ts`, `workspace-rls.integration.test.ts`, `settings-rbac.integration.test.ts` |

### Scoring

| Laag | Pad |
|------|-----|
| Router | `packages/api/src/routers/scoring.router.ts` |
| Weights | `packages/api/src/lib/scoring-weights.ts` |
| Engine | `packages/scoring/src/` |
| UI | `apps/web/src/app/(app)/settings/scoring/page.tsx` |

### Analytics

| Laag | Pad |
|------|-----|
| Router | `packages/api/src/routers/analytics.router.ts` |
| Tracker component | `apps/web/src/components/analytics/` |
| Settings | `apps/web/src/app/(app)/settings/analytics/page.tsx` |
| DB | `WorkspaceAnalyticsEvent` |

### OpenClaw AI assist

| Laag | Pad |
|------|-----|
| Router | `packages/api/src/routers/openclaw.router.ts` |
| Client | `packages/openclaw/src/` |
| UI | `apps/web/src/components/openclaw/` |
| Settings | `apps/web/src/app/(app)/settings/ai/page.tsx` |
| DB | `OpenClawLog`, `OpenClawSuggestion` |

### Integraties (settings hub)

| Laag | Pad |
|------|-----|
| UI | `apps/web/src/app/(app)/settings/integrations/` |
| OAuth creds | `packages/api/src/lib/oauth-credentials.ts` |
| Components | `apps/web/src/components/settings/integrations/` |

---

## Cross-cutting concerns

| Concern | Bestanden |
|---------|-----------|
| Auth | `apps/web/src/lib/auth/`, `packages/api/src/trpc.ts` |
| Permissions | `permissions.ts` (api + web) |
| Module access | `module-access.ts`, `module-access-guard.tsx` |
| Rate limits | `rate-limit*.ts` |
| Env | `server-env.ts`, `instrumentation.ts` |
| Uploads | `upload-storage.ts`, `upload/route.ts`, Vercel Blob |
| Sales bestandenbibliotheek | `files/page.tsx`, `file.router.ts`, `file-quota.ts`, `file-storage.ts`, Google Drive OAuth-routes |
| E-mail shell | `packages/email/`, `generate-email-shell.ts` |
| Cron auth | `cron-auth.ts` |
| Public tenant | `public-tenant.ts` |
| RLS | `packages/db/src/workspace-rls.ts` |

---

## DB models per module (Prisma)

| Module | Models |
|--------|--------|
| Leads | `Lead`, `LeadContact`, `Tag`, `LeadTag`, `EnrichmentData`, `LeadScoringFactor`, `LeadAnalysisRun` |
| Outbound | `EmailDraft`, `EmailTemplate`, `EmailSequence` |
| Campaigns | `Campaign`, `CampaignLead` |
| Quotes | `Quote`, `QuoteItem`, `ServiceCatalog` |
| Invoices | `WorkspaceInvoice`, `WorkspaceInvoiceItem` |
| Tasks | `WorkspaceTask` |
| Social | `SocialPost` |
| Meta Ads | `MetaAdAccount`, `MetaAdPlan`, `AdResearchRun`, `AdResearchEvidence`, `AdsWizardProject` |
| Google Ads | `GoogleAdAccount`, `GoogleAdPlan`, `AdChangeSet`, `AdsWizardProject` |
| Media | `MediaGeneration` |
| Bookings | `Booking`, `BookingEventType`, `BookingAvailabilityRule`, … |
| Domains | `Domain` |
| Reviews | `ReviewRequest` |
| Chatbot | `ChatSession`, `ChatMessage` |
| Reports | `Report`, `ReportTemplate` |
| Workspace | `Workspace`, `WorkspaceMembership`, `Setting` |

---

*Update dit bestand wanneer een nieuwe router, pagina of significant lib-module wordt toegevoegd.*

### Creative Studio: wizards en credits

Doelgerichte wizards en bibliotheek via Creative Studio; concept-, pricing-, checkout- en handoffprocedures worden in mediaRouter geregistreerd vanuit creative-studio.procedures.ts. Gedeelde merkkits: Social Planner. Financiële opslag: CreativeWallet/CreativeLedger/CreativeReservation/CreativePurchase. Setup en verificatie: [CREATIVE_STUDIO.md](CREATIVE_STUDIO.md).

### Ads Wizard — Google Search Generator

`adsWizard.generateGoogleSearchPlan` bouwt een lokaal, workspace-scoped Search-plan met maximaal drie ad groups. De generator combineert de centrale AI-strategie met SEO/Search Console-bronnen, bewaart bronlabels en evidence in `AdsWizardProject.googlePlan.searchPlan` en materialiseert daarna via `createNativeDraft` naar `GoogleAdPlan`. Er worden geen providerwrites uitgevoerd.

`adsWizard.listAssets` toont voltooide Creative Studio-media met een duurzame Blob-URL. De wizard bewaart maximaal twaalf geselecteerde media-ID’s en valideert die opnieuw bij opslaan en bij materialisatie naar een Meta- of Google-draft. Tijdelijke media en cross-workspace assets worden geweigerd.

`adsWizard.generatePerformanceMaxPlan` bouwt een afzonderlijk lokaal PMax-plan met begrensde copy, expliciete assetrollen en een readiness-overzicht. Het plan wordt opgeslagen in `googlePlan.performanceMaxPlan`, maar blijft provider-neutraal tot de gebruiker het in de bestaande Google-editor controleert. Ontbrekende landscape-, square- of logo-assets, budget, customer en conversieactie worden zichtbaar gemarkeerd.

`adsWizard.reviewProject` controleert een gedeelde Meta/Google-briefing centraal, maar bewaart blockers en draftstatus per platform. De controle is lokaal, optimistic-lock beschermd en voert geen providerwrite uit.

### Ads workflow — Phase 9 optimalisatie

`workflowOverview` levert naast versies, voorstellen en runs ook `performance`: een deterministische samenvatting van gemeten metrics met expliciete nullwaarden voor ontbrekende data. `workflowOptimize` accepteert een optionele idempotency key voor handmatige AI-runs; aanbevelingen worden als bestaande `AdChangeSet`-voorstellen opgeslagen en volgen dezelfde approval-, publish- en reconcile-flow.

Phase 10-verificatie en releasevoorwaarden staan in [ADS_EDITOR_SECURITY.md](ADS_EDITOR_SECURITY.md) en [ADS_EDITOR_RELEASE_CHECKLIST.md](ADS_EDITOR_RELEASE_CHECKLIST.md). De responsive browsercontrole staat in `apps/web/e2e/ads-editor-responsive.spec.ts`.

De lokale acceptatie-audit voor de vier hoofdscenario's staat in [ADS_EDITOR_ACCEPTANCE.md](ADS_EDITOR_ACCEPTANCE.md).
