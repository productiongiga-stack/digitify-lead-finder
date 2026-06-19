# TODO — Digitify Lead Search

Geconsolideerde open items uit `docs/PHASES.md`, README roadmap, en codebase.  
Vink af bij afronding; verwijs naar PR/issue indien van toepassing.

**Legenda:** ⬜ open · 🔄 deels · ✅ af · 👤 handmatig (menselijke actie)

---

## Launch blockers (productie)

| # | Item | Status | Bron |
|---|------|--------|------|
| L1 | Vercel project + alle env vars (`docs/VERCEL.md`) | 👤 ⬜ | PHASES 1.6, 8.4 |
| L2 | Neon/productie DB — `pnpm setup:db` | 👤 ⬜ | PHASES 1.7, 8.5 |
| L3 | PR merge naar `main` na groene CI | 👤 ⬜ | PHASES 4.3, 8.6 |
| L4 | `ENABLE_WORKSPACE_RLS=true` op staging → productie | 👤 ⬜ | DEPLOYMENT.md |
| L5 | RLS browser smoke met 2 OWNER accounts | 👤 ⬜ | WORKSPACE.md |

---

## Fase 8 — Developer experience & deploy

| # | Item | Status | Bestanden |
|---|------|--------|-----------|
| 8.1 | `pnpm dev` laadt root `.env` betrouwbaar | ⬜ | `scripts/dev-with-env.sh` |
| 8.2 | Verwijder deprecated `experimental.instrumentationHook` | ⬜ | `apps/web/next.config.js` |
| 8.3 | `pnpm check:release` in CI of pre-merge doc | ⬜ | `scripts/check-release.sh`, CI |

---

## Fase 9 — Datamodel & technische schuld

| # | Item | Status | Bestanden |
|---|------|--------|-----------|
| 9.1 | `SavedView` tabel droppen of feature bouwen | ⬜ | `schema.prisma` |
| 9.2 | Stop per-list JSON migratie op elk request | ⬜ | `migrate-workspace-*.ts` |
| 9.3 | Settings-tenant model documenteren/migreren | 🔄 | `WORKSPACE.md` |
| 9.4 | Template library — één bron (DB) | ⬜ | `template.router.ts` |
| 9.5 | Deprecated aliases verwijderen (`validateEnv`, `tenant.ts`) | ⬜ | `server-env.ts`, `tenant.ts` |

---

## Fase 10 — Performance & onderhoud

| # | Item | Status | Bestanden |
|---|------|--------|-----------|
| 10.1 | Split `settings/quotes/page.tsx` (~5000 regels) | ⬜ | `settings/quotes/` |
| 10.2 | Split `dashboard/page.tsx` | ⬜ | `components/dashboard/` |
| 10.3 | Dashboard: 1 bundle query i.p.v. 10+ parallel | ⬜ | `dashboard.router.ts` |
| 10.4 | `user.list` N+1 Google-status batch | ⬜ | `user.router.ts` |
| 10.5 | Tracker JSON blob normaliseren | ⬜ | `tracker/route.ts` |
| 10.6 | Playwright optioneel in CI bij UI changes | ⬜ | `e2e/`, CI |

---

## Fase 11 — Productstrategie (optioneel)

| # | Item | Status |
|---|------|--------|
| 11.1 | MVP-kern definiëren | ⬜ |
| 11.2 | Module flags default uit voor niche modules | ⬜ |
| 11.3 | Onboarding-flow (3 stappen) | ⬜ |
| 11.4 | NL help per module | ⬜ |

---

## Documentatie & DX

| # | Item | Status |
|---|------|--------|
| D1 | `.env.example` aanmaken met verplichte vars | ⬜ TODO: bevestigen gewenst |
| D2 | PROJECT BRAIN bijhouden (`AI_CHANGELOG.md`) | 🔄 (systeem aangemaakt) |

---

## Feature-specifieke TODO's (uit codebase)

| Item | Status | Notitie |
|------|--------|---------|
| Google Ads PMax image replacement live | ⬜ | TODO: bevestigen huidige limiet |
| Google Ads full budget/bidding strategy edits | ⬜ | TODO: bevestigen scope |
| Social Planner: uncommitted multi-upload wijzigingen committen | ⬜ | Zie git status |

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
