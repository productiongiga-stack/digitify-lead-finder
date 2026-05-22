# Prisma migrations

## Chain (apply in order)

| Migratie | Doel |
|----------|------|
| `20260522100000_init` | Volledig schema (greenfield) |
| `20260522120000_add_email_template_metadata` | No-op (legacy naam; zit in init) |
| `20260522140000_add_workspace_owner` | No-op (legacy naam; zit in init) |
| `20260522160000_workspace_row_level_security` | Postgres RLS policies |
| `20260523120000_workspace_tasks` | Taken per workspace (`workspace_tasks`) + RLS |
| `20260523140000_workspace_invoices` | Facturen (`workspace_invoices` + regels) + RLS |
| `20260523160000_workspace_saved_searches` | Opgeslagen lead-zoekopdrachten + RLS |
| `20260523200000_scoring_workspace_and_rls` | Scoring per workspace + RLS enrichment/chat |

## Nieuwe / lege database

```bash
pnpm db:generate
pnpm db:migrate
```

CI en `pnpm setup:db` gebruiken alleen `db:migrate` (geen `db push` meer).

## Bestaande database (vóór init-migratie)

Als `_prisma_migrations` al `20260522120000` / `140000` / `160000` bevat maar **niet** `20260522100000_init`:

```bash
pnpm --filter @digitify/db exec prisma migrate resolve --applied 20260522100000_init
pnpm db:migrate
```

Schema staat al in de DB (via eerdere `db push` of oude migraties); init overslaan voorkomt dubbele `CREATE TABLE`.

## Bestaande productie

1. **Geen** `db push --force-reset`.
2. `migrate resolve` voor init indien nodig (zie hierboven).
3. `pnpm db:migrate` → RLS + resterende pending.
4. `pnpm db:migrate-workspace-settings` (+ optioneel legacy templates).
