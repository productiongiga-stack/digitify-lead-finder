# Ads Editor acceptatie-audit

Deze audit sluit Phase 10 af. De lokale testomgeving voert geen echte Meta- of Google-writes uit en gebruikt geen betaalde mediageneratie.

| Scenario | Lokaal gecontroleerd | Externe actie |
|---|---|---|
| A — Meta-campagne | Briefing, Meta-strategie, bounded adsets/copy, lokale draft, readiness, approval-handoff, paused replacement-policy | Geblokkeerd zonder expliciete connector- en publicatietoestemming |
| B — Google Search | Search-plan, maximaal drie ad groups, RSA-limieten, keywordbronlabels, negatieve keywords, lokale draft en approval-handoff | Geblokkeerd zonder expliciete Google-publicatie |
| C — Google Performance Max | PMax-plan, assetrollen, tekstlimieten, ontbrekende asset/account-blockers en alleen-lezen velden | Geblokkeerd zonder expliciete Google-publicatie |
| D — Meta én Google | Gedeelde briefing, onafhankelijke readiness, aparte draftstatus en centrale review voor `BOTH` | Beide writes geblokkeerd |

## Bewijs

- API Ads- en Wizardtests: alle relevante suites groen; de volledige API-suite telt 475 geslaagde tests.
- Webtests: 48 geslaagd.
- Typecheck, lint op gewijzigde Ads-code, `git diff --check` en production build geslaagd.
- `/api/health` smoke-test geslaagd.
- Responsive Ads E2E-test is toegevoegd voor Meta en Google op mobiel en desktop. Deze test wordt overgeslagen wanneer geen Playwright-testaccount is geconfigureerd.

## Nog nodig vóór echte productiepublicatie

1. Testaccounts voor de responsive en approval E2E-tests instellen.
2. Meta- en Google-testconnectors koppelen in een aparte previewomgeving.
3. Scenario A–D opnieuw uitvoeren met provider-readonly sync.
4. Een expliciete approval geven en één gepauzeerde testwrite controleren.
5. Reconcile en externe conflictcontrole uitvoeren.

Tot die tijd blijven alle concepten, voorstellen en changesets lokaal en reviewbaar. De applicatie publiceert niets automatisch.
