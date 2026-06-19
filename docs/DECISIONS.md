# DECISIONS — Architecture Decision Records

Technische beslissingen gedocumenteerd uit codebase en bestaande docs.  
Nieuwe beslissingen: voeg ADR toe onderaan met datum.

---

## ADR-001: Monorepo met pnpm + Turborepo

**Status:** Actief  
**Context:** Meerdere packages (API, DB, UI, scoring, …) delen code; één deployable web app.  
**Beslissing:** pnpm workspaces (`apps/*`, `packages/*`) + Turborepo voor build/test pipeline.  
**Gevolgen:** Imports via `@digitify/*` workspace protocol; `turbo.json` definieert task dependencies.

---

## ADR-002: tRPC als primaire API-laag

**Status:** Actief  
**Context:** Type-safe API tussen Next.js frontend en business logic.  
**Beslissing:** `packages/api` exporteert `appRouter`; HTTP handler in `apps/web/src/app/api/trpc/[trpc]/route.ts`.  
**Gevolgen:** End-to-end types via `AppRouter`; superjson transformer; Zod errors geformatteerd in NL waar mogelijk.

---

## ADR-003: workspaceId = owner user id (niet workspaces.id)

**Status:** Actief  
**Bron:** `packages/api/src/lib/WORKSPACE.md`, `docs/PHASES.md` fase 6  
**Context:** Multi-tenant isolatie; Prisma FK's op tenant-rijen.  
**Beslissing:** `ctx.user.workspaceId` is de **owner `users.id`**. Teamleden krijgen `workspaceOwnerId` als workspaceId. Rijen gebruiken `createdById = workspaceId`.  
**Gevolgen:** `Workspace` model bestaat voor memberships/uitnodigingen maar is niet de FK voor tenant-data. Geen schema-migratie naar `workspaces.id` tenzij bewust gekozen.

---

## ADR-004: Opt-in Postgres RLS

**Status:** Actief (verplicht in productie)  
**Context:** Defense-in-depth naast application-level filters.  
**Beslissing:** `ENABLE_WORKSPACE_RLS=true` activeert RLS policies; app zet `app.workspace_id` per transaction (`packages/db/src/workspace-rls.ts`).  
**Gevolgen:** Rollback = env unset (policies blijven in DB). Smoke: `pnpm rls:smoke`. Productie zonder RLS → kritieke waarschuwing in `server-env.ts`.

---

## ADR-005: Settings key prefixes (workspace vs user)

**Status:** Actief  
**Beslissing:**
- Shared workspace settings: `workspace:{ownerId}:{key}`
- Personal settings: `user:{memberId}:{key}` (modules, UI prefs)  
**Migratie:** `pnpm db:migrate-workspace-settings` kopieert legacy `user:{ownerId}:*` naar workspace prefix.

---

## ADR-006: E-mail nooit auto-send

**Status:** Actief  
**Beslissing:** Outbound flow = draft → submit → manual approval → send.  
**Gevolgen:** `EmailDraft` status machine; geen silent SMTP in lead/campaign flows.

---

## ADR-007: NextAuth JWT + workspace membership roles

**Status:** Actief  
**Beslissing:** NextAuth voor sessie; effectieve rol per workspace via `effectiveWorkspaceRole` (membership), niet alleen globale `user.role`.  
**Gevolgen:** OAuth integraties (Meta/Google) gebruiken `workspaceRole` voor autorisatie.

---

## ADR-008: Module toggles per user

**Status:** Actief  
**Beslissing:** `ALL_MODULES` in `navigation.ts`; disabled modules in `user:{id}:modules.disabled`. Route guard via `module-access.ts`.  
**Gevolgen:** Leads/dashboard altijd open; marketing/verkoop modules optioneel per teamlid.

---

## ADR-009: Vercel Blob voor productie-uploads

**Status:** Actief  
**Context:** Serverless limieten; social video >4MB.  
**Beslissing:** `BLOB_READ_WRITE_TOKEN` voor productie; lokaal data-URL/blob fallback.  
**Gevolgen:** `import-media-to-blob.ts`, `upload-storage.ts`, Creative Studio + Social Planner.

---

## ADR-010: MuAPI BYOK (Bring Your Own Key)

**Status:** Actief  
**Beslissing:** MuAPI key per user, encrypted via `SETTINGS_ENCRYPTION_KEY`, opgeslagen als setting key `api.muapi_key`.  
**Gevolgen:** Creative Studio gate; proxy route `/api/muapi/*`. Zie `docs/CREATIVE-STUDIO.md`.

---

## ADR-011: Rate limiting dual backend

**Status:** Actief  
**Beslissing:**
- tRPC / server: Redis TCP (`REDIS_URL`)
- Edge middleware: Upstash REST (`UPSTASH_REDIS_REST_*`)  
**Fallback:** In-memory (single instance only) met dev warning.

---

## ADR-012: Incremental Prisma migrations (geen db push prod)

**Status:** Actief  
**Beslissing:** `pnpm db:migrate` → `prisma migrate deploy` via `scripts/prisma-migrate-deploy.sh`. Init squash bestaat; legacy DB's: `pnpm db:resolve-init`.  
**Gevolgen:** CI valideert migraties tegen Postgres 16.

---

## ADR-013: Social Planner multi-upload (shared carousel)

**Status:** Actief (geïmplementeerd, TODO: bevestigen merge-status)  
**Context:** Instagram carousel + Facebook multi-photo post.  
**Beslissing:** Eén set items (2–10) voor beide platformen; UI label "Multi-upload"; preview labels "Item N".  
**Bestanden:** `social-carousel-editor.tsx`, `social-publish.ts`, `social-placements.ts`, `social-page-inner.tsx`.

---

## ADR-014: Google Ads live edit (niet alleen draft)

**Status:** Actief (geïmplementeerd, TODO: bevestigen merge-status)  
**Beslissing:** Google Ads Studio laadt live campagnedata; opslaan/pauzeren/publiceren via Google Ads API.  
**Bestanden:** `google-ads.router.ts`, `google-ads.ts`, `google-ads-page-inner.tsx`.

---

## Template voor nieuwe ADR

```markdown
## ADR-NNN: Titel

**Status:** Voorgesteld | Actief | Verouderd  
**Datum:** YYYY-MM-DD  
**Context:** …  
**Beslissing:** …  
**Alternatieven:** …  
**Gevolgen:** …
```
