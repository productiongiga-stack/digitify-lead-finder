# Prisma migrations

## Huidige structuur

| Migratie | Doel |
|----------|------|
| `20260522120000_add_email_template_metadata` | Kolommen `type`, `layout`, CTA op `email_templates` |
| `20260522140000_add_workspace_owner` | `users.workspaceOwnerId` + backfill |
| `20260522160000_workspace_row_level_security` | Postgres RLS policies (opt-in via env) |

Deze migraties zijn **incrementeel**: ze verwachten dat tabellen al bestaan (historisch via `prisma db push`).

## Nieuwe / lege database

```bash
pnpm db:generate
pnpm --filter @digitify/db exec prisma db push --skip-generate
pnpm db:migrate
```

CI volgt hetzelfde patroon (zie `.github/workflows/ci.yml`).

## Bestaande productie (al live met db:push)

1. **Niet** opnieuw `db push --force-reset` op productie.
2. Alleen: `pnpm db:migrate` (past ontbrekende SQL toe).
3. Daarna: `pnpm db:migrate-workspace-settings` en optioneel `pnpm db:migrate-legacy-templates`.

## Toekomst: baseline squash (Fase 1.8)

Voor greenfield installs zonder `db push`-geschiedenis:

1. `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma` → één `init` migratie.
2. Behoud alleen RLS als aparte migratie.
3. Bestaande DB’s: `prisma migrate resolve --applied <init>` zonder SQL uit te voeren.

Tot die squash: **db push + migrate** blijft de ondersteunde weg.
