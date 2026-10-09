# Ads Editor & AI — Phase 0 audit

Status: lokale audit, 2026-10-09. Deze audit beschrijft de bestaande advertentielaag vóór de gedeelde wizardbasis. Creative Studio valt buiten scope.

## Bestaande, herbruikbare basis

| Onderdeel | Huidige status | Hergebruik in Phase 1 |
| --- | --- | --- |
| Meta Ads | Draft, approval, gepauzeerde push, replacement-flow en insights aanwezig | Bestaande draftadapter en approval behouden |
| Google Search | Draft, RSA-validatie, approval en gepauzeerde create-flow aanwezig | Bestaande Search-planstructuur behouden |
| Google Performance Max | Tekst- en assetgroepcreate aanwezig; meerdere velden blijven alleen-lezen | Readiness toont beperkingen expliciet |
| Editor & AI | `AdVersion`, `AdChangeSet`, approval, conflictcontrole, reconcile en achtergrondjobs aanwezig | Bestaande campagne-editor blijft de edit-flow |
| Copilot | Accountdata, optionele webresearch, profielhash, evidence en retrybare runs aanwezig | Nieuwe campagnes krijgen in Phase 1 alleen een bewaarbare briefing |
| Tenantbeveiliging | Owner-scoped legacy addata, RLS en viewing-as blokkades aanwezig | Nieuwe wizard gebruikt dezelfde owner-scope en RLS |
| Credits/media | Centrale media- en creditslaag bestaat in Creative Studio | Niet aangeraakt in Phase 1 |

## Vastgestelde gaten en risico's

- De bestaande Copilot verwacht een bestaande `AdVersion`; hij kan nog geen nieuw campagneproject zonder live campagne dragen.
- Meta en Google hebben afzonderlijke draft-wizards zonder gedeelde, hervatbare briefingstatus.
- Dubbele klikken op de twee bestaande draftformulieren hebben geen gedeelde wizard-idempotencylaag.
- De Editor & AI-tab concurreert met aparte tabs voor campagnes, wizard, drafts en approvals.
- PMax ondersteunt niet alle bied-, conversie-, targeting- en videovelden; dit mag niet als volledig worden voorgesteld.
- Sommige placeholders en presets zijn op België/KMO gericht. Deze blijven voorbeelden en mogen nooit in een AI-prompt of opgeslagen campagnecontext belanden.

## Capabilitymatrix

| Capability | Meta | Google Search | Google PMax | Phase 1 |
| --- | --- | --- | --- | --- |
| Briefing opslaan | ja, via nieuwe shared wizard | ja, via nieuwe shared wizard | ja, via nieuwe shared wizard | lokaal |
| Bestaande campagne importeren | ja | ja | gedeeltelijk | bestaande flow |
| AI-strategie | bestaande suggesties/Copilot | bestaande suggesties/Copilot | beperkt | Phase 2 |
| Copy/targeting aanpassen | via bestaande draft/change-set | via bestaande draft/change-set | beperkt | behouden |
| Externe create | gepauzeerd ondersteund | gepauzeerd ondersteund | alleen gevalideerde subset | uitgeschakeld |
| Activeren | expliciete approval/publicatie | expliciete approval/publicatie | expliciete approval/publicatie | uitgeschakeld |
| MuAPI-media | bestaande Creative Studio-koppeling | bestaande Creative Studio-koppeling | bestaande assetflow | uitgeschakeld |

## Arcads research

`krusemediallc/arcads-claude-code` is lokaal gekloond onder `../digitify-research/arcads-claude-code` voor documentatieonderzoek. De repository gebruikt de MIT-licentie. Relevante ideeën zijn:

- werken met een duidelijke briefing vóór creatieve generatie;
- keuze tussen tekstzware en fotorealistische creatieve templates;
- expliciete aspectratio- en referentiegebruikregels;
- kosten tonen vóór betaalde generatie;
- aparte handoff tussen creatieve generatie en Meta-publicatie;
- safety-suffixes voor safe zones en het vermijden van platformchrome.

Deze repository wordt niet als runtime-afhankelijkheid gebruikt. Externe scripts zijn niet uitgevoerd, commerciële community-instructies worden niet overgenomen en Creative Studio wordt niet gewijzigd.

## Baseline

- Gerichte API-advertentietests: 50 geslaagde tests.
- Webtests: 48 geslaagde tests.
- Typecheck: geslaagd.
- Web-lint: 0 fouten; bestaande waarschuwingen buiten deze wijziging blijven geregistreerd.
- Geen echte providerwrites, betaalde media-generatie of deployment uitgevoerd.

## Phase 1 resultaat

- `AdsWizardProject` is toegevoegd met `DRAFT`, `READY` en `ARCHIVED`, actieve stap, briefing/plannen als JSON, geselecteerde assets, readiness, revision en idempotency key.
- `adsWizard.list`, `get`, `create`, `save`, `archive` en `resume` controleren de actieve owner-scope. Opslaan gebruikt een atomische revision-check; een verouderd tabblad krijgt een conflictmelding.
- De gedeelde wizard staat in de bestaande Editor & AI-panelen van Meta Ads en Google Ads. De wizard slaat alleen lokale concepten op en geeft duidelijk aan dat AI-strategie en providerpublicatie Phase 2 zijn.
- De lokale migratie `20261009120000_ads_wizard_projects` is toegepast. Gerichte Ads-tests staan op 57 geslaagde tests; webtests blijven op 48 geslaagde tests. Build, typecheck en diff-controle zijn groen; lint heeft 0 fouten en uitsluitend bestaande waarschuwingen.

## Phase 2-start

- De controle-stap kan een evidencegebonden strategievoorstel genereren met de bestaande centrale AI-provider. De strategie blijft in `metaPlan`/`googlePlan` als bewerkbaar concept staan, inclusief profielhash, profielversie, model, confidence en onbekende data.
- De strategie-output bevat geen directe Meta-/Google-providerpayload en de mutation heeft geen providerwrite. Ontbrekende AI-configuratie wordt geblokkeerd met een actiegerichte foutmelding.

## Phase 2 vervolg

- Meta-invalshoeken, doelgroepen en calls-to-action en Google-keywordthema’s, advertentiegroepen en uitsluitingsthema’s kunnen in de wizard per regel worden aangepast en worden samen met het concept opgeslagen.
- `adsWizard.generateCampaignProposal` gebruikt een opgeslagen strategie en een geïmporteerde `AdVersion` om een provider-gevalideerde `AdChangeSet` met bron `AI` aan te maken. De bestaande before/after-diff, approval, conflictcontrole en reconcile-flow blijven de enige routes voor publicatie.
- De voorstelbewerking gebruikt een revision-claim, zodat dubbele klikken geen tweede AI-run voor hetzelfde concept tegelijk starten. Bij fouten wordt de voorstelstatus bewaard als `FAILED` of `BLOCKED` voor retry.

## Phase 2 vervolg: native drafts

`adsWizard.createNativeDraft` materialiseert de opgeslagen platformspecifieke strategie in de bestaande lokale Meta- en Google-draftmodellen. De wizard- en profielherkomst wordt als metadata opgeslagen, zodat de provider-editors de draft kunnen vervolledigen. Budget, advertentieaccount en ontbrekende creatives blijven zichtbaar als actie vereist. De transactie gebruikt de wizardrevision als optimistic lock en maakt bij retries geen tweede draft. Deze fase voert geen providerwrite uit.

Dezelfde drafts kunnen nu via `adsWizard.generateDraftContent` van gevalideerde Meta- of Google-copy worden voorzien. De AI-output blijft beperkt tot advertentietekst, wordt aan providerlengtes getoetst en krijgt een confidence- en evidencevermelding. Budget, assets, accountselectie en publicatie blijven handmatige, approval-gebonden stappen.

`adsWizard.reviewNativeDraft` voert daarna een deterministische readiness-controle uit en toont score, blokkades en waarschuwingen vóór approval. De controle raakt geen provideraccount en kan veilig opnieuw worden uitgevoerd.

Na controle verwijst de wizard met een bestaande `planId`-deeplink rechtstreeks naar de juiste provider-editor. De huidige draft-, approval- en publicatielogica blijft daarmee de enige uitvoeringsflow.

## Phase 2 approval-handoff

De gedeelde wizard kan na een deterministische draftcontrole een lokale Meta- of Google-draft indienen ter goedkeuring. De route weigert `BLOCKED`-reviews, vraagt bevestiging voor waarschuwingen en detecteert wijzigingen sinds de laatste review. De status wordt atomisch op het wizardproject en de lokale draft gezet; provider-approval, publicatie, conflictcontrole en reconcile blijven ongewijzigd en er wordt geen externe providerwrite uitgevoerd.

## Phase 2 provider-status handoff

Na terugkeer uit de Meta- of Google-editor kan de wizard de lokale draftstatus opnieuw ophalen. `adsWizard.syncNativeDraftStatus` spiegelt approval- en publicatiestatus met owner-scope en optimistic locking. Dit is een read-only synchronisatie van lokale records; providerwrites blijven uitsluitend in de bestaande goedkeurings- en publicatieprocedures.

## Phase 3 Meta Campaign Generator

De Meta-draftgenerator maakt nu een platformspecifiek lokaal plan met één tot drie adsets en één tot vijf gecontroleerde creatieve varianten. Doelgroepen en copy komen uit de workspacebriefing, strategie en AI-output; pixels, account-ID’s, budgetten en assets blijven leeg of behouden bestaande waarden. De plancontrole blijft deterministisch en publicatie gebruikt uitsluitend de bestaande approval- en paused-replacement-flow.
