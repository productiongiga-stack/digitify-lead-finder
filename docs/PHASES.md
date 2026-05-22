# Verbeterplan in fases

Status bijgewerkt na implementatie in repo. Vink af in PR / bij deploy.

## Fase 1 — Productie-fundament (kritiek)

| # | Item | Status |
|---|------|--------|
| 1.1 | CI: `db push` + incrementele migraties | ✅ `.github/workflows/ci.yml` |
| 1.2 | Migratie-documentatie (geen baselines op lege DB) | ✅ `packages/db/prisma/migrations/README.md` |
| 1.3 | Productie DB-setup script | ✅ `scripts/setup-production-db.sh` |
| 1.4 | Vercel env + deploy guide | ✅ `docs/VERCEL.md` |
| 1.5 | Twee OWNER seed + `pnpm rls:smoke` | ✅ seed + CI step |
| 1.6 | **Jij:** één Vercel-project + env vars invullen | ⬜ handmatig |
| 1.7 | **Jij:** Neon/productie-DB script draaien | ⬜ handmatig |
| 1.8 | Volledige `init`-migratie (squash) | ✅ `20260522100000_init` + no-op legacy |

## Fase 2 — Kwaliteit & vertrouwen

| # | Item | Status |
|---|------|--------|
| 2.1 | Playwright: Template Studio campagne-filter | ✅ |
| 2.2 | Playwright: `/api/health` | ✅ |
| 2.3 | Playwright: cross-tenant RLS (OWNER B) | ✅ `e2e/rls-cross-tenant.spec.ts` |
| 2.4 | CI env voor OWNER B in e2e | ✅ |
| 2.5 | Build `/bookings` — layout voor public subroutes | ✅ `app/bookings/layout.tsx` |
| 2.6 | `ignoreBuildErrors` uitzetten | ✅ `next.config.js` strict build |

## Fase 3 — Observability & workspace

| # | Item | Status |
|---|------|--------|
| 3.1 | Health: Redis-check (optioneel) | ✅ `/api/health` |
| 3.2 | Workspace policy doc | ✅ `packages/api/src/lib/WORKSPACE.md` |
| 3.3 | Settings audit checklist | ✅ `docs/WORKSPACE-AUDIT.md` |

## Fase 4 — Opschoning

| # | Item | Status |
|---|------|--------|
| 4.1 | Verwijder deprecated `contact.*` template API’s | ✅ al weg |
| 4.2 | Runbook Vercel + VPS in DEPLOYMENT | ✅ |
| 4.3 | PR #1 mergen → productie | ⬜ handmatig |

---

## Commando’s per fase

**Fase 1 (staging/productie DB):**
```bash
./scripts/setup-production-db.sh
ENABLE_WORKSPACE_RLS=true pnpm rls:smoke   # alleen na staging-test
```

**Fase 2 (lokaal/CI):**
```bash
pnpm test && pnpm typecheck && pnpm build
PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:3001 pnpm test:e2e
```

**Volgorde deploy:** Fase 1 → 2 groen in CI → merge → Fase 1.6–1.7 op Vercel → RLS (1.5) op staging → productie.
