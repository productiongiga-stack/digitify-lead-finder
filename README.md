# Digitify Lead Search

Slimme lead generation en outreach tool voor Digitify. Zoek bedrijven, analyseer hun online zichtbaarheid, score op opportuniteit, en contacteer via e-mail - met AI-assistent OpenClaw.

## Quick Start

### Vereisten
- Node.js >= 20
- pnpm >= 9
- Docker (voor PostgreSQL + Redis)

### Setup

```bash
# Start databases
docker compose up -d

# Installeer dependencies
pnpm install

# Genereer Prisma client
pnpm db:generate

# Push schema naar database
pnpm db:push

# Seed demo data
pnpm db:seed

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

**Demo login:** admin@digitify.be / admin123

## Stack

| Laag | Technologie |
|------|-------------|
| Frontend | Next.js 15, React 19, TypeScript |
| UI | Tailwind CSS, shadcn/ui, TanStack Table |
| API | tRPC (type-safe) |
| Database | PostgreSQL + Prisma ORM |
| Auth | NextAuth.js (JWT + RBAC) |
| Queue | BullMQ + Redis (Fase 2) |
| Email | Provider abstractie (Fase 2) |
| AI | Anthropic Claude SDK - OpenClaw (Fase 2) |

## Project Structuur

```
├── apps/web/          # Next.js app
├── packages/
│   ├── api/           # tRPC routers + services
│   ├── db/            # Prisma schema + client
│   ├── ui/            # shadcn/ui components
│   ├── scoring/       # Score engine (Fase 2)
│   ├── connectors/    # Search connectors (Fase 2)
│   ├── email/         # Email provider (Fase 2)
│   ├── queue/         # BullMQ workers (Fase 2)
│   └── openclaw/      # AI agent (Fase 2)
```

## Modules

- **Dashboard** - KPI's, pipeline, activiteiten, niches, locaties
- **Lead Search** - Zoek op niche, stad, zoekwoord
- **Lead Table** - Filter, sorteer, pagineer, bulk acties
- **Lead Detail** - Score breakdown, tijdlijn, notities, e-mails
- **Campagnes** - Groepeer leads per niche/regio
- **Contact** - E-mail drafts, templates, approval flow
- **Settings** - Scoring gewichten, team, branding

## E-mail Veiligheid

E-mails worden NOOIT automatisch verzonden. De flow:
1. Draft aanmaken (handmatig of via OpenClaw)
2. Submit voor goedkeuring
3. Handmatige review + goedkeuring
4. Pas dan verzending

## Roadmap

- [x] Fase 1: App shell, auth, dashboard, leads, campagnes, settings
- [ ] Fase 2: Scoring engine, connectors, OpenClaw, email module
- [ ] Fase 3: Reports + PDF, bulk workflows, desktop packaging
