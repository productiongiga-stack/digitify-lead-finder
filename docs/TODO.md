# TODO — Digitify Lead Search

Geconsolideerde open items uit `docs/PHASES.md`, README roadmap, en codebase.  
Vink af bij afronding; verwijs naar PR/issue indien van toepassing.

**Legenda:** ⬜ open · 🔄 deels · ✅ af · 👤 handmatig (menselijke actie)

---

## Launch blockers (productie)

| # | Item | Status | Bron |
|---|------|--------|------|
| L1 | Vercel project + alle env vars (`docs/VERCEL.md`) | 👤 ⬜ | PHASES 1.6, 8.4 |
| L2 | Neon/productie DB — `pnpm setup:db` (vooraf lokaal `pnpm setup:db:preflight`) | 👤 ⬜ | PHASES 1.7, 8.5 |
| L3 | Releasecheck + PR merge naar `main` na groene CI | 👤 ⬜ | `docs/RELEASE_CHECKLIST.md`, PHASES 4.3, 8.6 |
| L4 | `ENABLE_WORKSPACE_RLS=true` op staging → productie | 👤 ⬜ | DEPLOYMENT.md |
| L5 | RLS browser smoke met 2 OWNER accounts | 👤 ⬜ | WORKSPACE.md |

---

## Fase 8 — Developer experience & deploy

| # | Item | Status | Bestanden |
|---|------|--------|-----------|
| 8.1 | `pnpm dev` laadt root `.env` betrouwbaar | ✅ | `scripts/dev-with-env.sh` |
| 8.2 | Verwijder deprecated `experimental.instrumentationHook` | ✅ | `apps/web/next.config.js` |
| 8.3 | `pnpm check:release` in CI of pre-merge doc | ✅ | `scripts/check-release.sh`, CI |

---

## Fase 9 — Datamodel & technische schuld

| # | Item | Status | Bestanden |
|---|------|--------|-----------|
| 9.1 | `SavedView` legacy-model negeren; data behouden | ✅ | `schema.prisma` |
| 9.2 | Stop per-list JSON migratie op elk request | ✅ | `migrate-workspace-*.ts`, `db:migrate-legacy-workspace-data` |
| 9.3 | Settings-tenant model documenteren/migreren | ✅ | `WORKSPACE.md` |
| 9.4 | Template library — één bron (DB) | ✅ | `template.router.ts`, `migrate-legacy-templates` |
| 9.5 | Deprecated aliases verwijderen (`assertServerEnv`, ongebruikte lead-scope alias) | ✅ | `server-env.ts`, `tenant.ts` |

---

## Fase 10 — Performance & onderhoud

| # | Item | Status | Bestanden |
|---|------|--------|-----------|
| 10.1 | Split `settings/quotes/page.tsx` — service-startcatalogus apart | ✅ | `settings/quotes/` |
| 10.2 | Split `dashboard/page.tsx` — vervalwidget apart | ✅ | `dashboard/expiring-domains-widget.tsx` |
| 10.3 | Dashboard: 1 gecachte bundle-query voor de hoofdweergave | ✅ | `dashboard.router.ts`, `dashboard/page.tsx` |
| 10.4 | `user.list` N+1 Google-status batch | ✅ | `user.router.ts` |
| 10.5 | Tracker JSON-snapshot betrouwbaar maken; normalisatie naar eventtabel blijft apart | ✅ | `tracker/route.ts`, `domain-insights.ts` |
| 10.6 | Playwright in CI met volledige suite en smoke-script | ✅ | `e2e/`, CI |

---

## Fase 11 — Productstrategie (optioneel)

| # | Item | Status |
|---|------|--------|
| 11.1 | MVP-kern definiëren | ✅ — `docs/MVP_CORE.md` |
| 11.2 | Module flags per account met Owner/Admin-policy en server-side catalogusvalidatie | ✅ — `settings/team`, `user.setUserModule` |
| 11.3 | Onboarding-flow (3 stappen: zoek → lead → contact) | ✅ — `components/dashboard/onboarding-checklist.tsx` |
| 11.4 | NL help per module | ✅ — `/help`, `lib/module-help.ts` |

---

## Documentatie & DX

| # | Item | Status |
|---|------|--------|
| D1 | `.env.example` met lokale, productie- en seedvariabelen | ✅ |
| D2 | PROJECT BRAIN bijhouden (`AI_CHANGELOG.md`) | 🔄 (systeem aangemaakt) |

---

## Feature-specifieke TODO's (uit codebase)

| Item | Status | Notitie |
|------|--------|---------|
| Google Ads PMax image replacement live | ⬜ | TODO: bevestigen huidige limiet |
| Google Ads full budget/bidding strategy edits | ⬜ | TODO: bevestigen scope |
| Social Planner multi-upload | ✅ | Op main |

---

## Acceptatie-checklist vóór release

```bash
pnpm db:generate
pnpm test
pnpm typecheck
pnpm --filter @digitify/web lint
pnpm build
RUN_DB_INTEGRATION=1 ENABLE_WORKSPACE_RLS=true pnpm test:integration
ENABLE_WORKSPACE_RLS=true pnpm rls:smoke
pnpm check:release   # optioneel
pnpm test:e2e        # optioneel
```

---

*Sync met `docs/PHASES.md` bij grote planning-updates.*
