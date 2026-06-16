# Vercel — digitify-lead-finder

Git integration is active on branch `cursor/dashboard-modern-layout` (see [PR #1](https://github.com/productiongiga-stack/digitify-lead-finder/pull/1)).

**Fase-plan:** [docs/PHASES.md](PHASES.md) · **Productie:** gebruik Vercel-project **`project-ubm6y`** voor `leads.digitify.be` (zelfde repo + `vercel.json`). Preview/CI kan ook op `digitify-lead-finder` draaien — deploy productie via `vercel link --project project-ubm6y && vercel deploy --prod`.

## Preview URL (latest push)

- https://digitify-lead-finder-git-c-54986e-productiongiga-7978s-projects.vercel.app

Productie-dashboard: https://vercel.com/productiongiga-7978s-projects/project-ubm6y  
Productie-URL: https://leads.digitify.be

## Required environment variables (Production + Preview)

Set these in **Vercel → Project → Settings → Environment Variables**:

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | Neon/Postgres connection string (pooled) |
| `DIRECT_URL` | Direct Postgres URL (migrations) |
| `NEXTAUTH_URL` | `https://<your-domain>` |
| `NEXTAUTH_SECRET` | Min. 32 characters |
| `NEXT_PUBLIC_APP_URL` | Same as public app URL |
| `SETTINGS_ENCRYPTION_KEY` | Min. 32 characters (production) |
| `CRON_SECRET` | Min. 16 characters; Vercel Cron sends `Authorization: Bearer …` |
| `ENABLE_WORKSPACE_RLS` | **`true`** — required on `project-ubm6y` / production; without it the app returns 500 on all `/dashboard`, `/social`, etc. |
| `REDIS_URL` or Upstash | `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` for Edge rate limits |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob — logo/branding + **social video uploads** (required for videos >4MB on Vercel) |
| `SENTRY_DSN` | Sentry project DSN (server errors + tRPC 500s) |
| `NEXT_PUBLIC_SENTRY_DSN` | Same DSN for client `global-error` boundary |

Optional staging:

| Variable | Notes |
|----------|--------|
| `ENABLE_WORKSPACE_RLS` | `true` only after `pnpm rls:smoke` on staging DB |

**Staging RLS checklist (after seed + migrate):**
```bash
ENABLE_WORKSPACE_RLS=true pnpm rls:smoke
# Vercel Preview/Staging env: ENABLE_WORKSPACE_RLS=true
# Browser: owner-b@digitify.local vs admin@digitify.local — geen cross-tenant leads
PLAYWRIGHT_BASE_URL=https://<staging-url> pnpm test:e2e e2e/rls-cross-tenant.spec.ts
```

OAuth integration routes gebruiken `workspaceRole` (niet globale `user.role`) — team-ADMIN in een workspace kan Meta/Google koppelen.

## Local development (first run / after pull)

```bash
set -a && source .env && set +a
pnpm install
pnpm db:generate
pnpm db:resolve-init    # only if migrate fails on existing DB (P3009 on init)
pnpm db:migrate
pnpm --filter @digitify/web dev --port 3001
```

If the app shows a CSS build error, delete `apps/web/.next` and restart the dev server.

Login (seed): `admin@digitify.local` / `DigitifyDev2026!` (after `pnpm db:seed` if needed).

## Database on deploy

1. Link **Neon** (or Postgres) via Vercel Marketplace.
2. On **Supabase**, set **`DIRECT_URL`** (or `POSTGRES_URL_NON_POOLING`) to the **direct** connection string (`db.*.supabase.co:5432`), not the pooler (`*.pooler.supabase.com`). The app can keep a pooled `DATABASE_URL`.
3. After each release with new `packages/db/prisma/migrations/*`, apply migrations from your machine:

```bash
set -a && source .env.production.local && set +a   # must include DIRECT_URL (direct host)
pnpm db:generate
pnpm db:resolve-init    # if init migration is marked failed but schema exists
pnpm db:migrate
pnpm db:migrate-workspace-settings
pnpm db:seed            # optional dev/staging only
```

If production shows missing tables/columns (e.g. `workspace_tasks`, `bodyFormat`):

1. **Supabase → SQL Editor** → run one of:
   - `packages/db/prisma/manual/social-posts-and-meta-ads.sql` — missing `social_posts` / `meta_ad_plans` / `google_ad_plans`
   - `packages/db/prisma/manual/google-ads-only.sql` — missing Google Ads tables only
   - `packages/db/prisma/manual/workspace_tasks-only.sql` — missing `workspace_tasks`
   - `packages/db/prisma/manual/email_templates-columns.sql` — missing `email_templates.type` / layout / `bodyFormat`
   - `packages/db/prisma/manual/production-catch-up.sql` — full catch-up (safe to re-run)

   Ensure Vercel **`DIRECT_URL`** is the Supabase **direct** host (`db.*.supabase.co:5432`), not `localhost`.
2. Locally with production env (direct URL, not pooler):

```bash
vercel env pull .env.production.local --environment=production
set -a && source .env.production.local && set +a
# Set DIRECT_URL to Supabase "Session mode" / direct host (db.*.supabase.co:5432)
bash scripts/mark-pending-migrations-applied.sh
```

Or run `pnpm db:migrate` when `DATABASE_URL` / `DIRECT_URL` point at the direct connection.

Do **not** run seed on production unless intentional.

## Cross-tenant cron jobs

Several Vercel Cron routes intentionally process **all workspaces** in one invocation. They are idempotent and scope writes per row (`createdById` / `workspaceId`):

| Cron route | Purpose | Tenant scoping |
|------------|---------|----------------|
| `/api/cron/social-publish` | Publishes due `SCHEDULED` social posts | Each post belongs to one `createdById` (workspace owner id) |
| `/api/cron/drip` | Sends drip campaign emails | Drafts filtered on `lead.createdById`; SMTP/branding from workspace owner |
| `/api/cron/bookings-sync` | Syncs Google Calendar bookings | Credentials resolved per workspace owner |

**Per-workspace alternative:** authenticated admins can call `social.publishDuePosts` (tRPC) which runs `runDueSocialPostsWorker` scoped to `ctx.user.workspaceId` only.

When debugging tenant leaks, verify cron handlers never reuse a single SMTP token or Meta token across workspaces without re-loading config per `createdById`.

## Integration tests in CI

From the repo root:

```bash
# RLS + IDOR + settings RBAC (requires DATABASE_URL)
pnpm --filter @digitify/api test:integration

# RLS smoke (set ENABLE_WORKSPACE_RLS=true on staging first)
ENABLE_WORKSPACE_RLS=true pnpm rls:smoke
```

`test:integration` runs `workspace-rls`, `idor-smoke`, and `settings-rbac` specs. IDOR smoke covers lead/social/meta/google `getById` cross-tenant rejection.

## Google Ads module

1. **Google Cloud** — same OAuth client as Calendar (`integrations.google_oauth_client_id` / `secret` in Integraties).
2. **OAuth consent screen** — add sensitive scope `https://www.googleapis.com/auth/adwords`.
3. **Authorized redirect URI** (Production + local):
   - `https://leads.digitify.be/api/integrations/google-ads/callback`
   - `http://localhost:3000/api/integrations/google-ads/callback`
4. **Google Ads API Center** — create a **developer token** (Test for dev; Basic/Standard for production).
5. **Vercel env** — `GOOGLE_ADS_DEVELOPER_TOKEN` (required). Optional `GOOGLE_ADS_LOGIN_CUSTOMER_ID` if using an MCC.
6. **Integraties** → Google Ads → koppelen → selecteer customer ID op `/google-ads` → Instellingen.
7. **Supabase** — if tables are missing after deploy, run `packages/db/prisma/manual/google-ads-only.sql` in SQL Editor (do not rely on `db:migrate` during Vercel build).

## Production domain

1. Merge PR #1 to `main` (or promote preview in Vercel).
2. Vercel → **Domains** → add `leads.digitify.be` (see `DEPLOYMENT.md` for DNS).

## CLI (optional)

```bash
npx vercel login
npx vercel link --project project-ubm6y
npx vercel deploy --prod
```
