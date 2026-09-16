# Supabase security-audit — 15 september 2026

## Scope

Read-only controle van de twee gekoppelde projecten:

- Leads: `productiongiga-stack's Project` (`dlkyplyzgoscarytutin`)
- Shop: `Digitify Shop` (`ytukayzowaudzfhebtyb`)

Er zijn geen policies, grants, tabellen, datarecords of secrets gewijzigd.

## Bevindingen

### Leads

- Status: `ACTIVE_HEALTHY`.
- Security advisor: 7 tabellen hebben RLS aan zonder policies:
  `feedback_items`, `google_ad_accounts`, `google_ad_plans`, `meta_ad_accounts`, `meta_ad_plans`, `registration_requests`, `social_posts`.
- De read-only grantcontrole gaf geen tabelrechten voor `anon` of `authenticated` in `public`.
- De SQL-connector draait als `postgres` met `rolbypassrls=true`; dit is de connector-/managementsessie en geen bewijs voor de Vercel Prisma-rol.
- De Vercel Prisma-rol was niet zichtbaar in `pg_stat_activity` tijdens de korte controle.

### Shop

- Status: `ACTIVE_HEALTHY`.
- Security advisor: 16 tabellen hebben RLS aan zonder policies. Dit zijn onder andere order-, payment-, invoice-, settings-, user- en uploadtabellen.
- De read-only grantcontrole gaf ook hier geen tabelrechten voor `anon` of `authenticated` in `public`.
- Omdat hier geen policy of directe Data API-rechten voor is aangetoond, mogen deze tabellen niet als publiek toegankelijk worden beschouwd. Dit blijft wel een configuratiepunt dat in Supabase moet worden bevestigd.

### Performance

- Leads advisor meldt 28 foreign keys zonder covering index en 89 ongebruikte indexen.
- Shop advisor meldt 10 foreign keys zonder covering index en 14 ongebruikte indexen.
- Deze meldingen zijn geen automatische opdracht om indexen te verwijderen of toe te voegen. Eerst moeten querymetrics en `EXPLAIN` voor de trage routes worden gekoppeld; ongebruikte indexen kunnen nodig zijn voor zeldzame maar kritieke acties.

## Risicoclassificatie

- **P1 open:** de exacte productie-rol van de Vercel Prisma-verbinding is nog niet bewezen. Een rol met `BYPASSRLS` zou applicatie-RLS kunnen omzeilen.
- **P2:** tabellen met RLS zonder policies. Op basis van de gemeten afwezigheid van `anon`/`authenticated`-tabelrechten is geen publieke Data API-lek aangetoond, maar de configuratie is niet zelfverklarend.
- **P3:** performance-advisors voor indexen; eerst meten, daarna gericht aanpassen.

## Volgende veilige actie

Voer in Supabase SQL Editor of via een directe niet-superuser `DATABASE_URL` uit:

```sql
SELECT current_user, rolsuper, rolbypassrls
FROM pg_roles
WHERE rolname = current_user;
```

Verwacht voor de Prisma-app: `rolsuper = false` en `rolbypassrls = false`. Daarna pas `pnpm db:check-production-role` en de RLS-smoke uitvoeren. Deel geen connection string of wachtwoord.
