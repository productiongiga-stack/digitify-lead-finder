# Verbeterplan in fases

Werk de fases **in volgorde** af. Fase 6 is launch-blocker voor meerdere klanten; fases 7–10 zijn polish en onderhoud; fase 11 is strategie.

**Legenda:** ✅ afgerond · 🔄 deels · ⬜ open · 👤 handmatig (jij)

---

## Volgorde (aanbevolen)

```text
[Fase 1–5 ✅] → Fase 6 (security) → Fase 7 (UX/copy) → Fase 8 (DX/deploy)
              → Fase 9 (data) → Fase 10 (refactor) → Fase 11 (MVP/modules)
              → 👤 Vercel/Neon/merge/RLS-productie
```

---

## Afgerond — Fase 1 t/m 5

| Fase | Thema | Kern |
|------|--------|------|
| **1** | Productie-fundament | CI migrate, init-migratie, setup-scripts, Vercel-doc, RLS-seed |
| **2** | Kwaliteit | Playwright smoke/health/RLS, strict build |
| **3** | Observability | `/api/health`, WORKSPACE.md, audit-checklist |
| **4** | Opschoning | Deprecated APIs weg, DEPLOYMENT runbook |
| **5** | Product & ops | Blob, tasks/invoices/saved searches → DB, Sentry, E2E compose |

Details en commando’s voor 1–5 staan onderaan dit document.

---

## Fase 6 — Beveiliging & tenant-isolatie (kritiek)

**Doel:** Geen data of e-mail van workspace A in workspace B. **Niet live zetten voor meerdere klanten vóór 6.1–6.4.**

| # | Item | Waarom | Bestanden / actie | Status |
|---|------|--------|-------------------|--------|
| 6.1 | **Team-API workspace-scopen** — `user.list` alleen leden van huidige workspace; `updateRole` / `deleteUser` / modules alleen binnen workspace | Nu zie je RLS-test-users in team; cross-tenant admin mogelijk | `user.router.ts`, `workspace-members.ts` | ✅ |
| 6.2 | **Drip-cron per workspace** — drafts filteren op `lead.createdById`; SMTP via workspace-eigenaar | Verkeerde SMTP/branding tussen tenants | `campaign.router.ts`, `api/cron/drip/route.ts` | ✅ |
| 6.3 | **RLS op staging, daarna productie** — `ENABLE_WORKSPACE_RLS=true` na `pnpm rls:smoke` + browser-check met 2 OWNERs | App-filters alleen zijn onvoldoende | env + `e2e/rls-cross-tenant.spec.ts` | ✅ lokaal + openclaw_logs fix / 👤 staging deploy |
| 6.4 | **RLS uitbreiden** — `enrichment_data`, `chat_sessions`, `chat_messages` | Gaten in RLS-migraties | `20260523200000_scoring_workspace_and_rls` | ✅ |
| 6.5 | **Publieke tracker** — ACTIVE domain + lead/workspace-koppeling | Data-vervuiling | `api/public/tracker/route.ts` | ✅ |
| 6.6 | **Publieke tenant-token verplicht** — geen fallback naar eerste OWNER | Kosten + data-lek | `public-tenant.ts` (bookings/chatbot/quotes al 400) | ✅ |
| 6.7 | **Notificaties/footer scoped** — `REGISTRATION_NOTIFY_WORKSPACE_ID`, `PUBLIC_MARKETING_WORKSPACE_ID`, feedback → workspace | Verkeerde tenant | `registration.router.ts`, `settings.router.ts` | ✅ |
| 6.8 | **Scoring per workspace** — `_global` defaults + workspace overrides | Globale weights | `scoring-weights.ts`, migratie | ✅ |
| 6.9 | **Tests** — `workspace-members.test.ts`; bestaande suite groen | Regressie | `packages/api/src/__tests__/` | ✅ |

**Acceptatie:** Twee OWNERs in staging; B ziet 0 leads van A; team-lijst alleen eigen leden; drip gebruikt juiste afzender.

### Workspace-id vs. `workspaces`-tabel (bewuste keuze)

In de app is `workspaceId` / `createdById` op tenant-rijen de **owner user id** (`users.id`), niet `workspaces.id`. Prisma-FK's verwijzen daarom naar `users(id)` waar het plan oorspronkelijk `workspaces` noemde. Teamleden hebben `workspaceOwnerId` gezet; RLS gebruikt `app_workspace_id()` = die owner id. Geen schema-migratie naar een apart `Workspace`-FK tenzij je het `Workspace`-model centraal wilt maken.

---

## Fase 7 — UX, copy & UI-polish

**Doel:** App voelt af, consistent Nederlands, minder ruis in dashboard en zoeken.

| # | Item | Waarom | Bestanden / actie | Status |
|---|------|--------|-------------------|--------|
| 7.1 | **Dashboard deduplicatie** — actiecentrum geen dubbele leads; “Top leads” geen 4× zelfde bedrijf; dubbele KPI-rij verwijderen | Verwarrend in browser | `dashboard/page.tsx`, `dashboard.router.ts` | ✅ |
| 7.2 | **Foutstates** — `isError` + retry op dashboard, leads, leads/search, CRM | Bij API-fout lijkt alles “leeg” | genoemde `page.tsx` | ✅ |
| 7.3 | **Leads zoeken** — “Populair”-tags inklapbaar of max ~8 zichtbaar; uitleg waarom “Zoeken” disabled | Te veel verticale ruimte | `leads/search/page.tsx` | ✅ |
| 7.4 | **Leads-lijst** — placeholder niet afkappen (“em…”); knoppen op mobiel minder druk | Polish | `leads/page.tsx` | ✅ |
| 7.5 | **Outbound compose** — banners inklapbaar of 1 samenvattende info-regel | 4 gekleurde banners vóór formulier | `contacts/compose/page.tsx` | ✅ |
| 7.6 | **Navigatie** — ander icoon voor Facturen vs Offertes; Templates-pad verduidelijken | Zelfde Receipt-icoon | `navigation.ts` | ✅ |
| 7.7 | **Copy NL** — API/tRPC-fouten Nederlands; status `responded`/`qualified` → NL in UI | Engels in NL-app | `trpc.ts`, `lead-status.ts`, dashboard | ✅ |
| 7.8 | **Instellingen-titels** — “Performance” → “Prestaties”, “Pipeline Stages” → NL, enz. | Mix NL/EN | `navigation.ts`, settings pages | ✅ |
| 7.9 | **Team-kaart** — tekst “Taken & facturen (JSON)” → Postgres / gedeelde tabellen | Verouderde copy | `user.router.ts` (~80) | ✅ |
| 7.10 | **Marketing** — demo-cijfers (€84k) labelen als “voorbeeld” indien gewenst | Verwachtingsmanagement | `components/marketing/` | ✅ |

**Acceptatie:** Geen dubbele dashboard-items; gebruiker ziet foutmelding bij kapotte API; team-tekst klopt met architectuur.

---

## Fase 8 — Developer experience & deploy

**Doel:** Lokaal starten zonder verrassingen; productie stabiel.

| # | Item | Waarom | Bestanden / actie | Status |
|---|------|--------|-------------------|--------|
| 8.1 | **Dev env laden** — `pnpm dev` laadt root `.env` of `apps/web/.env.local` symlink | Server crasht zonder env → Internal Server Error | root `package.json` of `apps/web/package.json` | ⬜ |
| 8.2 | **Next config opschonen** — `experimental.instrumentationHook` verwijderen (Next 15 default) | Build-warnings | `apps/web/next.config.js` | ⬜ |
| 8.3 | **`pnpm check:release`** in CI of pre-merge doc | Eén commando vóór PR | `scripts/check-release.sh`, CI | ⬜ |
| 8.4 | **👤 Vercel** — één project, alle env vars (`docs/VERCEL.md`) | Preview/deploy | 👤 | ⬜ |
| 8.5 | **👤 Productie-DB** — `pnpm setup:db` op Neon | Schema + seed | 👤 | ⬜ |
| 8.6 | **👤 PR #1 mergen** na groene CI + fase 6 op staging | `main` = productie-basis | 👤 | ⬜ |

---

## Fase 9 — Datamodel & technische schuld

**Doel:** Eén waarheid per feature; geen dode schema’s of runtime-migratie op elk request.

| # | Item | Waarom | Bestanden / actie | Status |
|---|------|--------|-------------------|--------|
| 9.1 | **`SavedView` opruimen** — tabel droppen of feature bouwen (nu alleen `WorkspaceSavedSearch`) | Dode code / verwarring | `schema.prisma`, migratie | ⬜ |
| 9.2 | **Stop per-list JSON-migratie** — na eenmalige `setup:db`/script: geen `count`+import op elke `list` | Noise onder load | `migrate-workspace-*.ts`, routers | ⬜ |
| 9.3 | **Settings-tenant model** — documenteer of migreer kritieke keys naar workspace-kolommen | Prefix-bugs = cross-tenant | `WORKSPACE.md`, lange termijn | ⬜ |
| 9.4 | **Template library** — één bron (DB), `library_json` alleen migratie | Dubbel pad | `template.router.ts`, seed | ⬜ |
| 9.5 | **Deprecated aliases verwijderen** — `validateEnv`, `tenant.ts` legacy | Schuld | `server-env.ts`, `tenant.ts` | ⬜ |

---

## Fase 10 — Performance & onderhoudbaarheid

**Doel:** Sneller dashboard; makkelijker PRs en reviews.

| # | Item | Waarom | Bestanden / actie | Status |
|---|------|--------|-------------------|--------|
| 10.1 | **`settings/quotes/page.tsx` splitsen** (~5000 regels) — subcomponents + hooks | Onderhoud + bundle | `settings/quotes/` | ⬜ |
| 10.2 | **`dashboard/page.tsx` splitsen** (~1100 regels) — widgets als losse bestanden | Idem | `components/dashboard/` | ⬜ |
| 10.3 | **Dashboard queries** — dubbele `getUpcomingBookings` weg; overweeg 1 `getDashboardBundle` | 10+ parallelle queries | `dashboard.router.ts`, page | ⬜ |
| 10.4 | **`user.list` N+1** — Google-status batch i.p.v. per user | Trage team-pagina | `user.router.ts` | ⬜ |
| 10.5 | **Tracker JSON blob** — normaliseer pageviews of partition per domain | RMW op groot JSON | `tracker/route.ts`, schema | ⬜ |
| 10.6 | **Playwright in CI** — optioneel smoke na grote UI-wijzigingen | Regressie UI | `e2e/` | ⬜ |

---

## Fase 11 — Productstrategie & modules (optioneel)

**Doel:** Verkopen en bouwen wat waarde levert; rest achter vlag.

| # | Item | Waarom | Actie | Status |
|---|------|--------|-------|--------|
| 11.1 | **MVP-kern definiëren** | Te veel modules voor “simpele lead tool” | Leads → zoeken → score → outbound → offerte | ⬜ |
| 11.2 | **Module flags per klant** | Al deels via `ALL_MODULES` | Default uit: audit, OpenClaw, chatbot tot nodig | ⬜ |
| 11.3 | **Onboarding-flow** | Nieuwe user weet niet waar te beginnen | Eerste login: 3 stappen (zoek → lead → mail) | ⬜ |
| 11.4 | **Documentatie voor eindgebruiker** | Veel power, weinig uitleg | Korte NL-help per module | ⬜ |

---

## Commando’s

**Na fase 6 (staging):**
```bash
ENABLE_WORKSPACE_RLS=true pnpm rls:smoke
PLAYWRIGHT_BASE_URL=http://localhost:3001 pnpm test:e2e
```

**Voor elke code-fase (7–10):**
```bash
pnpm db:generate && pnpm test && pnpm typecheck && pnpm build
# optioneel:
pnpm check:release
```

**Deploy (8, 👤):**
```bash
./scripts/setup-production-db.sh
# Vercel env: zie docs/VERCEL.md
```

---

## Afgeronde items — detail Fase 1–5

### Fase 1 — Productie-fundament
| # | Item | Status |
|---|------|--------|
| 1.1 | CI: incrementele migraties | ✅ |
| 1.2 | Migratie-documentatie | ✅ |
| 1.3 | `scripts/setup-production-db.sh` | ✅ |
| 1.4 | `docs/VERCEL.md` | ✅ |
| 1.5 | Twee OWNER seed + `pnpm rls:smoke` | ✅ |
| 1.6 | 👤 Vercel-project + env | ⬜ |
| 1.7 | 👤 Neon/productie-DB | ⬜ |
| 1.8 | Init-migratie squash | ✅ |

### Fase 2 — Kwaliteit
| # | Item | Status |
|---|------|--------|
| 2.1–2.6 | Playwright, health, RLS e2e, bookings layout, strict build | ✅ |

### Fase 3 — Observability
| # | Item | Status |
|---|------|--------|
| 3.1–3.3 | Health, WORKSPACE.md, WORKSPACE-AUDIT | ✅ |

### Fase 4 — Opschoning
| # | Item | Status |
|---|------|--------|
| 4.1–4.2 | Deprecated APIs, DEPLOYMENT | ✅ |
| 4.3 | 👤 PR mergen | ⬜ |

### Fase 5 — Product & ops
| # | Item | Status |
|---|------|--------|
| 5.1–5.7 | Blob, tasks/invoices/saved searches DB, Sentry, README, E2E compose | ✅ |

---

## Geschatte inspanning (indicatie)

| Fase | Richting |
|------|----------|
| 6 | 2–4 dagen dev + 1 dag staging-test |
| 7 | 2–3 dagen |
| 8 | 0.5 dag code + 👤 deploy |
| 9 | 1–2 dagen |
| 10 | 2–4 dagen (quotes-split grootste blok) |
| 11 | doorlopend product |

---

*Laatste update: audit browser + codebase (mei 2026). Vink ⬜ af bij merge; gebruik PR-beschrijving of issues per nummer (bijv. `6.1`).*
