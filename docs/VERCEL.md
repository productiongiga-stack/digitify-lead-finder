# Vercel — digitify-lead-finder

Git integration is active on branch `cursor/dashboard-modern-layout` (see [PR #1](https://github.com/productiongiga-stack/digitify-lead-finder/pull/1)).

**Fase-plan:** [docs/PHASES.md](PHASES.md) · **Eén project gebruiken:** koppel alleen `digitify-lead-finder` en verwijder dubbele Vercel-projecten (`project-ubm6y`, `productiongiga-stack-…`) om verwarring te voorkomen.

## Preview URL (latest push)

- https://digitify-lead-finder-git-c-54986e-productiongiga-7978s-projects.vercel.app

Dashboard: https://vercel.com/productiongiga-7978s-projects/digitify-lead-finder

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
| `REDIS_URL` or Upstash | `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` for Edge rate limits |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob — logo/branding uploads (avoid data URLs in prod) |
| `SENTRY_DSN` | Sentry project DSN (server errors + tRPC 500s) |
| `NEXT_PUBLIC_SENTRY_DSN` | Same DSN for client `global-error` boundary |

Optional staging:

| Variable | Notes |
|----------|--------|
| `ENABLE_WORKSPACE_RLS` | `true` only after `pnpm rls:smoke` on staging DB |

## Database on deploy

1. Link **Neon** (or Postgres) via Vercel Marketplace.
2. Run once against the production DB (local or CI shell with `DATABASE_URL`):

```bash
pnpm db:push          # if empty project
pnpm db:migrate       # RLS + incremental SQL
pnpm db:migrate-workspace-settings
pnpm db:seed          # optional dev/staging only
```

Do **not** run seed on production unless intentional.

## Production domain

1. Merge PR #1 to `main` (or promote preview in Vercel).
2. Vercel → **Domains** → add `leads.digitify.be` (see `DEPLOYMENT.md` for DNS).

## CLI (optional)

```bash
npx vercel login
npx vercel link
npx vercel --prod
```
