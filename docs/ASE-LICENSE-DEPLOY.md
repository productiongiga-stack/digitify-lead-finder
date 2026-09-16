# ASE License — Lead Finder deploy note

Run on **leads.digitify.be** (dashboard-modern-layout):

1. **Fix App Router 500 (DB role):** productie `DATABASE_URL` mag geen `SUPERUSER`/`BYPASSRLS` hebben. Instrumentation soft-failt by default (`STRICT_DATABASE_ROLE_CHECK=true` voor hard-fail na switch naar `digitify_app`).
2. `pnpm db:migrate` / `bash scripts/prisma-migrate-deploy.sh` met productie **DIRECT_URL** (migration `20260916170000_ase_licenses`)
3. Redeploy web app (routes + `/ase-license` + admin `/settings/ase-licenses`)
4. Smoke:
   - Owner: Settings → AI Builder licenses → key aanmaken voor e-mail (mailt automatisch)
   - Of: publieke aanvraag op `/ase-license` → Eigenaar krijgt mail → Goedkeuren & mailen
   - ASE Settings → paste key → Activeren
   - `POST …/validate` met geldige key → `{ ok: true }`; ongeldige key → 4xx `{ ok: false }`

Public endpoints:

- `POST /api/public/ase-license/request` (notifies OWNERS)
- `POST /api/public/ase-license/activate`
- `POST /api/public/ase-license/validate`
- `POST /api/public/ase-license/deactivate`

Als `ase_licenses` nog niet gemigreerd is: public routes → **503** `{ error: "unavailable" }` (niet generieke 500).

Owner-only tRPC (`sensitiveOwnerProcedure` for mutations):

- `aseLicense.list` → `{ items, pendingCount }` (lege lijst als tabel ontbreekt)
- `aseLicense.createForEmail` / `issue` / `revoke`
- Issue en createForEmail mailen de plaintext key; UI toont key eenmalig ook als SMTP faalt.
- `EMAIL_PROVIDER=console` slaat workspace-SMTP over (geen lokale timeout).

## WordPress plugin (Digitify AI Builder)

`LicenseClient` default base: `https://leads.digitify.be`.

Productie checklist (`wp-config.php` — **niet committen**):

```php
// Optioneel alleen voor lokale Lead Finder:
// define( 'ASE_LICENSE_API_BASE', 'http://127.0.0.1:3000' );

// FORCE_VALID moet UIT voor echte checks:
// define( 'ASE_LICENSE_FORCE_VALID', true );  // NIET in productie
```

- Geen `ASE_LICENSE_FORCE_VALID` (of `false`)
- Geen override van `ASE_LICENSE_API_BASE` tenzij je bewust naar staging wijst
- Plugin ≥ 0.38 met License UI in Settings
