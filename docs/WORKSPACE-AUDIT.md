# Workspace settings audit

Generated checklist for Fase 3. Routers should use `workspaceScopeFromUser` / `readWorkspaceJsonSetting` / `workspace:{id}:*` keys.

## Compliant (workspace-aware)

| Router | Notes |
|--------|--------|
| `settings.router` | Primary settings read/write |
| `template.router` | `listParsedEmailTemplates` + legacy migrate |
| `contact.router` | Outbound + workspace scope |
| `inbox.router` | Workspace filters |
| `dashboard.router` | `createdById = workspaceId` |
| `search.router` | Saved searches workspace JSON |
| `task.router` | Tasks workspace JSON |
| `invoice.router` | Invoices workspace JSON |

## Verify when adding features

- [ ] New `Setting` rows use `workspace:{workspaceId}:*` for shared data
- [ ] Member-only keys stay `user:{memberId}:modules.disabled`, `ui.*`, `display.*`
- [ ] Prisma rows use `createdById = workspaceId` (owner id)
- [ ] With `ENABLE_WORKSPACE_RLS=true`, run `pnpm rls:smoke` after schema changes on isolated tables

## Migration commands

```bash
pnpm db:migrate-workspace-settings -- --dry-run
pnpm db:migrate-legacy-templates -- --dry-run
```

See `packages/api/src/lib/WORKSPACE.md`.
