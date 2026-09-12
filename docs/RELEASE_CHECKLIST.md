# Release checklist

Gebruik deze checklist vóór een merge of deployment. De checklist maakt geen commit, push of deployment.

## Lokaal

Voer uit vanaf de repository-root:

```bash
pnpm install --frozen-lockfile
PRODUCTION_ENV_FILE=.env.production.local pnpm check:production-env
pnpm setup:db:preflight
pnpm check:release
```

Controleer daarna:

```bash
git diff --check
git status --short
curl -fsS http://localhost:3000/api/health
```

Een lokale healthcheck bewijst alleen dat de lokale database en app werken. Externe connectoren, Vercel, Neon en productie-RLS zijn hiermee niet bewezen.

## CI en staging

1. Wacht op een groene `quality`-job: migraties, workspace-migraties, seed, RLS-integratie, typecheck, lint en build.
2. Wacht op een groene `e2e`-job met Playwright.
3. Voer op staging uit:

```bash
RUN_DB_INTEGRATION=1 ENABLE_WORKSPACE_RLS=true pnpm test:integration
ENABLE_WORKSPACE_RLS=true pnpm rls:smoke
PLAYWRIGHT_BASE_URL=https://<staging-url> pnpm test:e2e
```

4. Test met twee OWNER-accounts dat leads, instellingen, exports en directe ID-routes tenantgebonden blijven.
5. Controleer login, dashboard, leads, contactdrafts, goedkeuring, offertes, facturen, integraties en moduleguards in de browser.

## Productie

- Vercel-project, domein en environment variables zijn gecontroleerd volgens `docs/VERCEL.md`.
- `ENABLE_WORKSPACE_RLS=true`, `SETTINGS_ENCRYPTION_KEY`, `CRON_SECRET`, `DIRECT_URL` en rate-limitconfiguratie zijn aanwezig.
- Database-preflight is uitgevoerd tegen de bedoelde staging- of productiehost.
- Migraties zijn beoordeeld en worden pas toegepast met expliciete productieautorisatie.
- Geen seed uitvoeren op productie.
- Na deployment: `GET /api/health`, login, RLS-smoke en kernflow controleren.
- Bij problemen: deployment terugdraaien; RLS in productie niet uitschakelen als workaround.

## Huidige lokale status

- Deze werkmap bevat bestaande niet-gecommitte wijzigingen.
- Merge, push en deployment zijn daarom handmatige acties en blijven buiten Codex-scope.
