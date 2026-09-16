# Supabase applicatierol: gecontroleerde productie-rotatie

Dit runbook is bedoeld voor een gepland productie-onderhoudsmoment. Het maakt
geen rol aan en wijzigt geen Vercel-variabelen totdat de nieuwe verbinding lokaal
is gevalideerd.

## Doel

De Vercel-Prisma-verbinding moet een rol gebruiken met:

- `rolsuper = false`
- `rolbypassrls = false`
- uitsluitend de noodzakelijke database- en schemarechten

Gebruik nooit `postgres`, `supabase_admin` of een andere beheerrol voor Prisma.

## Voorbereiden in Supabase

Kies een unieke rolnaam en een lang, willekeurig wachtwoord. Deel het wachtwoord
niet in tickets, chat of documentatie. Voer de volgende SQL uit in de Supabase
SQL Editor met een beheerverbinding, nadat de huidige grants zijn geïnventariseerd:

```sql
CREATE ROLE digitify_app LOGIN PASSWORD '<GENERATED_SECRET>';
GRANT CONNECT ON DATABASE postgres TO digitify_app;
GRANT USAGE ON SCHEMA public TO digitify_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO digitify_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO digitify_app;

SELECT rolname, rolsuper, rolbypassrls
FROM pg_roles
WHERE rolname = 'digitify_app';
```

De exacte tabelrechten moeten vóór uitvoering worden afgestemd op de Prisma-
applicatie en RLS-configuratie. Voeg geen generieke Data API-policy toe.

## Validatie vóór omschakeling

1. Gebruik de nieuwe verbinding uitsluitend in een geïsoleerde staging- of
   tijdelijke Vercel-environment.
2. Voer uit:

```bash
DATABASE_URL='<NON_POOLING_OR_APP_URL>' pnpm db:check-production-role
DATABASE_URL='<NON_POOLING_OR_APP_URL>' ENABLE_WORKSPACE_RLS=true pnpm rls:smoke
```

3. Controleer login, dashboard, leads, domeinen, teamrechten en een cross-
   workspace IDOR-test.
4. Controleer dat exports, verzendingen en gevoelige settings nog volgens de
   bestaande policy werken.

## Vercel omschakeling

- Voeg de nieuwe waarde toe als Production `DATABASE_URL` en, indien gebruikt,
  `DIRECT_URL`/`POSTGRES_URL_NON_POOLING`.
- Laat de oude waarde bestaan tot de nieuwe deployment en smoke-test groen zijn.
- Deploy gecontroleerd en controleer `/api/health`, login en RLS-smoke.
- Verwijder of roteer daarna de oude databasecredential.

## Rollback

Bij een mislukte healthcheck of RLS-smoke: alias terugzetten naar de vorige
deployment, de nieuwe Vercel-variabelen uitschakelen en de nieuwe database-
credential blokkeren. Verwijder de rol pas nadat logs en actieve verbindingen
zijn gecontroleerd.

## Huidige status

De Supabase SQL Editor gebruikt `postgres` met `rolbypassrls=true`. De Vercel-
Prisma-rol is nog niet onafhankelijk geïdentificeerd. Daarom zijn er nog geen
rollen, grants, credentials of Vercel-variabelen gewijzigd.
