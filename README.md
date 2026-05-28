# Digitify Lead Search

**V1.0.1 ALPHA**

Slimme lead generation en outreach tool voor Digitify. Zoek bedrijven, analyseer hun online zichtbaarheid, score op opportuniteit, en contacteer via e-mail — met AI-assistent OpenClaw.

## Quick Start

### Vereisten

- Node.js >= 20
- pnpm >= 9
- Docker (PostgreSQL + optioneel Redis)

### Setup

```bash
docker compose up -d
pnpm install
pnpm db:generate
pnpm db:migrate          # init + RLS + workspace_tasks
pnpm db:seed             # vereist SEED_* env — zie hieronder
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) (of poort uit terminal).

**Bestaande database** (vóór init-migratie):

```bash
pnpm db:resolve-init
pnpm db:migrate
```

### Owner-accounts (seed)

```bash
export SEED_ADMIN_EMAIL=admin@digitify.local
export SEED_ADMIN_PASSWORD='minimaal-12-tekens'
# Optioneel tweede OWNER voor RLS-staging:
export SEED_RLS_OWNER_B_EMAIL=owner-b@digitify.local
pnpm db:seed
```

RLS-staging smoke: `ENABLE_WORKSPACE_RLS=true pnpm rls:smoke`

### Productie / staging database

```bash
pnpm setup:db
```

Zie [DEPLOYMENT.md](DEPLOYMENT.md) en [docs/VERCEL.md](docs/VERCEL.md).

### Uploads (logo’s, afbeeldingen)

- **Productie (Vercel):** `BLOB_READ_WRITE_TOKEN` — Vercel Blob Storage
- **Lokaal zonder token:** data-URL fallback (alleen dev)

## Stack

| Laag | Technologie |
|------|-------------|
| Frontend | Next.js 15, React 19, TypeScript |
| UI | Tailwind CSS, shadcn/ui |
| API | tRPC |
| Database | PostgreSQL + Prisma |
| Auth | NextAuth.js (JWT + RBAC) |
| Cache / limits | Redis of Upstash |
| Deploy | Vercel (+ Neon via Marketplace) |

## Scripts

| Script | Doel |
|--------|------|
| `pnpm test` | Unit tests (api, email, scoring, web) |
| `pnpm test:integration` | Postgres RLS |
| `pnpm test:e2e` | Playwright smoke |
| `pnpm typecheck` | TypeScript |
| `pnpm rls:smoke` | Cross-tenant RLS check |
| `pnpm setup:db` | Productie DB migraties |

## Documentatie

- [docs/PHASES.md](docs/PHASES.md) — verbeterplan per fase
- [packages/api/src/lib/WORKSPACE.md](packages/api/src/lib/WORKSPACE.md) — workspace / RLS
- [packages/db/prisma/migrations/README.md](packages/db/prisma/migrations/README.md) — migraties

## E-mail veiligheid

E-mails worden **niet** automatisch verzonden:

1. Draft aanmaken  
2. Indienen ter goedkeuring  
3. Handmatige goedkeuring  
4. Verzending  

## Roadmap (samenvatting)

- [x] App shell, leads, campagnes, outbound, Template Studio  
- [x] Workspace settings, optionele Postgres RLS  
- [x] CI, E2E smoke, strikte build  
- [x] Taken in database (`workspace_tasks`)  
- [ ] Productie live (Vercel + Neon + merge PR)  
- [ ] RLS op staging/productie  
