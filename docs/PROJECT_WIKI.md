# PROJECT WIKI — Digitify Lead Search

Uitgebreide projectwiki voor developers en LLM-agents. Voor snelle referentie: [PROJECT_BRAIN.md](./PROJECT_BRAIN.md). Voor agents: [AGENTS.md](../AGENTS.md).

---

## Inhoudsopgave

1. [Over dit project](#1-over-dit-project)
2. [Quick start](#2-quick-start)
3. [Repository-structuur](#3-repository-structuur)
4. [Applicatiemodules](#4-applicatiemodules)
5. [Technische architectuur](#5-technische-architectuur)
6. [Database & multi-tenant](#6-database--multi-tenant)
7. [Authenticatie & autorisatie](#7-authenticatie--autorisatie)
8. [Integraties](#8-integraties)
9. [Testing & CI](#9-testing--ci)
10. [Deployment](#10-deployment)
11. [Ontwikkelregels](#11-ontwikkelregels)
12. [Documentatie onderhouden](#12-documentatie-onderhouden)

---

## 1. Over dit project

**Digitify Lead Search** (`digitify-lead-search`) is een interne SaaS-tool voor Digitify om:

- Bedrijven te **zoeken** (Google Places e.d.)
- Leads te **scoren** op online zichtbaarheid en opportuniteit
- **Outbound e-mail** te sturen met goedkeuringsworkflow
- **CRM**, offertes, facturen en taken te beheren
- **Marketing** te doen via Social Planner, ads, Creative Studio, chatbot, boekingen, domein-tracking en reviews

**Versie:** 1.0.1 ALPHA  
**Primaire stack:** Next.js 15, React 19, tRPC, Prisma, PostgreSQL, NextAuth

---

## 2. Quick start

### Vereisten

- Node.js ≥ 20
- pnpm ≥ 9 (`packageManager`: pnpm@9.15.0)
- Docker (Postgres + Redis)

### Commando’s

```bash
docker compose up -d
pnpm install
pnpm db:generate
pnpm db:migrate
export SEED_ADMIN_EMAIL=admin@digitify.local
export SEED_ADMIN_PASSWORD='minimaal-12-tekens'
pnpm db:seed
pnpm dev
```

Open `http://localhost:3000` (poort kan afwijken — check terminal).

**Na productie-build:** gebruik `pnpm --filter @digitify/web dev:clean` i.p.v. `dev` om corrupte `.next` te vermijden.

**Env:** Er is **geen** `.env.example` in de repo. Zie `docs/VERCEL.md` en `DEPLOYMENT.md` voor verplichte variabelen. Lokaal: root `.env` of `apps/web/.env.local` (geladen via `scripts/dev-with-env.sh`).

---

## 3. Repository-structuur

```txt
digitify-lead-search/
├── AGENTS.md                 # LLM entry point
├── README.md                 # Quick start
├── DEPLOYMENT.md             # CI, RLS, rate limits
├── docker-compose.yml        # Postgres 16 + Redis 7
├── package.json              # Root scripts (turbo)
├── pnpm-workspace.yaml
├── turbo.json
├── apps/
│   └── web/                  # @digitify/web — enige deployable app
│       ├── src/app/          # Next.js App Router
│       ├── src/components/   # React components per domein
│       ├── src/lib/          # Client/server helpers
│       └── e2e/              # Playwright tests
├── packages/
│   ├── api/                  # tRPC + business logic
│   ├── db/                   # Prisma + migraties
│   ├── ui/                   # Shared UI
│   ├── email/                # E-mail rendering
│   ├── scoring/              # Lead scoring
│   ├── connectors/           # External connector utils
│   ├── openclaw/             # AI assistant
│   └── media-studio/         # MuAPI / generative media
├── scripts/                  # Shell helpers
└── docs/                     # Documentatie + brain
```

---

## 4. Applicatiemodules

Sidebar-groepen (zie `apps/web/src/lib/navigation.ts`):

### Prospectie
- **Leads** — lijst, detail, bewerken
- **Leads zoeken** — Google Places search, opslaan als lead
- **Campagneprofielen** — drip/outbound profielen (`moduleId: campaigns`)

### Communicatie
- **Outbound** — compose, drafts, goedkeuring (`contacts`)
- **Inbox** — IMAP inbox (`contacts`)
- **Standaard berichten** — e-mail templates (`templates`)

### Verkoop
- **CRM** — pipeline view
- **Taken** — workspace tasks (DB)
- **Offertes** — quotes + configurator embed
- **Facturen** — workspace invoices (DB)

### Analyse
- **Website auditor** — rapporten (`reports`; `/audit` alias)

### Advertenties
- **Meta Ads** — campagneplannen, push naar Meta
- **Google Ads** — campagneplannen, live sync met Google Ads API

### Marketing
- **Social Planner** — Meta FB/IG posts, multi-upload carousel, scheduling
- **Creative Studio** — MuAPI image/video/ad generation
- **Boekingen** — Calendly-achtige booking widget
- **Domeinen** — tracking + insights
- **Reviews** — review requests + embed
- **Chatbot** — widget + training

### Instellingen
20+ secties onder `/settings/*` (account, workspaces, integraties, branding, SEO, scoring, team, e-mail, …).

Module-toegang kan per user uitgeschakeld worden (OWNER beheert via Team & Rollen).

---

## 5. Technische architectuur

### Request flow (authenticated)

1. Browser → Next.js page (React Server/Client Components)
2. Client → tRPC via `@/lib/trpc/client`
3. `apps/web/src/app/api/trpc/[trpc]/route.ts` → `packages/api`
4. Middleware: auth, workspace context, rate limit, optional RLS transaction
5. Router procedure → Prisma / external APIs

### Waar logic hoort

| Laag | Pad | Wanneer |
|------|-----|---------|
| UI | `apps/web/src/components/` | Presentatie, forms, previews |
| Page orchestration | `apps/web/src/app/(app)/*/` | Data fetching hooks, layout |
| API procedures | `packages/api/src/routers/` | Input validation, autorisatie |
| Domain logic | `packages/api/src/lib/` | Herbruikbare business rules |
| DB | `packages/db/prisma/schema.prisma` | Data model |

**Anti-pattern:** Zware business logic alleen in `page.tsx` — verplaats naar `packages/api`.

### Shared packages

- UI import: `@digitify/ui`
- Types/router: `@digitify/api` (AppRouter type)
- DB client: `@digitify/db`

---

## 6. Database & multi-tenant

### Prisma

- Schema: `packages/db/prisma/schema.prisma`
- Migraties: timestamped folders onder `migrations/`
- Client export: `packages/db/src/index.ts`

### Workspace model (belangrijk)

In de **applicatie** is `workspaceId` de **owner user id** (`users.id`), niet `workspaces.id`.

- OWNER: `workspaceId = own user id`
- Team member: `workspaceId = workspaceOwnerId`
- Data-rijen: `createdById = workspaceId`

Documentatie: `packages/api/src/lib/WORKSPACE.md`

### Settings storage

| Scope | Key pattern | Voorbeelden |
|-------|-------------|-------------|
| Workspace (shared) | `workspace:{ownerId}:{key}` | branding, SMTP, integrations |
| Personal | `user:{memberId}:{key}` | `modules.disabled`, `ui.*`, `display.*` |

### RLS (Row Level Security)

- Opt-in: `ENABLE_WORKSPACE_RLS=true`
- App zet `app.workspace_id` per transaction
- Smoke: `pnpm rls:smoke`
- Integration tests: `pnpm test:integration`

**Productie:** RLS is verplicht voor tenant-isolatie (zie `server-env.ts`).

---

## 7. Authenticatie & autorisatie

### Auth
- **NextAuth.js** met JWT session
- Config: `apps/web/src/lib/auth/options.ts`
- Route: `apps/web/src/app/api/auth/[...nextauth]/route.ts`

### Rollen
`UserRole`: OWNER, ADMIN, MODERATOR, MEMBER, TRIAL, TESTER, VIEWER

Effectieve rol in workspace: `effectiveWorkspaceRole` (membership-based, niet alleen globale `user.role`).

### Permissions
- Server: `packages/api/src/lib/permissions.ts`
- Client settings nav: `apps/web/src/lib/permissions.ts`
- Module guard: `apps/web/src/lib/module-access.ts`

### E-mail veiligheid
Workflow: **Draft → indienen → goedkeuring → verzending**. Geen auto-send.

---

## 8. Integraties

| Service | Gebruik | BYOK / OAuth |
|---------|---------|--------------|
| Google Places | Lead search | API key in settings |
| Meta | Social publish, Ads | OAuth (`/api/integrations/meta/*`) |
| Google Ads | Ads studio | OAuth + developer token |
| Google Calendar | Bookings sync | OAuth |
| MuAPI | Creative Studio | Per-user key (`api.muapi_key`) |
| SMTP/IMAP | Outbound + inbox | Workspace settings |
| Vercel Blob | Uploads, social video | `BLOB_READ_WRITE_TOKEN` |
| Redis/Upstash | Rate limits | Env vars |
| Sentry | Error tracking | DSN |
| OpenClaw | AI page assist | `@digitify/openclaw` |

Details Creative Studio: `docs/CREATIVE-STUDIO.md`

---

## 9. Testing & CI

### Lokaal

```bash
pnpm test              # api + email + scoring + ui + web
pnpm typecheck
pnpm --filter @digitify/web lint
pnpm build
pnpm test:e2e          # Playwright
pnpm test:integration  # DB + RLS (RUN_DB_INTEGRATION=1)
pnpm rls:smoke         # Cross-tenant check
pnpm check:release     # Release script
```

### CI (GitHub Actions)

`.github/workflows/ci.yml`:
- quality job: test, typecheck, lint, build, db:migrate
- e2e job: seed + Playwright smoke

### E2E specs

`apps/web/e2e/`: health, smoke, dashboard, leads, RLS cross-tenant, module guard, settings RBAC, creative studio, portal upload, viewer readonly.

---

## 10. Deployment

- **Platform:** Vercel (`vercel.json` in repo)
- **Database:** Neon/Postgres (pooled `DATABASE_URL` + direct `DIRECT_URL`)
- **Productie URL:** `https://leads.digitify.be`
- **Runbook:** `DEPLOYMENT.md`, `docs/VERCEL.md`
- **DB setup:** `pnpm setup:db` / `./scripts/setup-production-db.sh`

### Cron routes (Vercel Cron)

- `/api/cron/drip`
- `/api/cron/social-publish`
- `/api/cron/bookings-sync`
- `/api/cron/media-reconcile`

Vereist `CRON_SECRET` in Authorization header.

### Open deployment items (PHASES.md)

- Vercel env volledig configureren (handmatig)
- Neon productie DB + seed staging
- PR merge naar main
- RLS enable op staging/productie

---

## 11. Ontwikkelregels

1. **Minimale scope** — geen unrelated refactors
2. **Match conventions** — lees nabije code vóór wijzigen
3. **Tenant-aware** — altijd workspace scope respecteren
4. **NL copy** — gebruikersinterface in het Nederlands
5. **Tests** — run `pnpm test` (+ integration bij DB/RLS)
6. **Geen commits** tenzij expliciet gevraagd
7. **Geen secrets** committen (.env, tokens)
8. **Documenteer** significante wijzigingen in `AI_CHANGELOG.md`

---

## 12. Documentatie onderhouden

| Bestand | Wanneer updaten |
|---------|-----------------|
| `AI_CHANGELOG.md` | Elke significante feature/fix |
| `MODULE_MAP.md` | Nieuwe router, pagina, of module |
| `FILE_INDEX.md` | Nieuwe entry points |
| `DECISIONS.md` | Architectuurkeuze |
| `TODO.md` | Afgerond/open items |
| `PHASES.md` | Fase-voortgang (menselijk plan) |

---

*Laatste update: juni 2026 — gegenereerd uit codebase-analyse.*
