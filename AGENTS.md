# AGENTS.md

## Cursor Cloud specific instructions

### Product

Single deployable app: **Digitify Lead Search** (`apps/web`) — Next.js 15 + tRPC + Prisma. API runs inside the Next.js process; there is no separate backend service.

### Infrastructure (local dev)

| Service | Command | Port |
|---------|---------|------|
| PostgreSQL 16 | `docker compose up -d` (repo root) | 5432 |
| Redis 7 | same compose file | 6379 |
| Next.js dev | `pnpm dev` | 3000 |

**Docker in Cloud VMs:** systemd may not start `dockerd`. If `docker info` fails, start the daemon manually (once per VM session):

```bash
sudo dockerd > /tmp/dockerd.log 2>&1 &
sleep 3
cd /workspace && sudo docker compose up -d
```

### Environment files

- Copy `/.env.example` → `/.env` for Prisma/seed/shell commands.
- **Next.js only loads env from `apps/web/`** — also copy or symlink: `cp .env apps/web/.env.local` before `pnpm dev` or `pnpm build`.
- `NEXTAUTH_SECRET` must be at least 32 characters (see `.env.example`).
- `pnpm db:migrate` and `pnpm db:seed` need env in the shell: `set -a && source .env && set +a` (the migrate script does not auto-load `.env`).
- Seed requires: `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` (min 12 chars). See root `README.md`.

### Standard commands (see `README.md` for full list)

| Task | Command |
|------|---------|
| Install deps | `pnpm install` |
| DB client | `pnpm db:generate` |
| Migrations | `set -a && source .env && set +a && pnpm db:migrate` |
| Seed | `export SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=...` then `pnpm db:seed` |
| Dev server | `pnpm dev` (after `apps/web/.env.local` exists) |
| Lint | `pnpm lint` (known: `@digitify/ui` ESLint may fail TSX parse without project parser config) |
| Typecheck | `pnpm typecheck` |
| Unit tests | `pnpm test` |
| E2E | App on 3000: `PLAYWRIGHT_BASE_URL=http://localhost:3000 PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm test:e2e` |
| Health check | `curl http://localhost:3000/api/health` → `db` and `redis` should be `ok` |

### Dev server session

Use a persistent tmux session for `pnpm dev` (long-running). Reattach: `tmux -f /exec-daemon/tmux.portal.conf attach -t digitify-dev`.

### Test login (after seed)

- Email: `admin@digitify.local`
- Password: value of `SEED_ADMIN_PASSWORD` used during `pnpm db:seed` (README example: `minimaal-12-tekens`)

### Optional integrations

Google Places, SMTP, Anthropic/OpenAI, Meta/Google OAuth, Vercel Blob — not required for core lead/dashboard flows. Email can use `EMAIL_PROVIDER=console` for dev.
