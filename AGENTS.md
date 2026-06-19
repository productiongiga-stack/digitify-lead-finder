# AGENTS.md — Digitify Lead Search

**Versie:** 1.0.1 ALPHA · **Repo:** `digitify-lead-search` (monorepo)

Dit bestand is het **startpunt voor LLM-agents** (Cursor, Codex, Claude, ChatGPT). Lees dit eerst, daarna de brain/wiki in `docs/`.

---

## Wat is dit project?

**Digitify Lead Search** is een slimme lead generation- en outreach-tool voor Digitify. Gebruikers zoeken bedrijven, scoren leads op opportuniteit, voeren outbound e-mail uit (met goedkeuring), beheren CRM/offertes/facturen, en gebruiken marketingmodules (Social Planner, Meta/Google Ads, Creative Studio, chatbot, boekingen, …).

---

## Brain / Wiki — leesvolgorde

| Prioriteit | Bestand | Doel |
|------------|---------|------|
| 1 | [docs/PROJECT_BRAIN.md](docs/PROJECT_BRAIN.md) | Compacte technische referentie voor LLM’s |
| 2 | [docs/MODULE_MAP.md](docs/MODULE_MAP.md) | Feature → router → UI → lib |
| 3 | [docs/FILE_INDEX.md](docs/FILE_INDEX.md) | Belangrijke paden en entry points |
| 4 | [docs/DECISIONS.md](docs/DECISIONS.md) | Architectuurkeuzes (ADR-stijl) |
| 5 | [docs/TODO.md](docs/TODO.md) | Open werk + roadmap |
| 6 | [docs/AI_CHANGELOG.md](docs/AI_CHANGELOG.md) | Wijzigingen door AI/human (chronologisch) |
| 7 | [docs/PROJECT_WIKI.md](docs/PROJECT_WIKI.md) | Uitgebreide menselijke wiki |

Aanvullend (bestaand):

- [README.md](README.md) — quick start
- [docs/PHASES.md](docs/PHASES.md) — verbeterplan fase 1–11
- [DEPLOYMENT.md](DEPLOYMENT.md) — CI, RLS rollout, rate limits
- [docs/VERCEL.md](docs/VERCEL.md) — Vercel/Neon env
- [packages/api/src/lib/WORKSPACE.md](packages/api/src/lib/WORKSPACE.md) — tenant/workspace data policy

---

## Stack (kort)

| Laag | Tech |
|------|------|
| Monorepo | pnpm workspaces + Turborepo |
| Frontend | Next.js 15, React 19, TypeScript, Tailwind, `@digitify/ui` |
| API | tRPC 11 (`packages/api`), Next route handlers |
| DB | PostgreSQL 16, Prisma (`packages/db`) |
| Auth | NextAuth.js JWT + RBAC (`apps/web/src/lib/auth/`) |
| Cache/limits | Redis / Upstash |
| Deploy | Vercel + Neon; Docker Compose lokaal |

---

## Monorepo-structuur

```txt
apps/web/          Next.js app (UI + API routes + tRPC handler)
packages/api/      tRPC routers + business logic
packages/db/       Prisma schema, migraties, seed, RLS
packages/ui/       Gedeelde UI (shadcn/Radix)
packages/email/    E-mail HTML/shell/templates
packages/scoring/  Lead scoring engine
packages/connectors/ Externe API helpers (o.a. SSRF guard)
packages/openclaw/ AI-assistent client (OpenClaw)
packages/media-studio/ MuAPI / Creative Studio client
scripts/           Dev, migrate, release checks
docs/              Documentatie + PROJECT BRAIN
```

---

## Essentiële commando’s

```bash
docker compose up -d          # Postgres + Redis lokaal
pnpm install
pnpm db:generate && pnpm db:migrate && pnpm db:seed
pnpm dev                      # scripts/dev-with-env.sh
pnpm test                     # turbo test + web vitest
pnpm typecheck
pnpm build
pnpm test:e2e                 # Playwright (apps/web)
pnpm test:integration         # RLS/IDOR (api, vereist DB)
ENABLE_WORKSPACE_RLS=true pnpm rls:smoke
```

**Let op:** Geen `.env.example` in repo (TODO: bevestigen of intentional). Env wordt gevalideerd via `packages/api/src/lib/server-env.ts` + `apps/web/src/instrumentation.ts`. Zie `docs/VERCEL.md` voor productie-vars.

---

## Regels voor agents

### Scope & kwaliteit

1. **Minimale diff** — los alleen de gevraagde taak op; geen drive-by refactors.
2. **Bestaande conventies** — match naming, imports, patterns in nabije code.
3. **Geen fake info** — documenteer alleen wat in de codebase staat; gebruik `TODO: bevestigen` bij twijfel.
4. **Geen commits** tenzij de gebruiker dit expliciet vraagt.
5. **Nederlandse UI-copy** — gebruikersgerichte teksten in het Nederlands (app is NL-first).

### Workspace / tenant

- `ctx.user.workspaceId` = **owner user id** (niet `workspaces.id`). Zie `WORKSPACE.md`.
- Productie vereist `ENABLE_WORKSPACE_RLS=true`.
- Nieuwe tenant-data: altijd `createdById = workspaceId` + RLS-compatible queries.

### E-mail

- E-mails worden **niet** automatisch verzonden: draft → goedkeuring → verzending.

### Tests vóór PR

```bash
pnpm db:generate && pnpm test && pnpm typecheck && pnpm build
# Bij DB/RLS-wijzigingen:
RUN_DB_INTEGRATION=1 ENABLE_WORKSPACE_RLS=true pnpm test:integration
```

### Documentatie bij wijzigingen

Na significante wijzigingen:

1. Voeg entry toe in [docs/AI_CHANGELOG.md](docs/AI_CHANGELOG.md)
2. Update [docs/MODULE_MAP.md](docs/MODULE_MAP.md) / [docs/TODO.md](docs/TODO.md) indien van toepassing
3. Nieuwe architectuurkeuze → [docs/DECISIONS.md](docs/DECISIONS.md)

---

## Waar beginnen per taaktype

| Taak | Start hier |
|------|------------|
| Nieuwe API-endpoint | `packages/api/src/routers/*.router.ts` → registreer in `root.ts` |
| UI-pagina | `apps/web/src/app/(app)/…/page.tsx` + `components/` |
| DB-wijziging | `packages/db/prisma/schema.prisma` → migratie in `migrations/` |
| Auth/permissions | `packages/api/src/lib/permissions.ts`, `apps/web/src/lib/permissions.ts` |
| Module toggle | `apps/web/src/lib/navigation.ts` (`ALL_MODULES`), `module-access.ts` |
| Cron job | `apps/web/src/app/api/cron/*/route.ts` + `packages/api/src/lib/cron-auth.ts` |
| Publieke embed | `apps/web/src/app/api/public/*` + `public-tenant.ts` |
| Social / Meta | `social.router.ts`, `social-publish.ts`, `components/social/` |

---

## Cursor rule

Automatische context: `.cursor/rules/project-brain.mdc` (always apply).
