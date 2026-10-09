# Ads Editor security audit — Phase 10

Deze audit geldt voor Meta Ads, Google Ads, de gedeelde Ads Wizard en de lokale optimalisatieflow. Phase 10 voert geen externe provideractie uit.

| Controle | Implementatie | Status |
|---|---|---|
| Tenant-scope | `createdById`/workspace-context op versies, changesets, runs, jobs en operations | Geslaagd |
| AI-output | Zod-schema, toegestane patchpaden, snapshot-validatie en payloadlimieten | Geslaagd |
| Providerwrites | Alleen via approval → publish; viewing-as en ontbrekende rechten blokkeren | Geslaagd |
| Onzekere writes | `RECONCILE_REQUIRED`, bewaarde resource-ID's en geen blinde retry | Geslaagd |
| Secrets | Providerfouten worden gemaskeerd; tokens zitten niet in browser- of evidencepayloads | Geslaagd |
| Dubbele acties | Wizard idempotency, publish-locks en AI-run key | Geslaagd |
| Externe wijziging | Fingerprint/hashcontrole markeert `CONFLICT` vóór publicatie | Geslaagd |
| PMax-beperkingen | Niet-ondersteunde targeting en velden blijven server-side geblokkeerd | Geslaagd |
| Metrics | Prestatie-KPI's worden alleen berekend uit aanwezige gesynchroniseerde waarden | Geslaagd |

## Bekende operationele voorwaarden

- Google- en Meta-OAuth, accountselectie en providerrechten moeten afzonderlijk geconfigureerd zijn.
- AI-optimalisatie vereist een geactiveerde workspace-provider; zonder provider blijft de bestaande lokale editor bruikbaar.
- Productionele publicatie vereist een expliciete approval en controle van de actuele externe versie.
- E2E-authentieke tests worden alleen uitgevoerd wanneer `PLAYWRIGHT_LOGIN_PASSWORD` of `SEED_ADMIN_PASSWORD` is ingesteld.

## Hercontrole voor deployment

1. `pnpm typecheck`
2. `pnpm test`
3. `pnpm --filter @digitify/web test:e2e:smoke`
4. `pnpm build`
5. Vercel-preview openen en `/meta-ads` plus `/google-ads` zonder providerwrite controleren.
