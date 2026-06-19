# FILE INDEX — Digitify Lead Search

Belangrijke bestanden en entry points. Paden relatief aan repo-root.

---

## Root & config

| Pad | Doel |
|-----|------|
| `AGENTS.md` | LLM startpunt |
| `README.md` | Quick start, stack, scripts |
| `DEPLOYMENT.md` | CI, RLS rollout, rate limits, env |
| `package.json` | Root scripts (turbo orchestration) |
| `pnpm-workspace.yaml` | Monorepo packages |
| `turbo.json` | Turbo task pipeline |
| `docker-compose.yml` | Local Postgres + Redis |
| `vercel.json` | Vercel deploy config |
| `.github/workflows/ci.yml` | GitHub CI |

**Ontbreekt:** `.env.example` — TODO: bevestigen of aanmaken gewenst is.

---

## Scripts (`scripts/`)

| Pad | Doel |
|-----|------|
| `dev-with-env.sh` | `pnpm dev` — laadt env |
| `prisma-migrate-deploy.sh` | `pnpm db:migrate` |
| `setup-production-db.sh` | `pnpm setup:db` |
| `check-release.sh` | `pnpm check:release` |
| `resolve-init-migration.sh` | Fix P3009 init migration |
| `local-run.sh` | Local run helper |

---

## Apps — `@digitify/web` (`apps/web/`)

### Config

| Pad | Doel |
|-----|------|
| `package.json` | Web scripts (dev, build, e2e) |
| `next.config.js` | Next.js config |
| `tailwind.config.js` | Tailwind |
| `playwright.config.ts` | E2E config |
| `src/instrumentation.ts` | Server startup (env validation) |

### App Router — layouts

| Pad | Doel |
|-----|------|
| `src/app/layout.tsx` | Root layout |
| `src/app/(app)/layout.tsx` | Authenticated app shell |
| `src/app/page.tsx` | Marketing/landing |

### App Router — feature pages (`src/app/(app)/`)

| Pad | Feature |
|-----|---------|
| `dashboard/page.tsx` | Dashboard |
| `leads/page.tsx`, `leads/search/page.tsx`, `leads/[id]/page.tsx` | Leads |
| `campaigns/page.tsx`, `campaigns/[id]/page.tsx` | Campagnes |
| `contacts/page.tsx`, `contacts/compose/page.tsx`, `contacts/inbox/page.tsx` | Outbound |
| `templates/page.tsx` | Standaard berichten |
| `crm/page.tsx` | CRM |
| `tasks/page.tsx` | Taken |
| `quotes/page.tsx`, `quotes/[id]/page.tsx`, `quotes/new/page.tsx` | Offertes |
| `invoices/page.tsx` | Facturen |
| `reports/page.tsx`, `audit/page.tsx` | Website auditor |
| `meta-ads/page.tsx`, `meta-ads/meta-ads-page-inner.tsx` | Meta Ads |
| `google-ads/page.tsx`, `google-ads/google-ads-page-inner.tsx` | Google Ads |
| `social/page.tsx`, `social/social-page-inner.tsx` | Social Planner |
| `creative-studio/page.tsx` | Creative Studio |
| `bookings/page.tsx`, `bookings/analytics/page.tsx` | Boekingen |
| `domains/page.tsx`, `domains/[id]/page.tsx` | Domeinen |
| `reviews/page.tsx` | Reviews |
| `chatbot/page.tsx`, `chatbot/chatbot-inner.tsx` | Chatbot |
| `settings/**/page.tsx` | Instellingen (20+ secties) |

### API routes (`src/app/api/`)

| Pad | Doel |
|-----|------|
| `trpc/[trpc]/route.ts` | **tRPC HTTP handler** |
| `auth/[...nextauth]/route.ts` | NextAuth |
| `health/route.ts` | Health probe |
| `upload/route.ts`, `upload/client/route.ts` | File uploads |
| `cron/drip/route.ts` | Drip e-mail cron |
| `cron/social-publish/route.ts` | Social publish cron |
| `cron/bookings-sync/route.ts` | Bookings sync |
| `cron/media-reconcile/route.ts` | Media jobs reconcile |
| `integrations/meta/connect/route.ts` | Meta OAuth start |
| `integrations/meta/callback/route.ts` | Meta OAuth callback |
| `integrations/google-ads/connect/route.ts` | Google Ads OAuth |
| `integrations/google-ads/callback/route.ts` | Google Ads callback |
| `integrations/google-calendar/connect/route.ts` | Calendar OAuth |
| `integrations/google-calendar/callback/route.ts` | Calendar callback |
| `public/bookings/route.ts` | Public booking API |
| `public/quotes/request/route.ts` | Quote request |
| `public/chatbot/session/route.ts` | Chatbot sessions |
| `public/tracker/route.ts` | Analytics tracker |
| `muapi/[...path]/route.ts` | MuAPI proxy |

### Lib (`src/lib/`)

| Pad | Doel |
|-----|------|
| `trpc/client.ts` | tRPC React client |
| `navigation.ts` | Sidebar, modules, page titles |
| `module-access.ts` | Route → moduleId guard |
| `permissions.ts` | Client-side settings RBAC |
| `auth/options.ts` | NextAuth config |
| `auth/session.ts` | Session helpers |
| `env.ts` | Client env |
| `config.ts` | App config |
| `persist-social-assets.ts` | Social upload persistence |
| `upload-storage.ts` | Blob/data-url upload |
| `permissions.ts` | UI permissions |

### Components (`src/components/`)

| Map | Doel |
|-----|------|
| `layout/` | App shell, sidebar, topbar, guards |
| `social/` | Social Planner UI (carousel, preview, composer) |
| `creative-studio/` | Image/video/ad generators |
| `ads/` | Meta/Google ads studio panels |
| `outbound/` | E-mail compose, drafts, timeline |
| `campaigns/` | Campaign profiles, drip |
| `dashboard/` | Dashboard widgets |
| `quotes/` | Quote embed, composer |
| `invoices/` | Invoice UI |
| `templates/` | Template studio |
| `openclaw/` | AI page assist |
| `feedback/` | Toasts, confirm dialogs |
| `settings/integrations/` | Integration UI |

### E2E (`e2e/`)

| Pad | Doel |
|-----|------|
| `health.spec.ts` | `/api/health` |
| `smoke.spec.ts` | Basic smoke |
| `rls-cross-tenant.spec.ts` | Tenant isolation |
| `module-guard.spec.ts` | Module access |
| `settings-rbac.spec.ts` | Settings permissions |
| `creative-studio.spec.ts` | Creative Studio |
| `dashboard-smoke.spec.ts` | Dashboard |
| `leads-smoke.spec.ts` | Leads |
| `portal-upload.spec.ts` | Quote portal |
| `viewer-readonly.spec.ts` | VIEWER role |

---

## Packages — `@digitify/api` (`packages/api/`)

| Pad | Doel |
|-----|------|
| `src/root.ts` | **appRouter** — alle routers |
| `src/trpc.ts` | tRPC init, middleware, procedures |
| `src/routers/*.router.ts` | 30 feature routers |
| `src/lib/WORKSPACE.md` | Workspace data policy |
| `src/lib/server-env.ts` | Env validation (Zod) |
| `src/lib/permissions.ts` | Server RBAC |
| `src/lib/workspace-members.ts` | Team management |
| `src/lib/social-publish.ts` | Meta social publishing |
| `src/lib/social-placements.ts` | Social placement validation |
| `src/lib/meta-ads.ts` | Meta Ads API |
| `src/lib/google-ads.ts` | Google Ads API |
| `src/lib/campaign-drip.ts` | Drip e-mail logic |
| `src/lib/email-sender.ts` | SMTP send |
| `src/lib/scoring-pipeline.ts` | Lead scoring |
| `src/lib/public-tenant.ts` | Public embed tenant resolution |
| `src/lib/cron-auth.ts` | Cron bearer auth |
| `src/__tests__/` | 55+ test files |

---

## Packages — `@digitify/db` (`packages/db/`)

| Pad | Doel |
|-----|------|
| `prisma/schema.prisma` | **Database schema** |
| `prisma/migrations/` | SQL migraties |
| `prisma/seed.ts` | Dev seed |
| `prisma/rls-staging-smoke.ts` | RLS smoke test |
| `src/index.ts` | Prisma client export |
| `src/workspace-rls.ts` | RLS transaction wrapper |
| `src/request-context.ts` | Request context patching |

---

## Packages — overig

| Package | Belangrijkste pad |
|---------|-----------------|
| `@digitify/ui` | `packages/ui/src/index.ts`, `components/` |
| `@digitify/email` | `packages/email/src/master-shell.ts`, `html-template.ts` |
| `@digitify/scoring` | `packages/scoring/src/index.ts`, `factors/` |
| `@digitify/connectors` | `packages/connectors/src/index.ts` |
| `@digitify/openclaw` | `packages/openclaw/src/index.ts` |
| `@digitify/media-studio` | `packages/media-studio/src/models.ts`, `index.ts` |

---

## Docs (`docs/`)

| Pad | Doel |
|-----|------|
| `PROJECT_BRAIN.md` | LLM compact reference |
| `PROJECT_WIKI.md` | Uitgebreide wiki |
| `MODULE_MAP.md` | Feature → code map |
| `FILE_INDEX.md` | Dit bestand |
| `AI_CHANGELOG.md` | Wijzigingslog |
| `DECISIONS.md` | ADRs |
| `TODO.md` | Open items |
| `PHASES.md` | Verbeterplan fases |
| `VERCEL.md` | Vercel/Neon deploy |
| `CREATIVE-STUDIO.md` | MuAPI integratie |
| `WORKSPACE-AUDIT.md` | Workspace audit notes |

---

## Zoektips voor LLM’s

| Ik zoek… | Start bij… |
|----------|------------|
| tRPC endpoint | `packages/api/src/routers/{feature}.router.ts` |
| UI pagina | `apps/web/src/app/(app)/{feature}/` |
| DB model | `packages/db/prisma/schema.prisma` |
| Validatie/regels | `packages/api/src/lib/` |
| Navigatie/labels | `apps/web/src/lib/navigation.ts` |
| Tests | `packages/api/src/__tests__/{feature}*` |
| Cron | `apps/web/src/app/api/cron/` |
| Publieke API | `apps/web/src/app/api/public/` |
