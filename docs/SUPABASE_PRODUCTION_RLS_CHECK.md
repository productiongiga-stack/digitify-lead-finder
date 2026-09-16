# Supabase productiecontrole

Deze controle is read-only. Voer de queries uit in **Supabase SQL Editor** voor de productieprojectdatabase. Deel geen connection strings, tokens of wachtwoorden.

## 1. Database-rol

```sql
SELECT current_user, rolsuper, rolbypassrls
FROM pg_roles
WHERE rolname = current_user;
```

Verwacht: `rolsuper = false` en `rolbypassrls = false`.

## 2. RLS-status

```sql
SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relname;
```

Alle app-tabellen die via de Data API bereikbaar zijn moeten `rls_enabled = true` hebben. `rls_forced` is afhankelijk van de gebruikte database-rol en applicatiearchitectuur.

## 3. Policies zonder gegevens te lezen

```sql
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Controleer dat policies tenant-eigendom afdwingen. Een policy met alleen `TO authenticated` is geen workspace-isolatie.

## 4. Tabelrechten

```sql
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, table_name, privilege_type;
```

Geef `anon` en `authenticated` alleen rechten op tabellen die bewust via de Supabase Data API beschikbaar zijn. De applicatie gebruikt server-side Prisma; onnodige Data API-rechten horen verwijderd te worden.

## 5. Na de controle

1. Bewaar alleen de uitkomsten `role`, `rolsuper`, `rolbypassrls` en eventuele tabelnamen met ontbrekende RLS.
2. Pas geen policy of grant aan zonder eerst de betrokken Data API-route te identificeren.
3. Voer daarna met een directe, niet-superuser `DATABASE_URL` uit:

```bash
pnpm db:check-production-role
ENABLE_WORKSPACE_RLS=true pnpm rls:smoke
```

De RLS-smoke gebruikt twee geïsoleerde testaccounts. Voer deze niet uit tegen productie als de seedmarkers of testaccounts daar niet bewust bestaan; gebruik dan eerst staging.
