# Ads Editor release checklist

## Voor preview

- [ ] Database-migraties zijn lokaal toegepast en er zijn geen productiegegevens gewijzigd.
- [ ] `pnpm typecheck`, `pnpm test`, web-lint en `pnpm build` zijn groen.
- [ ] `pnpm --filter @digitify/web test:e2e:smoke` is groen met testaccounts.
- [ ] Meta- en Google-connectors staan in testconfiguratie; echte publicatie blijft uit.
- [ ] `BOTH`-briefing, afzonderlijke readiness, approval en reconcile zijn gecontroleerd.

## Preview smoke-test

- [ ] `/meta-ads` laadt op desktop en mobiel.
- [ ] `/google-ads` laadt op desktop en mobiel.
- [ ] Nieuwe campagne kan lokaal worden hervat na refresh.
- [ ] Bestaande campagne importeert een actuele versie vóór een voorstel.
- [ ] AI-optimalisatie maakt alleen een `AdChangeSet` en geen provider-write.
- [ ] Conflicten en onzekere publicaties tonen controle/reconcile in plaats van blind opnieuw publiceren.

## Productie

- [ ] Preview-commit is exact de commit die wordt gepromoveerd.
- [ ] Database-backup en migratieherstelpunt bestaan.
- [ ] `/api/health` rapporteert database `ok` en Redis `ok` of `skipped` volgens configuratie.
- [ ] Productiepublicatie gebeurt pas na afzonderlijke goedkeuring.
