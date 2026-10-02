# Advertentiebeheer en AI-optimalisatie

Status: lokaal geïmplementeerde workflowbasis, 2026-10-02. Niet live uitgerold en niet met echte advertentieaccounts gevalideerd. Dit document onderscheidt werkende code van resterende productuitbreidingen.

## Gebruik

Open `/google-ads` of `/meta-ads`, tab **Editor & AI**. Koppel eerst het account via Integraties en schakel de bestaande technische advertentiemodule in. Synchroniseer campagnes of importeer een numerieke campagne-ID. Ontbrekende credentials leiden tot een foutmelding, niet tot demonstratiecampagnes.

1. De synchronisatie bewaart een volledige campagne-snapshot in `AdVersion`.
2. De editor bewaart uitsluitend gewijzigde velden als `AdChangeSet`, inclusief volledige voor/na-snapshots en validatieresultaat.
3. OWNER/ADMIN keurt de specifieke inhoudshash goed of weigert die.
4. Publiceren is een afzonderlijke OWNER/ADMIN-actie. De server leest eerst de externe campagne opnieuw: een gewijzigd account of andere inhoud geeft een conflict.
5. Een externe actie wordt geregistreerd in `AdSyncOperation`. Een unieke campagne-lock verhindert gelijktijdige publicaties. Succesvolle operaties worden niet opnieuw uitgevoerd.
6. Een fout na het beginnen van een externe write krijgt `RECONCILE_REQUIRED`. Controleer de werkelijke providerstatus en gebruik pas daarna de expliciete herstelknop. Die legt een nieuwe snapshot vast en geeft de lock vrij; ze herhaalt de write niet.

De technische module-ID’s en commerciële bundel-entitlements zijn niet veranderd. Workspacefilters én PostgreSQL RLS schermen alle zes nieuwe tabellen af. Impersonatie/view-as mag niet publiceren, goedkeuren, synchroniseren of providerinstellingen veranderen.

## Providerondersteuning

Google Search: bestaande advertentiegroepen en RSA’s selecteren via **Groepen ophalen**; zonder expliciete keuze wordt de eerste groep/RSA geïmporteerd. Iedere keuze krijgt een eigen snapshot. Campagnenaam, dagbudget, volledige headline-/descriptionlijsten, paden, URL, keywords/negatives, locaties/talen, netwerkopties en tracking zijn bewerkbaar. De SDK leidt field masks af van uitsluitend gewijzigde resourcevelden. RSA-content wordt op de gekozen `Ad` bijgewerkt, niet als geneste `AdGroupAd`-update. Groep en advertentie worden server-side aan de geselecteerde campagne getoetst; andere groepen worden niet overschreven.

RSA-snapshots bevatten ook de oorspronkelijke asset-pins en volledige final-URL-lijst; niet-gewijzigde pins en bijkomende URLs blijven behouden. Meta vervangende advertenties nemen bestaande tracking_specs mee.

Performance Max: bestaande assetgroepen selecteren, teksten, URL, groepsnaam, budget en tracking. Tekstassets zijn immutable: nieuwe assets en koppelingen plus verwijdering van oude tekstkoppelingen worden in één bulkrequest aangeboden. Nieuwe afbeeldingen worden toegevoegd, bestaande afbeeldingen worden behouden. Video, biedstrategie, conversiedoelen en PMax-targeting zijn in deze editor alleen-lezen. Het aanmaken van groepen en verwijderen/vervangen van beelden zijn nog geen afgeronde functies. De server weigert niet-ondersteunde PMax-patches. Oudere snapshots zonder groepselectie moeten opnieuw worden geïmporteerd als publicatie een fingerprintconflict geeft.

Meta: campagne/adset/ad-naam, bestaande budgetvelden, adset-targeting, biedbedrag en planning. Normale link-/video-creatives hebben formuliervelden; bijzondere formats behouden een geavanceerde JSON-editor. Bij gewijzigde creative worden een nieuwe creative en een **nieuwe gepauzeerde advertentie** gemaakt. De oude advertentie en creative blijven intact. Hun ID’s staan in het operatiejournaal. Daarna kan de OWNER/ADMIN een afzonderlijk overstapvoorstel voorbereiden: actuele snapshot, dezelfde adset, vervanger nog PAUSED, oude advertentie pauzeren en nieuwe activeren. Dit vereist opnieuw hash-bound approval en publicatie. Alle oude advertenties worden eerst gepauzeerd, voordat één vervanger wordt geactiveerd. Providerrequests zijn niet transactioneel; een gedeeltelijke overstap vraagt expliciete reconciliatie. Campaign/adset-direct updates veranderen de activatiestatus niet.

Providerbeleid blijft een externe controle. Lokale Zod-validatie is geen garantie op goedkeuring door Google of Meta. Geen van de lokale tests publiceert echte advertenties.

## AI en planning

AI gebruikt de bestaande workspace-AI-provider via `OpenClawClient`, met een requesttimeout van 45 seconden. `AiOptimizationRun` bewaart analyseperiode, input, model, promptversie, resultaat en fouten. De huidige analyseperiode is 30 dagen. Inputrecords worden als volledige JSON begrensd, niet halfweg afgekapt. Advertentiedata wordt expliciet als onbetrouwbare data behandeld. Gestructureerde output wordt streng gevalideerd; onbekende snapshot-ID’s en verboden patches worden geweigerd.

AI schrijft nooit rechtstreeks naar Google/Meta. Alle geldige aanbevelingen worden pending voorstellen. Maximaal 20% budgetwijziging per AI-voorstel, instelbaar naar beneden; bestaande providerbudgetlimieten gelden ook bij publicatie. Dit is een per-voorstelgrens, geen cumulatieve daglimiet.

`GET /api/cron/ads-optimize` vereist `Authorization: Bearer <CRON_SECRET>`. De Vercel-planning staat elk uur op minuut 15. De route bewaart afzonderlijke `AdBackgroundJob`-taken voor synchronisatie inclusief prestaties, providercontrole, AI-analyse, goedkeuringsherinneringen en herstel van verlopen publicatieclaims. Unieke workspace/provider/periode-keys voorkomen dubbele planning. AI is afhankelijk van een geslaagde synchronisatie. De providercontrole bevestigt alleen accountconfiguratie en leesbereik; ze bewijst geen publicatierechten en vernieuwt geen tokens.

Taken worden atomisch geclaimd met een lease. Veilige lees-/onderhoudstaken kunnen na onderbreking hervatten, tijdelijke fouten krijgen maximaal drie pogingen met uitgestelde backoff. Een onderbroken AI-taak wordt `NEEDS_REVIEW` en wordt nooit blind herhaald; dezelfde opgeslagen AI-run kan al voorstellen bevatten. Onzekere providerwrites blijven expliciete reconciliatie vereisen. Onder **Automatisering** staan taakstatussen en een beheeractie om uitsluitend mislukte niet-AI-taken opnieuw in te plannen. Dagelijkse analyse staat standaard **uit** en is lokaal niet automatisch actief: daarvoor is een lokale scheduler nodig. Er is niets naar Vercel gedeployed.

Begrenzingen: maximaal 20 ondersteunde campagnes per sync en 10 recente campagneonderdelen per AI-run, maximaal circa 110 KB input en 240 seconden cronlooptijd. Grote accounts vereisen nog cursorpaginatie en een worker die eerlijk over alle workspaces verdeelt; de opgeslagen queue op zichzelf heft deze limieten niet op. Niet-bewerkbare Google-campagnetypes worden bij sync overgeslagen. Binnen providerreads krijgen tijdelijke fouten maximaal drie pogingen met 500/1500 ms backoff. Queue-retries zijn aanvullend begrensd; rechten-/credentialfouten worden niet automatisch herhaald.

## Configuratie en validatie vóór livegebruik

- Google: OAuth, refresh token, developer token, klantaccount en eventueel manager-ID. Meta: app-configuratie, token, advertentieaccount, vereiste marketingpermissions en business-/page-toegang.
- AI: bestaande providerkey en model per workspace. Tokens blijven in de bestaande beveiligde settingslaag; nieuwe workflowtabellen bewaren geen OAuth-tokenvelden.
- Pas de vier nieuwe Prisma-migraties toe op het bedoelde doelaccount. Deze sessie heeft ze uitsluitend op de bestaande lokale PostgreSQL-database toegepast, zonder reset van gegevens. Herstart de lokale devserver na Prisma-generatie zodat hij het nieuwe model gebruikt.
- Verifieer met echte testaccounts de permissions, RSA field masks, PMax-minimumassets, Meta replacement en gedeeltelijke fouten. Live credential-/scope-/tokenrefreshgedrag is niet lokaal bewezen.
- Test gelijktijdige externe edits, tokenverloop, rate limits en beleidsafwijzing. Publiceer gepauzeerd en controleer in het providerdashboard.

## Resterend werk ten opzichte van het volledige productplan

- Nieuwe Google-groepen aanmaken, complete PMax-media lifecycle en alle bied-/conversie-/planningsvelden die de provider ondersteunt.
- End-to-end providerverificatie van Meta-activatie-overstap en gedeeltelijke fouten met een echt gekoppeld testaccount.
- Cursorpaginatie, queue-retentie, fijnmazige rate-limit handling, afzonderlijke prestatie-import en echte scope-/tokencontroles. De duurzame jobs gebruiken nog de begrensde cron als uitvoerder.
- Bestaande handmatige pause/resume-acties zijn OWNER/ADMIN-beveiligd maar lopen nog niet door het nieuwe changeset-model. Bestaande draft-publicatie behoudt haar eigen goedkeuringsflow en heeft een atomische claim/uncertain-write blokkering gekregen.
- Complete veiligheidsaudit buiten de advertentielaag, webhook-integriteit en tests van ontbrekende scopes/verlopen echte credentials. De huidige controles zijn geen volledige certificering van de hele app.
- De oude studio’s zijn opgesplitst in orchestration en componentfiles; fijnere server-rendered campagne-/performancecomponenten blijven vervolgwerk. De oude ingelogde dashboards zijn niet herschreven.

## Tests en bestanden

Lokale verificatie op 2026-10-02: TypeScript-check zonder fouten; complete monorepo-tests geslaagd; API 387 tests geslaagd (19 integratie-/omgevingschecks standaard overgeslagen), web 44 tests geslaagd. De drie PostgreSQL Ads-isolatietests zijn afzonderlijk echt uitgevoerd en geslaagd. Relevante Ads-lintchecks hebben geen warnings; algemene app-lint heeft bestaande warnings buiten deze wijziging. Production-builds zijn geslaagd; bestaande Redis/Edge-runtime- en Browserslist-waarschuwingen blijven open. De cronroute geeft zonder autorisatie HTTP 401.

Browser: Google Editor & AI en Automatisering visueel op desktop en mobiel gecontroleerd, zonder horizontale pagina-overflow. De lokale devserver is na Prisma-generatie herstart; het takenoverzicht laadt daarna zonder runtimefout. Meta Editor & AI en Automatisering gecontroleerd, met dagelijkse analyse uit. Echte campagnekeuzes, providercreatie, policies en AI-optimalisatie zijn niet uitgevoerd bij ontbrekende credentials; Google-selectie en gerichte writes zijn met SDK-mocks getest.

De schijf blijft bijna vol. Uitsluitend de opnieuw genereerbare `apps/web/.next/cache` werd opgeruimd om de build te kunnen controleren; geen uploads, bronbestanden of databasegegevens verwijderd.

`ads-workflow.test.ts`: whitelist, volledige snapshots, budgetguardrails, hash-bound approval, workspacefilters, conflicten, herhaalde publicatie, onzekere writes.

`ads-workflow-providers.test.ts`: Google changedPaths, Meta direct update/replacement, budgetpreflight, accountownership en partial journal. Providerwrites zijn mocks.

`ads-workflow-read.test.ts`: transient backoff, maximaal drie pogingen en geen retry op ontbrekende rechten. Meta-switch-tests controleren een afzonderlijk goedkeuringsvoorstel en pauzering vóór activering.

`ads-workflow.integration.test.ts`: echte PostgreSQL RLS-checks op alle zes tabellen; records worden met een rollback verwijderd. Draai met `RUN_DB_INTEGRATION=1` en lokale env.

`google-editor-selection.test.ts`: veilige selectie, campagnebinding, meerdere snapshots en gerichte RSA-update met behoud van pins/URLs. `ads-background-jobs.test.ts`: deduplicatie, afhankelijkheden, claims, leases, retries, opt-in en geen blinde AI-herhaling.

Implementatie: `packages/api/src/lib/ads-workflow*.ts`, `packages/api/src/routers/ads-workflow.procedures.ts`, `apps/web/src/components/ads/`, `apps/web/src/app/api/cron/ads-optimize/route.ts`.

Providerreferenties: [Google RSA](https://developers.google.com/google-ads/api/docs/ads/create-responsive-search-ads), [Google PMax assetgroepen](https://developers.google.com/google-ads/api/performance-max/asset-groups), [Meta AdCreative](https://developers.facebook.com/docs/marketing-api/reference/ad-creative/). Meta-documentatie kon tijdens de laatste openbare controle niet worden opgehaald; actuele permissies/velden moeten met het gekoppelde account worden bevestigd.
