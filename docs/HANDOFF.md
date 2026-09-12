# Digitify Lead Finder - overdracht

Dit document beschrijft de huidige lokale toestand van het project, de uitgevoerde werkzaamheden en hoe je op een andere computer verdergaat.

## Repository

- GitHub: `https://github.com/productiongiga-stack/digitify-lead-finder`
- Monorepo: pnpm workspaces + Turborepo
- Frontend: Next.js 15, React 19, TypeScript
- API: tRPC 11
- Database: PostgreSQL + Prisma
- Auth: NextAuth JWT met workspace/RBAC-controles
- Lokale services: PostgreSQL en Redis via Docker Compose
- Deploymentmodel: Vercel voor de webapp, externe PostgreSQL/Supabase- of Neon-configuratie afhankelijk van de omgeving

## Starten op een nieuwe computer

Vereisten:

- Node.js volgens `package.json`/lockfile
- pnpm
- Docker Desktop
- Git

```bash
git clone https://github.com/productiongiga-stack/digitify-lead-finder.git
cd "Digitify Lead Finder"
pnpm install
cp .env.example .env
```

Vul daarna lokaal unieke waarden in voor minimaal `NEXTAUTH_SECRET`, `SETTINGS_ENCRYPTION_KEY` en `CRON_SECRET`. Gebruik nooit production secrets in een lokale `.env` of in Git. De lokale standaarddatabase staat in `.env.example`.

Start database en Redis:

```bash
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

De lokale applicatie is normaal beschikbaar op `http://localhost:3000`.

## Lokale testaccounts

Wachtwoorden worden bewust niet in deze repository, documentatie of rapportage opgeslagen. Genereer lokale accounts opnieuw met:

```bash
pnpm db:reset-local-accounts
```

Het script werkt alleen tegen een localhost-database, genereert nieuwe wachtwoorden en schrijft die lokaal naar:

```text
~/.config/digitify/local-credentials.txt
```

Dit bestand heeft beperkte bestandsrechten en mag niet worden gecommit of gedeeld.

De seed bevat onder meer een owner, tweede owner, admin/moderator, member, viewer, tester/module-restricted account en lokale leadfixtures. De precieze loginadressen staan in het seedscript en lokale credentials-bestand; wachtwoorden worden niet herhaald in GitHub.

## Belangrijkste commando's

```bash
pnpm db:generate
pnpm test
pnpm typecheck
pnpm lint
NODE_OPTIONS=--max-old-space-size=4096 pnpm build
RUN_DB_INTEGRATION=1 ENABLE_WORKSPACE_RLS=true pnpm test:integration
ENABLE_WORKSPACE_RLS=true pnpm rls:smoke
pnpm test:e2e
pnpm check:release
```

Voor E2E-tests zijn lokaal geldige seedcredentials nodig. Gebruik de credentials uitsluitend via shell-omgeving of het bestaande Playwright setup-proces; print wachtwoorden nooit naar logs.

## Uitgevoerde werkzaamheden

De huidige werkmap bevat, naast de oorspronkelijke code, een omvangrijke lokale audit- en herstelpatch. De belangrijkste afgeronde onderdelen zijn:

- actuele sessie-, membership-, workspace- en rolcontroles
- sessie-intrekking via `sessionVersion`
- modulecatalogus, moduleguards en accountgebonden moduletoegang
- platform-owner/accountbeheer en beperkte view-as-sessies
- security-auditlog voor gevoelige acties
- workspace-isolatie, IDOR- en RLS-regressietests
- beveiligde private workspace- en klantportaalbestanden
- formulieren, projecten, contracten, kennisbank, SEO, automatiseringen en rapportage-basisroutes
- domein-monitoring en domeinportfolio-overzicht
- leadimport, duplicatecontrole, scoring en providerfoutafhandeling
- outbound approval/send-controles en onzekere afleverstatus
- dashboardprefetch, cache-invalidatie en shell-requestreductie
- lazy loading van e-mailinstellingen, outbound previews en templates
- lokale Blob-inventarisatie en veilige cleanup van aantoonbaar verweesde productieobjecten
- Cloudflare-, Vercel- en Supabase-auditdocumentatie

De volledige fasehistorie staat in [`docs/AI_CHANGELOG.md`](./AI_CHANGELOG.md). Architectuurbeslissingen staan in [`docs/DECISIONS.md`](./DECISIONS.md), de modulekaart in [`docs/MODULE_MAP.md`](./MODULE_MAP.md) en deploymentinformatie in [`DEPLOYMENT.md`](../DEPLOYMENT.md) en [`docs/VERCEL.md`](./VERCEL.md).

## Laatste performancefase

De meest recente wijzigingen splitsen zware optionele UI uit de eerste routebundel:

- `/settings/email`: `316 kB` naar `159 kB`
- `/contacts/approval`: `268 kB` naar `165 kB`
- `/contacts/drafts/[id]`: `303 kB` naar `199 kB`
- `/templates`: `286 kB` naar `151 kB`

De production build slaagde met:

```bash
NODE_OPTIONS=--max-old-space-size=4096 pnpm --filter @digitify/web build
```

De standaard Node-heap was lokaal onvoldoende voor deze monorepo-build; dat is een buildmachinebeperking, geen runtimefout in de applicatie.

## Wat nog te doen is

### Eerstvolgende technische stap

- Browsermatig de outbound-flow doorlopen: template-index, preview, bewerken, opslaan, goedkeuringswachtrij en terugnavigatie.
- Controleren op console errors, dubbele requests en responsive gedrag op 375px, 768px en desktop.
- Daarna de resterende zware routes meten, met prioriteit voor `/settings/team`, `/contacts`, `/reports` en grote marketingmodules.

### Nog open of niet volledig bewezen

- Volledige production rollout is niet uitgevoerd vanuit deze lokale overdracht.
- Live Cloudflare-, Vercel- en Supabase-instellingen moeten in de betreffende dashboards worden gecontroleerd met een bevoegd account.
- Externe Gmail, Outlook, WhatsApp, Meta, Google, Stripe en WordPress-connectors zijn niet allemaal live gevalideerd; lokale mocks en configuratiechecks zijn leidend.
- De volledige integratie- en RLS-suite vereist een geïsoleerde database met de juiste niet-superuser-rollen.
- Er zijn bestaande lintwaarschuwingen. Ze blokkeren de build niet, maar moeten apart worden opgeschoond.
- Production environment variables, OAuth-secrets, Blob-tokens en databasecredentials staan niet in GitHub en moeten op de nieuwe machine of deploymentomgeving opnieuw worden gekoppeld.

## Veiligheidsregels voor verder werken

- Commit of upload nooit `.env`, `.env.local`, credentials, tokens, dumps, auth state of `apps/web/.next-dev/`.
- Roteer secrets wanneer ze ooit in chat, logs, screenshots of openbare issuegegevens zijn verschenen.
- Gebruik voor productie eerst een read-only audit en maak een backup/rollbackpunt vóór database- of storagewijzigingen.
- Test workspace-isolatie met minimaal twee workspaces vóór iedere release.
- Verstuur geen echte prospectmails tijdens lokale tests; gebruik draft, approval en lokale SMTP/mock-output.
- Wijzigingen aan Vercel, Cloudflare, Supabase of GitHub moeten afzonderlijk worden gecontroleerd voordat ze productie beïnvloeden.

## Huidige overdrachtstatus

- Wijzigingen zijn lokaal voorbereid.
- Geen wachtwoorden, API-tokens of secrets zijn in dit document opgenomen.
- Geen production deployment is door deze overdracht uitgevoerd.
- De lokale `.next-dev`-buildcache wordt expliciet genegeerd en hoeft niet te worden gekopieerd.

