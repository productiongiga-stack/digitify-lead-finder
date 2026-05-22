# Workspace data policy

`ctx.user.workspaceId` is the **workspace owner user id** (OWNER uses own id; team members use `workspaceOwnerId`).

## Shared (workspace scope)

Stored as `workspace:{workspaceId}:{key}` with read fallback to legacy `user:{workspaceId}:{key}`.

- Branding, company profile, email SMTP/IMAP, integrations (Google Places, AI keys)
- Bookings embed settings, chatbot training, quotes/reviews config
- JSON blobs: tasks, invoices, saved searches, legacy template library

All team members with access read/write the same workspace settings (subject to role permissions in `permissions.ts`).

## Personal (member scope)

Stored as `user:{memberId}:{key}` only.

- `modules.disabled` (per-user module access from Team & Rollen)
- `ui.*`, `display.*` (personal display preferences)

## Database rows

Resources use `createdById = workspaceId` (leads, quotes, bookings, templates, …).

## Activity / audit

`Activity.userId` and draft `authorId` / `approverId` remain the **acting member** id.

## Chat sessions

`ownedChatSessionWhere(workspaceId, memberId)` — workspace leads + assigned member + `tenant:{workspaceId}` tag.

## Data migration (legacy `user:{ownerId}:*` → `workspace:{ownerId}:*`)

Shared keys that were stored under the owner’s **user** prefix are copied to `workspace:{workspaceId}:*`. Member-only keys (`modules.disabled`, `ui.*`, `display.*`) are skipped.

```bash
pnpm db:migrate-workspace-settings -- --dry-run
pnpm db:migrate-workspace-settings
```

Idempotent: existing `workspace:*` rows are not overwritten. Legacy `user:{ownerId}:*` rows are left in place for rollback.

## Legacy template library (`templates.library_json`)

Old JSON templates in workspace settings are migrated into `email_templates` rows (prefixed `[Legacy]`).

```bash
pnpm db:migrate-legacy-templates -- --dry-run
pnpm db:migrate-legacy-templates
```

Or via Template Studio → **Legacy migreren** (`template.migrateLegacyLibrary`). Reads/writes use **workspace** settings keys (`workspace:{id}:templates.library_json`), not per-member keys.

## Staging / production checks

1. Run the settings migration after `pnpm db:migrate`.
2. Run `pnpm db:migrate-legacy-templates` if any workspace still has `templates.library_json`.
3. Seed includes OWNER B (`SEED_RLS_OWNER_B_EMAIL`, default `owner-b@digitify.local`) with marker leads `RLS Workspace B — *`.
4. Enable `ENABLE_WORKSPACE_RLS=true` only after:
   - `RUN_DB_INTEGRATION=1 ENABLE_WORKSPACE_RLS=true pnpm test:integration`
   - `ENABLE_WORKSPACE_RLS=true pnpm rls:smoke`
   - Manual browser checklist printed by `rls:smoke`
5. E2E smoke: `PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm test:e2e` (with dev server on port 3001).

See `DEPLOYMENT.md` → **Workspace RLS rollout**.
