# ASE License — Lead Finder deploy note

Run on **leads.digitify.be** (dashboard-modern-layout):

1. `pnpm --filter @digitify/db exec prisma migrate deploy` (migration `20260916170000_ase_licenses`)
2. Redeploy web app (routes + `/ase-license` + admin `/settings/ase-licenses`)
3. Smoke:
   - Owner: Settings → AI Builder licenses → key aanmaken voor e-mail (mailt automatisch)
   - Of: publieke aanvraag op `/ase-license` → Eigenaar krijgt mail → Goedkeuren & mailen
   - ASE Settings → paste key → Activeren

Public endpoints:

- `POST /api/public/ase-license/request` (notifies OWNERS)
- `POST /api/public/ase-license/activate`
- `POST /api/public/ase-license/validate`
- `POST /api/public/ase-license/deactivate`

Owner-only tRPC (`sensitiveOwnerProcedure` for mutations):

- `aseLicense.list` → `{ items, pendingCount }`
- `aseLicense.createForEmail` / `issue` / `revoke`
- Issue en createForEmail mailen de plaintext key; UI toont key eenmalig ook als SMTP faalt.
- `EMAIL_PROVIDER=console` slaat workspace-SMTP over (geen lokale timeout).

## Lokale test (WordPress plugin)

In `wp-config.php` tijdens lokale Lead Finder:

```php
define( 'ASE_LICENSE_API_BASE', 'http://127.0.0.1:3000' );
// FORCE_VALID moet UIT staan voor echte checks
```

Productie: default API base `https://leads.digitify.be`, geen `ASE_LICENSE_FORCE_VALID`.
