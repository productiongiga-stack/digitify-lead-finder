# AI CHANGELOG — Digitify Lead Search

Chronologisch logboek van significante wijzigingen (mens + AI).  
**Formaat:** nieuwste entries bovenaan.

## 2026-09-12 — Fase 36: Vercel-opslagcontrole

**Type:** Operations, storage, deployment hygiene
**Agent:** Codex

**Read-only bevindingen:**
- `digitify-blob` gebruikt ongeveer `961 MB / 1 GB` en is gekoppeld aan Lead Finder; de zichtbare mappen zijn `test/` en `workspaces/`.
- `digitify-shop-assets` gebruikt ongeveer `127 MB / 1 GB` en is gekoppeld aan de webshop; de zichtbare map is `assets/`.
- `digitify-lead-finder` is een lege, niet-gekoppelde Blob-store van `0 MB`; dit is een kandidaat voor verwijdering na expliciete bevestiging.
- Beide actieve stores staan als publiek en `Not Protected` gemarkeerd. Dit is niet automatisch gewijzigd omdat de applicatie publieke Blob-URL's gebruikt voor uploads en storefront-assets; eerst moet per pad worden vastgesteld welke bestanden publiek mogen blijven.
- De Functions Storage-meting stond op ongeveer `8.59 GB / 10 GB`. De deploymentinventaris bevatte veel oude READY-deployments en één BLOCKED-deployment.

**Verificatie:** Negen oude/preview- of geblokkeerde Lead Finder-deployments zijn verwijderd; actieve productie-deployments bleven behouden. Vercel Usage en Storage zijn opnieuw bekeken, Blob-mappen gecontroleerd en productiecode voor Blob-paden en publieke toegang nagelezen. De lege store `digitify-lead-finder` is niet verwijderd omdat de beschikbare CLI geen Blob-token had en de dashboardactie niet beschikbaar was. Lead Finder health blijft `200` met database `ok`; de webshop blijft bereikbaar met de bestaande CDN-samplewaarschuwing.

## 2026-09-12 — Fase 35: GitHub, Vercel en Supabase-keten bevestigd

**Type:** Integratie, deploymentcontrole, observability
**Agent:** Codex

**Wijziging:**
- GitHub-repository `productiongiga-stack/digitify-lead-finder` is bevestigd als bron voor Vercel-project `project-ubm6y` en `leads.digitify.be`.
- GitHub-repository `productiongiga-stack/digitify-3d-webshop` is bevestigd als bron voor Vercel-project `digitify-3d-webshop` en `shop.digitify.be`.
- De twee productie-apps gebruiken elk hun bestaande gezonde Supabase-project; er zijn geen nieuwe credentials, migrations of deployments aangemaakt.
- Repository-zichtbaarheid blijft voorlopig ongewijzigd op publiek, zoals gevraagd.

**Verificatie:** Vercel-projectlinks, productie-deployments en Supabase-projectstatussen gecontroleerd. `https://leads.digitify.be/api/health` geeft `200` met database `ok`; de webshop geeft `200` maar status `degraded` door een ontbrekende voorbeeld-3D/CDN-check. Database, storage, Stripe en SMTP van de webshop zijn bereikbaar. Geen commit, push of secretwijziging uitgevoerd.

## 2026-09-12 — Fase 34: security-audit, schemaherstel en foutafscherming

**Type:** Security, productieherstel, releasebetrouwbaarheid
**Agent:** Codex

**Wijziging:**
- Ontbrekende productievelden voor domeinanalyse (`analysisData`, `trackerData`, `lastAnalyzedAt`, `lastTrackerAt`, `healthScore`) idempotent toegevoegd met bestaande indexen.
- Interne tRPC- en health-fouten geven geen Prisma-, databasehost- of stackdetails meer terug aan de browser.
- Een releasecheck voor het domeinschema toegevoegd.
- Cloudflare, Vercel en beide Supabase-projecten read-only gecontroleerd; publieke Supabase-tabelrechten blijven ingetrokken.

**Verificatie:** productie-Supabase-kolommen en indexen bevestigd, RLS-smoke geslaagd, integratietests `13/13`, volledige tests `294 geslaagd / 16 overgeslagen` en webtests `42/42`, typecheck geslaagd, productie-build/deploy `dpl_S68Bb7aKUJRKojDe8pj2zVwzodaP` gereed. Cloudflare schrijfactie geblokkeerd door API-authenticatie; Redis/Upstash ontbreekt nog in productie.

## 2026-09-12 — Fase 33: platformbeheer voor aangewezen owners

**Type:** Accounts, autorisatie, security
**Agent:** Codex

**Wijziging:**
- Platformbrede accountweergave en beheer toegevoegd voor een expliciete `PLATFORM_OWNER_EMAILS`-allowlist.
- Aangewezen owners kunnen veilige accountvelden, globale rol en moduletoegang beheren; wachtwoordhashes, tokens en integratiesleutels worden nooit teruggegeven.
- Platformacties schrijven security-audit-events en eigen moduletoegang kan niet worden uitgeschakeld.
- Team & Rollen toont de platformscope duidelijk in de UI.

**Verificatie:** gerichte API-tests `12/12`, typecheck en lint geslaagd. Productiedeploy `dpl_6bsYQR7uXRJuHw9qLrnJQoAM9VsZ` staat op `READY`; `https://leads.digitify.be/` en `/api/health` geven `200`. Geen commit of push uitgevoerd.

## 2026-09-12 — Fase 24: releasecheck en MuAPI-kostencatalogus

**Type:** Releasebetrouwbaarheid, onderhoud
**Agent:** Codex

**Wijziging:**
- `packages/media-studio/src/model-costs.ts` bijgewerkt via de bestaande MuAPI-catalogussynchronisatie naar 682 endpoints.
- De releasecheck bouwt met een expliciete Node-heaplimiet van 4 GB, zodat de grote monorepo-production build niet op de standaard heaplimiet faalt.

**Verificatie:** model-cost sync groen, Prisma Client gegenereerd, geen openstaande migraties, API-tests `292/292`, webtests `40/40`, typecheck, lint met bestaande waarschuwingen en production build geslaagd. Geen betaalde media-aanroepen uitgevoerd.

## 2026-09-12 — Fase 25: responsive marketing hero-regressiecontrole

**Type:** Frontend, responsive UX, browserregressie
**Agent:** Codex

**Wijziging:**
- Hero-iconen gebruiken nu expliciete responsive maten: kleiner op mobiel/tablet en groter op desktop.
- Een Playwright-regressietest controleert de homepage op 375px, 768px en desktop op overlap en horizontale overflow.

**Verificatie:** production build geslaagd en de nieuwe Playwright-test geslaagd met `3/3`. De lokale productieapp blijft bereikbaar op `http://localhost:3000`.

## 2026-09-12 — Fase 26: volledige lokale browserregressie

**Type:** E2E, releasecontrole
**Agent:** Codex

**Verificatie:** production Playwright-suite tegen `http://localhost:3000` afgerond met `8 passed / 24 skipped`. Health, publieke embeds, portal-uploadbeveiliging, onbekende formulier-404 en marketing responsive checks slagen. Geauthenticeerde suites zijn overgeslagen omdat geen expliciete Playwright-credentials zijn ingesteld; er zijn geen credentials geraden of gelogd.

## 2026-09-12 — Fase 27: RLS-tenantisolatie opnieuw gecontroleerd

**Type:** Security, PostgreSQL RLS
**Agent:** Codex

**Verificatie:** `ENABLE_WORKSPACE_RLS=true pnpm rls:smoke` geslaagd. Owner A zag 121 eigen leads, Owner B 2 eigen leads; beide cross-workspace lead-ID’s waren niet leesbaar. De browsercheck met expliciete loginaccounts blijft geblokkeerd zolang geen lokale Playwright-credentials zijn ingesteld.

## 2026-09-12 — Fase 28: database security-integratiesuite

**Type:** Security, integratieverificatie
**Agent:** Codex

**Verificatie:** `RUN_DB_INTEGRATION=1 ENABLE_WORKSPACE_RLS=true pnpm test:integration` geslaagd met `13/13` tests in workspace-RLS, IDOR en settings-RBAC. Geen externe providers of echte verzendingen gebruikt.

## 2026-09-12 — Fase 29: Redis-infrastructuurcontrole

**Type:** Infrastructuur, rate limiting
**Agent:** Codex

**Verificatie:** De Redis-integratietest is uitgevoerd via de lokale env-helper maar bleef correct op `1 skipped`, omdat `localhost:6379` niet bereikbaar is. Docker en `redis-server` zijn niet actief/beschikbaar op deze machine. De applicatie blijft in de bestaande gecontroleerde degraded-mode functioneren; Redis-rate-limiting is lokaal nog niet bewezen.

## 2026-09-12 — Fase 30: Cloudflare-deploymentvoorbereiding

**Type:** Deploymentarchitectuur, security
**Agent:** Codex

**Wijziging:**
- Een Cloudflare-runbook toegevoegd met de aanbevolen proxy/WAF-route vóór de bestaande Vercel- of VPS-runtime.
- DNS-only uitzonderingen, tenantcachebeperkingen, secrets, webhookbeveiliging en een aparte Workers-compatibiliteitscheck vastgelegd.

**Verificatie:** Geen Cloudflare-account, DNS-zone, deployment of productiecredential aangeraakt. De lokale app blijft op `http://localhost:3000` draaien.

## 2026-09-12 — Fase 31: Cloudflare-origin hardening

**Type:** Security, proxy-integratie
**Agent:** Codex

**Wijziging:**
- Client-IP-resolutie gebruikt `CF-Connecting-IP` alleen met een aanwezige `CF-Ray`; directe originrequests vallen terug op de bestaande proxyheaders.
- Middleware en tRPC gebruiken nu dezelfde IP-resolutie.
- Auth- en tRPC-verkeer krijgt `private, no-store` om caching van sessie- of tenantdata door een proxy te voorkomen.
- Cloudflare-IPgedrag is vastgelegd met twee unit-tests.

**Verificatie:** nieuwe unit-tests `2/2`, typecheck en production build geslaagd; lokale health/homepage `200`; tRPC-response bevat `Cache-Control: private, no-store, max-age=0`. Geen live Cloudflare-account of DNS gewijzigd.

## 2026-09-12 — Fase 32: lokale testaccounts reset-helper

**Type:** Developer experience, lokale testveiligheid
**Agent:** Codex

**Wijziging:**
- `pnpm db:reset-local-accounts` toegevoegd voor lokale accounts met Owner, Viewer, Moderator en Member-rollen.
- De helper weigert productie- of niet-lokale databases, genereert tijdelijke wachtwoorden en schrijft ze uitsluitend naar `~/.config/digitify/local-credentials.txt` met modus `600`.

**Verificatie:** Seed wordt alleen tegen een lokale `DATABASE_URL` uitgevoerd. Wachtwoorden worden niet naar de terminal, repository of changelog geschreven.

## 2026-09-11 — Fase 17: publieke tenantafbakening en formulierconcurrentie

**Type:** Security, data-integriteit
**Agent:** Codex

**Wijziging:**
- De publieke reviewwidget vereist een geldige workspacegebonden tenanttoken, voegt die token toe aan nieuwe embedlinks en registreert feedback als activiteit van de juiste workspace-eigenaar.
- De publieke formulierendpoint rate-limitt per formulier in plaats van over alle formulieren op hetzelfde IP-adres en serializeert een gelijke inzending rond import plus opslag, zodat een tweede request zuiver een `409` krijgt zonder extra lead.

**Verificatie:** `pnpm typecheck`; publieke live providers zijn niet aangeroepen.

## 2026-09-11 — Fase 18: database-integratie voor publieke formulierflow

**Type:** Integratietests, concurrency
**Agent:** Codex

**Wijziging:**
- De geserialiseerde formulierbewerking staat nu in `packages/api/src/lib/public-form-submission.ts`, zodat route en databaseproef dezelfde implementatie gebruiken.
- Een PostgreSQL-concurrencytest controleert dat vijf gelijktijdige identieke publieke inzendingen precies één lead en één submission opleveren.

**Verificatie:** concurrencytest `6/6`, integratiesuite `13/13`, RLS-smoke geslaagd en lokale healthcheck geslaagd.

## 2026-09-11 — Fase 19: browserfoutstatus voor review-embed

**Type:** Browsercontrole, publieke UX
**Agent:** Codex

**Wijziging:**
- Een review-embed zonder workspace-token toont nu direct een foutstatus en laat geen sterreninteractie toe; de onveilige inzending wordt niet pas na klikken ontdekt.

**Verificatie:** lokale embed geopend in de in-app browser; ongekoppelde sterrenknoppen zijn disabled. Webtests `40/40`, typecheck, diffcontrole en healthcheck geslaagd.

## 2026-09-11 — Fase 20: responsive publieke embed-regressies

**Type:** Responsive browsertests
**Agent:** Codex

**Wijziging:**
- Playwright controleert de reviewwidget op 375px en 768px op foutstatus, disabled interactie en horizontale overflow.
- De onbekende publieke formulierroute is toegevoegd aan dezelfde veilige 404-regressiecontrole.

**Verificatie:** Playwright `3/3` geslaagd; publieke providers zijn niet aangeroepen.

## 2026-09-11 — Fase 21: releasecontrole

**Type:** Build, releasecheck
**Agent:** Codex

**Verificatie:** productie-build geslaagd (`1/1`), RLS- en integratietests uit fase 18 blijven groen, lokale healthcheck hersteld en responsive Playwright `3/3` geslaagd. De volledige Playwright-suite bleef na ongeveer drie minuten hangen zonder nieuwe output; de runner is beëindigd en staat als geblokkeerd genoteerd. Er zijn geen credentials of externe providers gebruikt.

## 2026-09-11 — Fase 22: Redis-healthprobe time-out

**Type:** Runtime, releasecontrole
**Agent:** Codex

**Wijziging:**
- De Redis-healthprobe heeft nu een connectie- en totale probe-timeout van drie seconden en ruimt de client altijd op.
- Een onbereikbare Redis maakt `/api/health` gecontroleerd `503 degraded` in plaats van de request en E2E-runner te laten hangen.

**Verificatie:** typecheck geslaagd, API-tests `292/292`, schone production-build geslaagd, onbereikbare Redis gaf `503` na ongeveer drie seconden, production public-embedtests `3/3` en lokale healthcheck daarna groen.

## 2026-09-11 — Fase 23: gescheiden Next.js buildartefacts

**Type:** Releasebetrouwbaarheid
**Agent:** Codex

**Wijziging:**
- Development gebruikt nu `.next-dev`; production build en `next start` blijven `.next` gebruiken.
- Hierdoor kan Turbopack tijdens lokaal ontwikkelen geen production `routes-manifest` meer overschrijven.

**Verificatie:** production build geslaagd, volledige production E2E-suite `5 passed / 21 skipped` zonder hang, lokale devserver en healthcheck daarna hersteld.

## 2026-09-11 — Testcredentials worden niet meer geraden

**Type:** Testveiligheid, developer experience
**Agent:** Codex

**Wijziging:**
- Geauthenticeerde Playwright-suites en database-loginhulpscripts bevatten geen ingebedde lokale wachtwoorden meer.
- Browsertests slaan met een duidelijke reden over wanneer de vereiste `PLAYWRIGHT_*`- of `SEED_*`-credentials ontbreken; CI levert die waarden expliciet aan.
- De Vercel-handleiding en README verwijzen alleen naar expliciet ingestelde seed- en testcredentials.

**Verificatie:** typecheck, syntaxchecks voor de databasehulpscripts, E2E-skip zonder credentials, leadsmoke met expliciete testcredentials, `git diff --check` en lokale healthcheck geslaagd.

## 2026-09-11 — Lokale run-helper hardent credentials en mutaties

**Type:** Operationele veiligheid, developer experience
**Agent:** Codex

**Wijziging:**
- `local-run.sh` gebruikt geen vast seedwachtwoord meer en schrijft nooit inloggegevens naar zijn logbestand.
- Migraties en seed zijn expliciete opt-ins (`RUN_MIGRATIONS=1`, `RUN_SEED=1`); seed vereist geldige, zelf aangeleverde credentials en fouten worden niet meer verborgen.
- De helper weigert productiemodus, gebruikt een logbestand met eigenaarrechten en wacht op de health-endpoint voordat hij slaagt.

**Verificatie:** shellsyntax, lokale start zonder datamutatie, loginspectie zonder credentialtekst, negatieve seedcheck, `git diff --check` en healthcheck geslaagd.

## 2026-09-11 — Productie-env krijgt een veilige preflight

**Type:** Releasebetrouwbaarheid, documentatie
**Agent:** Codex

**Wijziging:**
- `pnpm check:production-env` valideert een expliciet productie-envbestand op verplichte URLs, minimale secretlengtes, placeholderwaarden en verplichte workspace-RLS, zonder secrets te tonen of externe systemen te raken.
- De VPS-deploygids bevat nu alle runtimevereisten (`DIRECT_URL`, app-URL, encryptiesleutel, cron-secret en RLS) en maakt duidelijk dat seeden alleen voor een bewust lege eerste installatie is.
- De releasechecklist verwijst naar de nieuwe preflight vóór een database- of deploymentactie.

**Verificatie:** positieve en negatieve preflight, shellsyntax, package-JSON, `git diff --check` en lokale healthcheck geslaagd.

## 2026-09-11 — CI E2E draait met productievereisten

**Type:** Releasebetrouwbaarheid, CI
**Agent:** Codex

**Wijziging:**
- De Playwright-job krijgt nu dezelfde verplichte productievariabelen als een echte `next start`: encryptiesleutel, cron-secret en verplichte workspace-RLS.
- De CI-serverstart schrijft naar een logbestand en faalt expliciet met dat log wanneer `/login` niet binnen twee minuten bereikbaar is. Playwright kan daardoor niet meer tegen een stilgevallen server starten.

**Verificatie:** GitHub Actions YAML is geparseerd, de productiebuild is lokaal geslaagd, `git diff --check` is schoon en de lokale healthcheck is groen. Een duurzame lokale `next start`-sessie is in deze toolhost niet reproduceerbaar; de CI-job verifieert die start binnen dezelfde shell.

## 2026-09-11 — Lokale releasecheck en seed-autorisatie hersteld

**Type:** Betrouwbaarheid, testinfrastructuur, toegankelijkheid
**Agent:** Codex

**Wijziging:**
- Database-afhankelijke lokale commando's (`db:seed`, integratietests en RLS-smoke) laden nu alleen wanneer nodig de lokale databaseconfiguratie, zonder een expliciete CI- of productie-`DATABASE_URL` te overschrijven.
- De idempotente seed maakt nu persoonlijke werkruimten en actieve memberships voor alle lokale rolfixtures. Daarmee doorlopen Viewer, Moderator, Member en modulebeperkte accounts dezelfde actuele sessievalidatie als productiegebruikers.
- Klikbare rijen in de gedeelde datatabel zijn voortaan ook met `Enter` en spatie te openen; de leadlijst-smoketest verifieert die echte toetsenbordactie.
- De lokale RLS-smoke gebruikt de gedocumenteerde lokale owneridentiteit wanneer een seed-mail niet expliciet is ingesteld.

**Verificatie:** Prisma-clientgeneratie, 332 unit/API/webtests, 13 database-integratietests met RLS, RLS-smoke, lint zonder fouten, productiebuild, `git diff --check` en 23 seriële Playwright-scenario's geslaagd. De productie-serverstart blijft lokaal bewust geblokkeerd zonder geldige productie-cryptosleutel, cron-secret en RLS-configuratie.

## 2026-09-11 — View-as blokkeert resterende owner-administratie

**Type:** Autorisatie, accountweergave
**Agent:** Codex

**Wijziging:**
- Teamrollen, accountgegevens en teamuitnodigingen kunnen niet meer worden beheerd vanuit “bekijk als”.
- De registratie-wachtrij en bijbehorende goed- of afkeuring zijn in die modus niet zichtbaar of uitvoerbaar.
- Analytics-retentie en agenda-host-timezone zijn eveneens geblokkeerd als infrastructuur- en beheeracties.

**Verificatie:** 14 gerichte view-as-, settings- en Google Ads-autorisatietests, `pnpm typecheck`, `git diff --check` en lokale healthcheck geslaagd.

## 2026-09-11 — View-as begrenst gevoelige instellingen

**Type:** Autorisatie, accountweergave
**Agent:** Codex

**Wijziging:**
- Tijdens “bekijk als”-modus zijn connector-tests, live verbindingstests, disconnects, SMTP/IMAP/API-tests en cachebeheer geblokkeerd.
- Algemene settingsmutaties blokkeren in die modus secret-, API-, integratie-, analytics-, cache-, SEO- en social-sleutels individueel.
- Gewone klantgerichte instellingen, zoals een bedrijfsnaam, blijven bewust wijzigbaar in view-as.

**Verificatie:** 5 gerichte settings-RBAC-tests, `pnpm typecheck`, `git diff --check` en lokale healthcheck geslaagd.

## 2026-09-11 — Google Ads workspace-instellingen afgeschermd

**Type:** Autorisatie, integraties
**Agent:** Codex

**Wijziging:**
- Het selecteren van het Google Ads-customeraccount, wijzigen van de MCC-ID en in- of uitschakelen van Google Ads is nu uitsluitend beschikbaar voor de workspace-owner.
- Deze acties zijn ook expliciet geblokkeerd tijdens “bekijk als”-modus, zelfs wanneer het bekeken account ownerrechten heeft.
- De bestaande campagneworkflow voor drafts, goedkeuring en operationele campagneacties blijft ongewijzigd.

**Verificatie:** gerichte Google Ads-routertests, `pnpm typecheck`, `git diff --check` en lokale healthcheck geslaagd.

## 2026-09-11 — Tracker-snapshot is transactioneel en testbaar

**Type:** Betrouwbaarheid, monitoring
**Agent:** Codex

**Wijziging:**
- De publieke tracker verwerkt een hit nu binnen een korte domeingebonden database-transactie met advisory lock. Gelijktijdige hits kunnen daardoor geen nieuwer JSON-snapshot meer overschrijven.
- De aggregatie zit in een pure helper met consistente sessie-identiteit. Cumulatieve pageviews en unieke bezoekers blijven behouden wanneer de begrensde detailrijen worden ingekort.
- Gerichte tests dekken herhaalde sessies, snapshotlimieten en begrensde top-lijsten.

**Open:** de JSON-snapshot is bewust geen eventtabel; terugkerende bezoekers die al uit het bewaarde detailvenster zijn gevallen, blijven een beperking tot een latere datamodelmigratie.

**Verificatie:** gerichte API-tests, `pnpm typecheck`, `git diff --check` en lokale healthcheck geslaagd.

## 2026-09-11 — Nederlandse modulehulp toegevoegd

**Type:** UX, documentatie
**Agent:** Codex

**Wijziging:**
- Nieuwe route `/help` met korte Nederlandstalige uitleg, eerste actie en directe link voor iedere bestaande module.
- De helpcatalogus staat centraal in `apps/web/src/lib/module-help.ts` en is doorzoekbaar op mobiel en desktop.
- Help is geen moduleflag en blijft beschikbaar wanneer een afzonderlijke werkmodule is uitgeschakeld.

**Verificatie:** typecheck, gerichte webtests, `git diff --check` en lokale healthcheck geslaagd.

## 2026-09-11 — Eerste-login onboarding voor MVP-flow

**Type:** UX, onboarding
**Agent:** Codex

**Wijziging:**
- Het dashboard toont een compacte checklist met drie echte vervolgstappen: leads zoeken, een lead beoordelen en contact opnemen.
- De checklist gebruikt bestaande routes, is lokaal wegklikbaar en introduceert geen fictieve data of nieuwe databasevelden.

**Verificatie:** typecheck, gerichte webtest, `git diff --check` en lokale healthcheck geslaagd.

## 2026-09-11 — Per-account modulebeheer gevalideerd

**Type:** Autorisatie, moduleplatform
**Agent:** Codex

**Wijziging:**
- `user.setUserModule` accepteert uitsluitend bekende module-ID's; onbekende of zelfbedachte flags worden server-side geweigerd.
- De Team & Rollen-UI maakt self-lockout zichtbaar en blokkeert het eigen modulebeheer ook visueel.
- De bestaande Owner/Admin-policy, workspacecontrole en directe route/tRPC-moduleguard blijven leidend.

**Verificatie:** gerichte RBAC-tests, `pnpm typecheck`, `git diff --check` en lokale healthcheck geslaagd.

## 2026-09-11 — MVP-kern voor verkoopflow vastgelegd

**Type:** Productscope, documentatie
**Agent:** Codex

**Wijziging:**
- De bestaande flow `lead → score → contact → goedkeuring → verzending → opvolging → offerte → CRM/klant → factuur` is vastgelegd als eerste productkern in `docs/MVP_CORE.md`.
- Statusregels, autorisatiegrenzen en expliciete scope buiten de kern zijn beschreven.
- Bestaande modules en per-account moduleflags blijven ongewijzigd; modulebeheer volgt in fase 11.2.

**Verificatie:** documentatie-diff gecontroleerd; `git diff --check` en lokale healthcheck geslaagd.

## 2026-09-11 — Legacy JSON-import uit runtime-lijsten gehaald

**Type:** Performance, onderhoud
**Agent:** Codex

**Wijziging:**
- Taken, opgeslagen zoekopdrachten en facturen voeren niet meer tijdens list/detail/overview-requests een éénmalige JSON-import uit.
- De bestaande idempotente importfuncties blijven beschikbaar via de expliciete `db:migrate-legacy-workspace-data` setupstap, met dry-run en behoud van legacy settings voor rollback.

**Verificatie:** dry-run tegen de lokale database, 5 gerichte migratietests, `pnpm typecheck`, `pnpm build` en `git diff --check` geslaagd.

## 2026-09-11 — Settings-tenantmodel vastgelegd

**Type:** Tenantisolatie, documentatie
**Agent:** Codex

**Wijziging:**
- `WORKSPACE.md` beschrijft nu expliciet gedeelde workspace-settings, persoonlijke member-settings en de drie bewuste user-scoped uitzonderingen.
- Nieuwe gedeelde settings moeten via de workspace-resolvers lopen; publieke routes moeten een gevalideerde workspace-owner uit de tenant-tokencontext gebruiken.

**Verificatie:** bestaande typecheck, build en healthcheck blijven groen; er is geen schema- of datamigratie nodig.

## 2026-09-11 — Templatebibliotheek geconsolideerd

**Type:** Datamodel, onderhoud
**Agent:** Codex

**Wijziging:**
- Bevestigd en gedocumenteerd dat `email_templates` de enige runtime-bron is voor templates.
- `templates.library_json` blijft uitsluitend beschikbaar voor de expliciete dry-run/setupmigratie; er is geen runtime-fallback en geen automatische verwijdering van legacy-data.

**Verificatie:** gerichte template- en migratietests, `pnpm typecheck`, `pnpm build`, healthcheck en diffcontrole geslaagd.

## 2026-09-11 — Deprecated auth- en tenant-aliases verwijderd

**Type:** Onderhoud, autorisatie
**Agent:** Codex

**Wijziging:**
- De tRPC-route gebruikt rechtstreeks `validateServerEnv`; de ongebruikte `assertServerEnv`-alias is verwijderd.
- De ongebruikte `leadAccessWhere`-alias is verwijderd; actieve workspace- en chat-scope helpers in `tenant.ts` blijven behouden.

**Verificatie:** gerichte tests, typecheck, diffcontrole en lokale healthcheck geslaagd.

## 2026-09-11 — Performance-audit dashboard en teamlijst

**Type:** Performance, audit
**Agent:** Codex

**Bevinding:**
- Dashboard gebruikt al een workspacegebonden, kort gecachte `getOverview`-bundle met parallelle onafhankelijke loaders en hydration vanuit de serverpagina.
- `user.list` laadt Google Calendar-instellingen al in één `findMany` voor alle teamleden; er is geen per-user databasequery.

**Verificatie:** code-audit, typecheck, diffcontrole en lokale healthcheck geslaagd. De grote UI-splitsingen en tracker-normalisatie blijven aparte vervolgstappen.

## 2026-09-11 — Offerte-instellingen eerste opsplitsing

**Type:** Onderhoud, performance
**Agent:** Codex

**Wijziging:**
- De drie statische service-startcatalogi zijn uit de 5.000-regelige editor gehaald naar `quote-service-templates.ts`.
- De bestaande editorstate, API-mutaties en UI-flow blijven ongewijzigd; de route was al dynamisch geladen.

**Verificatie:** gerichte typecheck, routecontrole, diffcontrole en lokale healthcheck geslaagd.

## 2026-09-11 — Dashboard vervalwidget afgesplitst

**Type:** Onderhoud, performance
**Agent:** Codex

**Wijziging:**
- De widget voor verlopende domeinen is verhuisd naar `dashboard/expiring-domains-widget.tsx`.
- De bestaande dashboard-bundle, loading states, links en workspacegebonden dataflow blijven gelijk.

**Verificatie:** typecheck, diffcontrole en lokale healthcheck geslaagd.

## 2026-09-11 — Tracker-hit dubbele domeinlookup verwijderd

**Type:** Performance, monitoring
**Agent:** Codex

**Wijziging:**
- De publieke tracker leest `trackerData` nu mee in de bestaande domeinlookup en voert per hit geen tweede `findUnique` meer uit.
- De bestaande begrenzing blijft actief: maximaal 20 pagina’s, 10 referrers/campagnes en 50 bezoekers in de JSON-samenvatting.

**Open:** volledige normalisatie naar losse pageview-events blijft bewust een aparte migratie wegens datamodel- en rapportage-impact.

**Verificatie:** typecheck, diffcontrole en lokale healthcheck geslaagd.

## 2026-09-11 — Playwright smoke-script vastgelegd

**Type:** Testen, releasecheck
**Agent:** Codex

**Wijziging:**
- De bestaande CI-job blijft de volledige Playwright-suite draaien na build en seed.
- Er is daarnaast `pnpm test:e2e:smoke` toegevoegd voor snelle checks op health en dashboard.

**Verificatie:** lokale health-smoke, typecheck en diffcontrole geslaagd.

---

## 2026-09-09 — Domeinen als monitoring hub en RLS-fix voor tenant lookup

**Type:** Monitoring, UX, RLS
**Agent:** Codex

**Wijziging:**
- `/domains` gebruikt één workspacegebonden portfolio-overzicht voor statistieken, monitorinformatie en prioriteiten.
- Domeinkaarten tonen health, status, SSL, analyse en directe acties; de detailpagina toont de eerstvolgende actie.
- De globale publieke tenant-lookup wordt binnen een RLS-context optioneel gemaakt; workspace-tokenrijen blijven leidend en de bestaande fallback blijft beschikbaar.

**Verificatie:** `pnpm typecheck`, gerichte API- en webtests, `pnpm build`, healthcheck en browsercontrole op `/domains` en `/settings/integrations` slagen lokaal.

---

## 2026-09-09 — MVP-verkoopflow vanuit leaddetail

**Type:** Workflow, UX
**Agent:** Codex

**Wijziging:**
- Leaddetail toont een compacte verkoopflow met score, contact, opvolging, offerte en klant/factuur.
- Een workspacegebonden workflow-samenvatting toont contacten, recente activiteiten, drafts, open taken, offertes en facturen.
- Directe acties openen contactdraft, goedkeuring, offerte, taakformulier en CRM met behoud van leadcontext.
- Statusovergangen blijven expliciet; bestaande lead- en offertestatussen en outbound-goedkeuring blijven leidend.

**Verificatie:** gerichte API- en webtests en typecheck geslaagd; production build loopt lokaal.

---

## 2026-09-09 — Performance: shell, prefetch en contactbundel

**Type:** Performance
**Agent:** Codex

**Wijziging:**
- Shell-context bundelt workspacekeuze en minimale analyticsconfiguratie, zodat de app geen overlappende workspace- en trackingconfiguratiequeries hoeft te doen.
- Analytics-scripts slaan de workspace-query over wanneer analytics uitgeschakeld is; lead- en tag-prefetches lopen parallel.
- Outbound agenda, informatiepaneel en e-mailpreview laden dynamisch op de contactpagina.
- Analyticsinstellingen invalideren na opslaan direct de shell-cache.

**Metingen:** production build geslaagd; `/contacts` First Load JS daalde lokaal van ongeveer 305 kB naar 194 kB. Volledige tests, typecheck en lint zijn gecontroleerd; lint blijft op 0 errors en 132 bestaande waarschuwingen.

**Lokale runtime:** development gebruikt nu Turbopack; voor snelle lokale handmatige controle draait de server na een production build met lokale runtimevariabelen op `http://localhost:3000`.

---

## 2026-09-09 — Lokale audit: tenantveiligheid, outbound en runtime

**Type:** Security, data-integriteit, test- en runtimefixes
**Agent:** Codex

**Wijziging:**
- Sessies controleren actuele gebruiker, workspace-lidmaatschap, rol en `sessionVersion`; wachtwoordwijziging kan bestaande sessies intrekken.
- Zoek/import-duplicaten, scoring en workspace-RLS aangescherpt; mutaties en exports controleren actuele tenanttoegang.
- E-mailverzending atomisch geclaimd, goedkeuringswijzigingen beschermd en onzekere SMTP-aflevering vastgelegd als `DELIVERY_UNKNOWN`.
- Optimistische updates voor concepten en facturen race-bestendig gemaakt; publieke portal-upload accepteert JSON en multipart.
- Lokale seed/testaccounts, Prisma-migraties en directe dependency-updates bijgewerkt.

**Verificatie:** `pnpm test`, `pnpm typecheck`, `pnpm build` en `pnpm rls:smoke` slagen lokaal. Production health meldt database en Redis als `ok`; live externe providers en echte e-mail zijn niet getest.


---

## 2026-06-19 — PROJECT BRAIN / Wiki systeem

**Type:** Documentation  
**Agent:** Cursor  

**Wijziging:**
- Aangemaakt: `AGENTS.md`, `docs/PROJECT_BRAIN.md`, `docs/PROJECT_WIKI.md`, `docs/FILE_INDEX.md`, `docs/MODULE_MAP.md`, `docs/DECISIONS.md`, `docs/TODO.md`, `docs/AI_CHANGELOG.md`
- Aangemaakt: `.cursor/rules/project-brain.mdc` (always-apply Cursor rule)

**Doel:** LLM’s (Cursor, Codex, Claude, ChatGPT) kunnen project sneller begrijpen en doorzoeken.

**Tests:** N.v.t. (alleen documentatie)

---

## 2026-06-19 — Social Planner: Item labels + items toevoegen

**Type:** Feature fix + UX  
**Agent:** Cursor  
**Commit:** main (deployed via Vercel)  

**Wijziging:**
- Preview/editor labels: "Slide" → "Item N"
- Multi-upload: Foto/Video knoppen i.p.v. dropdown voor items toevoegen
- Preview toont alle carousel-items (ook zonder media)
- `buildPreviewSlides` in `social-page-inner.tsx` aligned met multi-upload model

**Bestanden (indicatief):**
- `apps/web/src/components/social/social-carousel-editor.tsx`
- `apps/web/src/components/social/social-live-preview.tsx`
- `apps/web/src/app/(app)/social/social-page-inner.tsx`

**Tests:** `packages/api/src/__tests__/social.router.test.ts` (api suite groen)

---

## 2026-06-19 — Google Ads Studio live editing

**Type:** Feature  
**Commit:** main (deployed via Vercel)  

**Wijziging (samenvatting uit conversatie):**
- Live campagnedata ophalen uit Google Ads API
- Opslaan, publiceren (ENABLED), pauzeren (PAUSED) vanuit wizard
- MCC auto-detect, customer selectie, campaign mutations

**Bestanden (indicatief):**
- `packages/api/src/lib/google-ads.ts`
- `packages/api/src/routers/google-ads.router.ts`
- `apps/web/src/app/(app)/google-ads/google-ads-page-inner.tsx`
- `packages/api/src/__tests__/google-ads.router.test.ts`

---

## 2026-06-19 — Social Planner Multi-upload

**Type:** Feature  
**Commit:** main (deployed via Vercel)  

**Wijziging (samenvatting):**
- UI "Instagram carousel" → "Multi-upload"
- Gedeelde items voor Instagram carousel + Facebook multi-photo
- Backend: `publishFacebookCarouselPost` heringeschakeld
- Validatie: beide platformen gebruikenzelfde slides

**Bestanden (indicatief):**
- `packages/api/src/lib/social-publish.ts`
- `packages/api/src/lib/social-placements.ts`
- `apps/web/src/components/social/social-placement-editor.tsx`
- `packages/api/src/__tests__/social.router.test.ts`

---

## Template — nieuwe entry

```markdown
## YYYY-MM-DD — Korte titel

**Type:** Feature | Fix | Refactor | Docs | Security  
**Agent:** Cursor | Human | …  
**PR/Commit:** (link of hash, indien van toepassing)

**Wijziging:**
- …

**Bestanden:**
- …

**Tests run:**
- …

**Breaking changes:** Geen | …
```

---

## Richtlijnen voor agents

Voeg een entry toe wanneer:

1. Nieuwe module, router, of significante feature
2. Security/RLS/tenant-gerelateerde wijziging
3. DB schema migratie
4. Breaking API/UI change
5. Grote refactor (>5 bestanden of architectuurimpact)

**Niet loggen:** typo fixes, formatting-only, dependency bumps zonder gedragswijziging.
## 2026-09-09 — Admin modulebeheer aangescherpt

- Admins kunnen per actief niet-owner account modules in- en uitschakelen.
- Owner-accounts en self-lockout worden server-side geblokkeerd.
- Team & Rollen toont modulebeheer voor Owner en Admin; rolbeheer blijft Owner-only.
- Gerichte RBAC-tests toegevoegd voor toegestane en geblokkeerde modulewijzigingen.
## 2026-09-09 — Workspace modulebeheer en veilige accountweergave

- Admins kunnen modules beheren voor actieve niet-owner accounts; owner- en self-lockout worden geweigerd.
- `AccountViewSession` en `SecurityAuditEvent` toegevoegd via een incrementele migratie.
- Owner view-as gebruikt een kortlevende HttpOnly-token, membershipvalidatie per request en een zichtbare terugschakelbalk.
- Gevoelige mutations worden tijdens view-as geblokkeerd; gewone operationele wijzigingen blijven mogelijk.

## 2026-09-09 — Eerste rapportage-overzicht

- Nieuwe workspacegebonden `report.overview`-query voor leads, conversie, scores, offertes, facturen en campagnes.
- Nieuwe compacte route `/reports/overview` met periodefilter, loading/error states en links naar bestaande verkoopmodules.
- De bestaande website-auditor op `/reports` blijft behouden.

Tests: `pnpm typecheck`, `git diff --check`.

## 2026-09-09 — Leadformulieren

- `LeadForm` en `FormSubmission` toegevoegd via een incrementele migratie.
- Admins kunnen formulieren aanmaken, publiceren, pauzeren en archiveren via `/forms`.
- Publieke submits gebruiken rate limiting, honeypotvalidatie, veldvalidatie en de bestaande transactionele lead-duplicatecontrole.
- Formulieraanvragen worden als workspacegebonden lead en submission opgeslagen.

## 2026-09-09 — Eerste automatiseringslaag

- `Workflow` en idempotente `WorkflowRun` toegevoegd via een incrementele migratie.
- Nieuwe module `/automations` voor workflows met lead-, formulier- en taaktriggers.
- Eerste uitvoerbare actie is automatisch een workspace-taak aanmaken.
- Dry-run en herhaalbare runs registreren resultaat en blokkeren e-mailacties zonder approval.
- Admin-only beheer en view-as-blokkade toegevoegd.
## 2026-09-09 — Bestanden en activiteitenlog

- Workspacebestanden toegevoegd met tenantgebonden metadata, uploadvalidatie en geauthenticeerde downloadroute.
- Activiteitenlog toegevoegd waarin bestaande leadactiviteiten en security-audit-events worden gecombineerd; security-events zijn beperkt tot Owner/Admin.
- Navigatie en server-side module guards uitgebreid voor `files` en `activityLog`.
- Lokale opslag en bestaande Vercel Blob-opslag blijven behouden; bestanden worden niet publiek gelijst.
## 2026-09-09 — Kennisbank

- Workspacegebonden kennisitems toegevoegd met concept-, publicatie- en archiefstatus.
- Iedere inhoudswijziging krijgt een versie in `knowledge_entry_versions`.
- Gepubliceerde context is beschikbaar via een tenantgebonden API-query; bestaande chatbotsettings blijven compatibel.
- Kennisbankacties worden via het security-auditlog geregistreerd.
## 2026-09-09 — Fase 5: SEO & Analyse

- Nieuwe workspacegebonden SEO-laag toegevoegd met zoekwoorden, handmatige posities en concurrenten.
- Nieuwe `seo` tRPC-router met overzicht, CRUD, moduleguard en auditvriendelijke adminmutaties.
- Nieuwe `/seo`-pagina met compacte KPI's, keyword tracking, concurrenten en bestaande technische domeinaudits.
- Prisma-migratie `20260909150000_seo_workspace` toegevoegd; er is geen externe rankprovider of live crawling geactiveerd.
## 2026-09-09 — Fase 5B: Projecten

- Nieuwe workspacegebonden `Project`-entiteit toegevoegd voor de overgang van verkoop naar uitvoering.
- Projecten kunnen alleen worden gestart vanuit een gewonnen lead of geaccepteerde offerte wanneer een bron wordt gekoppeld.
- Nieuwe `project` tRPC-router met bronselectie, lijst, aanmaken, statuswijziging en verwijderen.
- Nieuwe `/projects`-pagina met mobiele lege/laad/error-states en moduleguard.
- Migratie `20260909160000_projects` toegepast op de lokale database.
## 2026-09-09 — Fase 5C: Contracten

- Nieuwe workspacegebonden `Contract`-entiteit toegevoegd met versie en ondertekenstatus.
- Contracten kunnen gekoppeld worden aan projecten of geaccepteerde offertes.
- Nieuwe `contract` tRPC-router met bronselectie, lijst, aanmaken, statusovergangen en verwijderen.
- Nieuwe `/contracts`-pagina met Nederlandse loading-, error- en empty states.
- Statusflow en gevoelige wijzigingen worden server-side gevalideerd en geaudit.
- Migratie `20260909170000_contracts` toegepast op de lokale database.
- Digitale ondertekening en externe contractproviders zijn nog niet geactiveerd.
## 2026-09-09 — Fase 5D: Klantportaal

- Bestaande HMAC-offerteportal uitgebreid met gekoppeld project, contractstatussen en factuursamenvattingen.
- Alle portaldata blijft gebonden aan dezelfde offerte, workspace en vervallende portal-token.
- Geen nieuwe publieke tokenroute of database-migratie toegevoegd.
- Bestaande rate limiting, offertegoedkeuring en bestandupload blijven actief.
## Fase 5E — Agenda (2026-09-09)

- Nieuwe `/agenda`-route toegevoegd als compacte werkweergave voor bestaande taken en boekingen.
- Filters voor alles, taken en afspraken plus een horizon van 7, 30 of 90 dagen toegevoegd.
- Openstaande taken kunnen direct als gereed worden gemarkeerd; items linken naar het bestaande detail of de bestaande module.
- De route gebruikt de bestaande workspacegebonden `task.list`- en `booking.list`-queries, zonder nieuw datamodel of migratie.
- Moduletoegang en sidebar-navigatie uitgebreid met `agenda`.

## Fase 5F — Betalingen (2026-09-09)

- Nieuwe workspacegebonden `/payments`-route toegevoegd als overzicht bovenop bestaande factuurdata.
- Openstaande bedragen, vervaldatums binnen 14 dagen, betaalstatussen en recent bijgewerkte facturen worden samengevat.
- Nieuwe `payment.overview`-query gebruikt minimale selects en behoudt workspace-isolatie.
- De bestaande factuurstatusflow blijft de bron van waarheid; er is geen nieuwe payment-entiteit, Stripe-koppeling of migratie toegevoegd.
- Moduleguard en server-side routerguard toegevoegd voor `payments`.

## Fase 5G — Integratiebasis en RLS-settings (2026-09-09)

- RLS-context draagt nu naast de workspace ook de actuele gebruiker mee.
- Member-scoped instellingen (`user:{memberId}:...`) kunnen daardoor veilig gelezen en opgeslagen worden zonder de workspace-isolatie te verzwakken.
- Nieuwe incrementele migratie corrigeert de settings-policy; workspacegedeelde instellingen blijven workspacegebonden.
- Secrets blijven server-side gesaniteerd en bestaande connectoren blijven verantwoordelijk voor hun eigen test- en disconnectflow.

## Fase 5H — Connectorstatus (2026-09-09)

- Veilige `settings.getConnectorOverview`-query toegevoegd voor Google, Meta, SMTP, IMAP, MuAPI, webhook/API, Stripe en WordPress.
- De integratie-overview toont alleen statuslabels en configureerbooleans; secrets en OAuth-tokens verlaten de server niet.
- Connector-kaarten linken naar de bestaande instellingen- en testflows.
- Stripe en WordPress blijven expliciet als niet geconfigureerd zichtbaar; er worden geen live calls of fictieve connecties uitgevoerd.

## Fase 5I — Mock-tests en disconnect (2026-09-09)

- Owner-only `settings.testConnector` toegevoegd als lokale configuratiecheck zonder externe providercall.
- Owner-only `settings.disconnectConnector` toegevoegd met een vaste connector-allowlist.
- Disconnect verwijdert alleen connectorvelden, invalidateert settings-cache en schrijft een security-audit-event.
- Test- en disconnectknoppen toegevoegd aan de integratie-overview met bevestiging voor destructieve acties.

## Fase 5J — Provider-specifieke configuratiechecks (2026-09-09)

- Connectorvalidatie gecentraliseerd in `connector-config.ts` zodat router en tests dezelfde catalogus gebruiken.
- SMTP- en IMAP-ontbrekende velden worden afzonderlijk gemeld.
- Webhook-URL's worden lokaal syntactisch gecontroleerd op `http(s)` zonder netwerkrequest.
- Unit-tests toegevoegd voor Google, SMTP, webhook, MuAPI, Stripe en WordPress.

## Fase 5K — Connector teststatus (2026-09-09)

- Het connectoroverzicht toont per provider de laatste mock-testuitkomst uit het workspacegebonden security-auditlog.
- De status blijft secret-vrij en bevat alleen resultaat, reden en tijdstip.
- UI toont expliciet of de laatste lokale test geslaagd is of configuratie mist.

## Fase 5L — Lokale provider-adapters (2026-09-09)

- `@digitify/connectors` bevat nu een uniforme lokale mock-probe voor alle connector-ID's.
- Testresultaten hebben vaste codes voor geldige configuratie, ontbrekende configuratie en providers waarvoor nog geen adapter bestaat.
- De API auditlogt adapter en code zonder secrets; er wordt geen netwerkrequest uitgevoerd.
- Connector-probe tests toegevoegd voor geslaagde, ontbrekende en nog niet ondersteunde providers.

## Fase 5M — Veilige live verbindingstests (2026-09-09)

- Owner-only live test toegevoegd voor SMTP en IMAP.
- SMTP gebruikt uitsluitend Nodemailer `verify()` en verstuurt geen mail.
- IMAP maakt verbinding en logt direct uit zonder mailboxen of berichten te lezen.
- Beide tests hebben time-outs, generieke foutmeldingen en afzonderlijke audit-events.
- Niet-Owner accounts zien geen gevoelige connectoracties in het overzicht.

## Fase 5N — Google en Meta readiness-tests (2026-09-09)

- Google Places valideert de bestaande API-key via de bestaande beperkte Places-call.
- Meta valideert App ID en App Secret via client-credentials zonder publicatie of tokenopslag.
- Google, Meta, SMTP en IMAP gebruiken dezelfde Owner-only live-testmutation met timeout en auditlog.

## Fase 5O — Stripe en WordPress read-only checks (2026-09-09)

- Stripe controleert read-only `/v1/account` met de workspace-key; er worden geen betalingen of writes uitgevoerd.
- WordPress controleert alleen `/wp-json/` na SSRF-validatie; optionele application-password-authenticatie wordt niet opgeslagen of gelogd.
- Connectorinstellingen zijn opgenomen in de bestaande workspace-settings allowlist en disconnect-flow.
- Live- en mock-tests verschijnen samen in de laatste connectorstatus.

## Fase 5P — Stripe en WordPress configuratie-UI (2026-09-09)

- Owner krijgt compacte configuratievelden voor Stripe en WordPress op het integratie-overzicht.
- Stripe secret key en WordPress application password gebruiken de centrale secret-encryptie en redactie.
- Opslaan invalideert direct settings- en connectorstatuscache.

## Fase 5Q — Provider-contract hardening (2026-09-09)

- Stripe secret keys worden syntactisch gevalideerd vóór een externe request.
- WordPress-URL's met ingebedde gebruikersnamen of wachtwoorden worden geweigerd.
- Regressietests toegevoegd voor geldige en onveilige configuraties.

## Fase 5R — Connectorstatus en foutmeldingen (2026-09-10)

- Een connector wordt pas als verbonden getoond na een geslaagde live verbindingstest.
- Alleen aanwezige instellingen tonen nu de tussenstatus “Test vereist”.
- Mislukte live tests onderscheiden ontbrekende configuratie van een verbindingsfout.

## Fase 5S — Connector retry en auditcontext (2026-09-10)

- Connectorstatus toont nu of de laatste test lokaal of live was en wanneer die plaatsvond.
- Een testresultaat invalideert direct het connectoroverzicht; opnieuw testen toont een expliciete retry-actie.
- Testknoppen blokkeren elkaar tijdens een lopende test om dubbele requests te voorkomen.

## Fase 5T — Integratiegeschiedenis voor Owner/Admin (2026-09-10)

- De integratiepagina toont recente connectorchecks uit het bestaande security-auditlog.
- De query filtert server-side op de eigen workspace en resource `connector`.
- Owner en Admin zien testtype, resultaat, actorcontext en tijdstip zonder secrets of tokens.

## Fase 5U — Auditfilters en foutdetail (2026-09-10)

- Integratiegeschiedenis kan filteren op alles, geslaagde checks of mislukte checks.
- Mislukte checks hebben een compacte detailweergave met een veilige, generieke vervolgstap.
- De auditweergave blijft read-only en toont geen providerpayloads, tokens of wachtwoorden.

## Fase 5V — Connector-detail en veilige retry (2026-09-10)

- Iedere connector heeft een compacte detailweergave met de recente testgeschiedenis.
- Owner/Admin kunnen vanuit die detailweergave een nieuwe check starten wanneer zij daarvoor rechten hebben.
- De retry gebruikt dezelfde lokale of live testpolicy en blijft read-only voor externe providers.

## Fase 5W — Auditresponse hardening (2026-09-10)

- De security-auditrouter gebruikt nu een expliciete browserveilige veldselectie.
- Auditmetadata, workspace-ID's en overige interne velden verlaten de server niet.
- Een regressietest bewaakt deze redactiegrens.

## Fase 5X — Connectorstatus na configuratiewijziging (2026-09-10)

- Wijzigingen aan connectorinstellingen worden als secretvrije auditactie geregistreerd.
- Een oude geslaagde live test blijft niet geldig nadat de relevante configuratie is gewijzigd.
- De connectoroverview toont dan opnieuw “Test vereist” zonder nieuwe kolom of migratie.

## Fase 5Y — Bounded connector status history (2026-09-10)

- Connectorstatus gebruikt per connector de laatste test en laatste configuratiewijziging via bounded queries.
- Oude auditactiviteit kan een actuele connectorstatus niet meer overschrijven.
- Geen migratie of nieuwe publieke API nodig.

## Fase 8.1 — Betrouwbare lokale env-loading (2026-09-10)

- `pnpm dev` gebruikt de root `.env` als primaire bron.
- `apps/web/.env.local` wordt alleen als fallback geladen wanneer de root-env ontbreekt.
- Het devscript kopieert geen verouderde env-bestanden meer.

## Fase 8.2 — Next.js-configuratie gecontroleerd (2026-09-10)

- `experimental.instrumentationHook` staat niet meer in `apps/web/next.config.js`.
- De resterende `serverActions.bodySizeLimit` en `middlewareClientMaxBodySize` zijn geldige instellingen voor Next.js 15.5.25.
- Daarom is geen functionele configuratiewijziging nodig.

## Fase 8.3 — Reproduceerbare releasecheck (2026-09-10)

- `pnpm check:release` laadt dezelfde root/app-local env-fallback als `pnpm dev`.
- Lint is toegevoegd aan de releasecheck naast tests, typecheck en build.
- De check valideert vooraf dat `pnpm` beschikbaar is en lekt geen env-waarden.

## Fase 8.4 — Productie-RLS als harde startup-gate (2026-09-10)

- Productie start niet meer wanneer `ENABLE_WORKSPACE_RLS=true` ontbreekt.
- De test voor ontbrekende RLS is bijgewerkt naar de vereiste fail-closed-beveiliging.
- Deploy- en architectuurdocumentatie maakt nu onderscheid tussen productie en gecontroleerde niet-productie-rollbacks.

## Fase 8.5 — Veilige database-preflight (2026-09-11)

- `setup-production-db.sh` laadt lokaal dezelfde env-fallback als de dev- en releasecheck.
- Nieuwe `pnpm setup:db:preflight` controleert URL, doelhost en migratiestatus zonder wijzigingen.
- Productie-setup vereist expliciet `DIRECT_URL`; migreren en seeden blijven afzonderlijke handmatige acties.

## Fase 8.6 — Release-readiness checklist (2026-09-11)

- Een centrale checklist beschrijft lokale, CI/staging- en productiecontroles.
- De huidige dirty worktree wordt expliciet als handmatige merge-blocker vermeld.
- Geen commit, push, productieverbinding of deployment uitgevoerd.

## Fase 9.1 — Legacy SavedView afgebakend (2026-09-11)

- `SavedView` is niet in runtimecode gebruikt; `WorkspaceSavedSearch` is de actieve implementatie.
- Het legacy-model gebruikt nu `@@ignore`, zodat nieuwe code het niet kan aanspreken.
- De bestaande `saved_views`-tabel en data blijven behouden; er is geen destructieve migratie uitgevoerd.

## Fase 8.7 — Fail-fast rate-limit fallback en RLS-integraties (2026-09-11)

- Een niet-bereikbare Redis-server kan een tRPC-request niet langer onbeperkt laten wachten: de connectiepoging stopt na een seconde en valt terug op de bestaande in-memory limiter.
- Mutatie-autorisatie wordt gecontroleerd voordat een RLS-context wordt geopend, zodat read-only accounts direct een `FORBIDDEN`-resultaat krijgen.
- De volledige lokale DB-integratieset is opnieuw uitgevoerd met RLS: workspace-isolatie, IDOR en settings-RBAC slagen alle elf.

## Fase 8.8 — Lokale release- en browserverificatie (2026-09-11)

- De database-preflight bevestigt dat de lokale database bereikbaar is en alle 44 migraties bevat, zonder wijzigingen uit te voeren.
- Creative Studio e2e controleert nu de veilige MuAPI-key-gate wanneer geen sleutel is ingesteld, naast de bestaande tabnavigatie en integratie-instellingen.
- De cross-tenant browsertest blijft lokaal geblokkeerd totdat de Owner-B-testcredential opnieuw is geseed of expliciet is ingesteld; de onderliggende RLS- en IDOR-integratietests zijn wel groen.

## Fase 8.9 — Reproduceerbare RLS-testaccounts (2026-09-11)

- Een herhaalde lokale seed herstelt nu ook de rol, verificatiestatus en het wachtwoord van de tweede RLS-owner.
- De cross-tenant Playwright-flow is aangepast aan de actuele, veilige UI: verborgen responsieve tabelvarianten worden genegeerd en een ontoegankelijke leaddetail-URL moet veilig naar Lead Search terugsturen.
- Owner B ziet aantoonbaar geen leads van Owner A en kan een directe URL naar zo'n lead niet openen.

## Fase 8.10 — Lokale releasegate en catalogusverversing (2026-09-11)

- De volledige lokale Playwright-suite is uitgevoerd met de lokale seedaccounts, inclusief de cross-tenant browsercontroles.
- De gegenereerde MuAPI-modelkostencatalogus is ververst naar 674 actuele endpoints; de synccontrole is weer groen.
- Databasegeneratie, migratiecontrole, tests, typecheck, lint en een schone productiebuild zijn lokaal uitgevoerd.
- De productiebuild is bewust zonder gelijktijdige devserver uitgevoerd om een gedeelde `.next`-werkmapconflict te voorkomen; daarna is de lokale app opnieuw gestart.

## Fase 9.6 — Veilige voorbeeldconfiguratie (2026-09-11)

- Een versioneerbare `.env.example` beschrijft lokale Postgres/Redis, verplichte authenticatievariabelen, productie-RLS en optionele providers zonder werkende secrets.
- De lokale installatie-, wiki- en agentdocumentatie verwijzen naar hetzelfde startpunt.
- Seedcredentials blijven expliciet opt-in en worden niet als werkende waarden in het voorbeeldbestand opgenomen.

## Fase 9.7 — Geauthenticeerde E2E-preflight (2026-09-11)

- De beschermde dashboard-, leads-, moduleguard-, RLS-, RBAC-, outbound- en viewer-suites zijn afzonderlijk serial uitgevoerd.
- Zonder expliciete testcredentials worden deze tests voorspelbaar overgeslagen; er wordt geen wachtwoord geraden of gegenereerd.
- Auth-subset: `17/17 skipped`, zonder hang. De publieke en production E2E-resultaten blijven geldig; de werkelijke authenticated flow blijft geblokkeerd totdat expliciete lokale testcredentials worden aangeleverd.

## Fase 9.8 — Authenticated browserflow en actuele E2E-contracten (2026-09-11)

- Lokale testaccounts zijn tijdelijk van expliciete lokale testwachtwoorden voorzien; er zijn geen productieaccounts of secrets gebruikt.
- Stale Playwright-selectors zijn afgestemd op de huidige UI: primaire `h1`-titels, `/templates`, modulefilters en read-only bulkacties.
- De beveiligingsrate-limit voor credential-login bleef ongewijzigd. De volledige suite moet daarom in onafhankelijke processen of met gedeelde auth-state worden uitgevoerd wanneer meer dan acht loginpogingen per minuut nodig zijn.
**Verificatie:** leads/templates/compose/outbound `7/7`, RLS cross-tenant `2/2`, Viewer read-only `2/2`. Een brede productie-run bereikte `18 passed`; de overige failures waren stale selectors of de verwachte login-rate-limit bij herhaalde losse logins.

## Fase 9.9 — Gedeelde Playwright-auth-state (2026-09-11)

- Playwright maakt nu lokale sessiestates voor Owner, Viewer, Moderator, Member en de modulebeperkte gebruiker onder `test-results/.auth`.
- Authenticated specs hergebruiken deze sessies; de RLS-test houdt alleen de noodzakelijke expliciete Owner A/Owner B-wissel.
- Ontbrekende credentials blijven fail-closed: de setup maakt lege statebestanden en de beschermde tests blijven voorspelbaar overslaan.
**Verificatie:** volledige Playwright-suite `26/26 passed` met lokale testaccounts; typecheck geslaagd, lint `0 errors / 132 bestaande warnings`, diffcontrole geslaagd.

## Fase 10 — Responsive kernflow (2026-09-11)

- Een gerichte Playwright-regressiesuite controleert dashboard, leads, contactdraft, offertes en facturen op mobiel (`375px`), tablet (`768px`) en desktop (`1440px`).
- Per route wordt gecontroleerd op primaire content, zichtbare application errors en horizontale overflow op body- en documentniveau.
**Verificatie:** `3/3 passed`; alle vijf verkooproutes blijven bruikbaar op de drie viewportformaten.

## Fase 11 — Gevoelige acties en releasegate (2026-09-11)

- Bestaande securitytests voor view-as, modulebeheer, integraties, exports, auditprojectie en gevoelige mutations zijn opnieuw gecontroleerd; er is geen dubbele productlogica toegevoegd.
- De volledige lokale test-, RLS- en buildgate is afzonderlijk uitgevoerd om interactie tussen devserver en productieartefacten te voorkomen.
**Verificatie:** `pnpm test` geslaagd met API `292 passed / 16 skipped` en web `40/40`; securityselectie geslaagd; `ENABLE_WORKSPACE_RLS=true pnpm rls:smoke` geslaagd; production build geslaagd. Redis blijft lokaal bewust `skipped` en externe providers zijn niet live getest.

## Fase 12 — Gerichte lintopruiming kernflow (2026-09-11)

- Ongebruikte imports verwijderd uit compose, Outbound Center, dashboard, domeinen, leaddetail en integraties.
- Renderstabiliteit in compose verbeterd met memoization van templates.
- Integratie-tabselectie gebruikt nu stabiele callback- en effectdependencies.
**Verificatie:** kernsubset `0 warnings`; totale web-lintstand van `132` naar `109` warnings, `0 errors`; typecheck geslaagd; webtests `40/40`; healthcheck en diffcontrole geslaagd.

## Fase 13 — Stabiele lokale devrunner (2026-09-11)

- De lokale Next.js devscript gebruikt nu de stabiele `next dev`-runner zonder Turbopack.
- De gescheiden `.next-dev`-directory blijft behouden; production builds blijven `.next` gebruiken.
- Dit voorkomt de eerdere Turbopack-specifieke vastloper; een resterend dev-only browsernavigatieprobleem wordt in fase 14 apart opgevolgd.
**Verificatie:** vijf opeenvolgende `/api/health`-requests: `5x HTTP 200`; `/login`: `HTTP 200`; lokale app blijft bereikbaar op poort 3000.

## Fase 14 — Lokale runtime, E2E en rate-limit stabilisatie (2026-09-11)

- Lokale scripts laden nu `apps/web/.env.local` vóór `.env`, zodat de lokale Redis-keuze (`REDIS_URL=""`) niet door een gedeelde env wordt overschreven.
- Healthchecks gebruiken korte connectie- en request-timeouts en falen voorspelbaar wanneer een eerder devproces niet meer reageert.
- `optimizePackageImports` blijft actief voor production builds en is uitgeschakeld in development om de monorepo-devcompiler responsief te houden.
- De developmentserver bindt expliciet op IPv4 (`127.0.0.1`), zodat localhost-browserflows niet op de lokale IPv6-listener blijven wachten.
- Playwright wacht op DOM-content, gebruikt actuele module- en leadselectors en de lokale browser-testmodus verhoogt alleen de algemene tRPC-limiet; productie blijft `100/min`.
**Verificatie:** `pnpm typecheck` geslaagd; web-lint `0 errors / 109 warnings`; production build geslaagd met 119 statische pagina's; volledige production-mode Playwright-suite `29/29 passed`; lokale poort 3000 health/login `200`.
**Open risico:** de authenticated Playwright-login kan in `next dev` nog wachten op de navigatiecallback; de production-mode browserflow is volledig groen. Externe providers en Redis blijven lokaal niet live bewezen; de browserflow gebruikt lokale fixtures.

## Fase 15 — Productie security-audit en domeinschemaherstel (2026-09-12)

- De productie-database van Lead Finder is idempotent hersteld met de ontbrekende domeininzichten (`analysisData`, `trackerData`, `lastAnalyzedAt`, `lastTrackerAt` en `healthScore`) en de bijbehorende indexen. Er is geen bestaande data verwijderd of samengevoegd.
- Een tweede live schema-afwijking is hersteld: `registration_requests.targetWorkspaceOwnerId` en de bestaande workspace/status-index zijn idempotent toegevoegd nadat Vercel-runtimegegevens een registratie-wachtrij-500 aantoonbaar maakten.
- De releasecheck valideert deze kritieke domeinkolommen vóór een release; Prisma- en databasefouten worden niet meer als ruwe fouttekst naar clients teruggestuurd.
- Supabase-grants voor `anon` en `authenticated` blijven gesloten. Security Advisors tonen uitsluitend informatieve `rls_enabled_no_policy`-meldingen; deze zijn niet zonder policy-review generiek aangezet omdat de serverapp Prisma gebruikt.
- Cloudflare, Vercel en beide gewenste productieprojecten zijn read-only gecontroleerd. De live healthcheck is groen; Redis-rate limiting is niet aantoonbaar actief (`redis: skipped`).

**Verificatie:** `pnpm typecheck` geslaagd; `pnpm test` geslaagd (`294 passed / 16 skipped` API, `42 passed` web); `pnpm lint` geslaagd met `0 errors` en bestaande waarschuwingen (`109` web, `30` API); RLS-smoke en integratietests geslaagd; `pnpm build` geslaagd met `NODE_OPTIONS=--max-old-space-size=4096` en `119` statische pagina's; `git diff --check` geslaagd; productie `/api/health` en homepage geven HTTP 200.
**Geblokkeerd:** Cloudflare API-wijzigingen voor `Always Use HTTPS` en minimum TLS 1.2 gaven authenticatiefout `10000`; deze twee instellingen moeten in het Cloudflare-dashboard worden bevestigd. Er is geen secretrotatie of mailboxwijziging uitgevoerd.

## Fase 16 — Productie rate-limit releasegate (2026-09-12)

- `scripts/check-production-env.sh` weigert productieconfiguraties zonder gedeelde `REDIS_URL` of een volledige Upstash REST-configuratie. In-memory rate limiting blijft uitsluitend geschikt voor lokaal gebruik.
- Vercel-runtimefouten zijn opnieuw gecontroleerd: Lead Finder heeft na het schemaherstel geen nieuwe fouten in de laatste 10 minuten; de shop toont alleen een bestaande Node `url.parse()`-deprecationwarning.
**Verificatie:** shell syntaxcheck, `git diff --check`, lokale healthcheck en gerichte securitytests geslaagd.

## Fase 17 — Eindverificatie security-audit (2026-09-12)

- Volledige test-, typecheck-, lint-, RLS-smoke- en productiebuildcontrole opnieuw uitgevoerd.
- Lokale login geeft HTTP 200; productie `/api/health` geeft database `ok`; beschermde `/domains`-route redirect naar `/login` met private/no-store cacheheaders.
- Productie-loginheaders bevatten HSTS, `nosniff`, `SAMEORIGIN` en dynamische Cloudflare-cachestatus.
**Verificatie:** `pnpm test` (`294 passed / 16 skipped` API, `42 passed` web), `pnpm typecheck`, `pnpm lint` (`0 errors`, bestaande warnings), `ENABLE_WORKSPACE_RLS=true pnpm rls:smoke` en `NODE_OPTIONS=--max-old-space-size=4096 pnpm build` geslaagd.
**Geblokkeerd:** Cloudflare `Always Use HTTPS`/minimum TLS 1.2 en gedeelde Vercel Redis/Upstash blijven handmatige beheeracties; zonder die instellingen is productie niet volledig gehard.

## Fase 18 — Cloudflare TLS- en redirect-hardening (2026-09-12)

- Via de geauthenticeerde Cloudflare-dashboardomgeving is `Always Use HTTPS` ingeschakeld.
- Minimum TLS is ingesteld op `1.2`; `Full (strict)` en de bestaande certificaatconfiguratie zijn behouden.
- HTTP naar `leads.digitify.be` is gecontroleerd met een `301` naar HTTPS. De HTTPS-response gaf `200` met HSTS, `nosniff`, `SAMEORIGIN` en dynamische Cloudflare-cachecontrole.
- DNS-records, mailrecords en WAF-regels zijn in deze fase ongemoeid gelaten.

**Verificatie:** Cloudflare API-readback bevestigt `always_use_https=on` en `min_tls_version=1.2`; HTTP-redirect en HTTPS-headers zijn live gecontroleerd. Gedeelde Vercel Redis/Upstash en de bestaande shop-deprecationwarning blijven openstaande punten.

## Fase 19 — Vercel productiecontrole (2026-09-12)

- De Vercel-projectallowlist is read-only gecontroleerd: alleen Lead Finder en de 3D-webshop zijn aanwezig binnen het gecontroleerde team.
- De laatste productie-deployments van beide projecten staan op `READY` en hebben de verwachte primaire domeinalias.
- Runtime-audit uitgevoerd zonder secrets of environment values uit te lezen. Lead Finder toont nog een historische registratie-request-fout rond een ontbrekende kolom en incidentele trage dashboardrequests; de shop toont een bestaande `url.parse()`-deprecationwarning.
- Er is geen productie-deployment, projectverwijdering, firewallwijziging, preview-wijziging of secretrotatie uitgevoerd.

**Verificatie:** Vercel project-, deployment- en runtime-readback geslaagd; publieke HTTPS-healthchecks blijven groen. Open: productie Redis/Upstash, gecontroleerde herverificatie van registratie na schemaherstel en onderhoud van de shop-deprecationwarning.

## Fase 20 — Supabase RLS- en grants-audit (2026-09-12)

- Security Advisors zijn opnieuw uitgevoerd voor Lead Finder en de shop; er zijn geen kritieke of waarschuwingsmeldingen gevonden.
- `anon` en `authenticated` hebben geen tabel-SELECT-rechten op de gecontroleerde applicatietabellen. De RLS-waarschuwingen betreffen tabellen met RLS aan maar zonder policy en zijn daardoor fail-closed voor directe Data API-lezing.
- Beide projecten hebben geen publieke views gevonden. De applicatie blijft Prisma server-side gebruiken; de Supabase Data API blijft gesloten.
- De workspace-helperfuncties zijn gecontroleerd. Ze lezen uitsluitend transactionele `app.*`-settings en zijn niet `SECURITY DEFINER`; de bestaande security-definer functies zijn beperkt tot interne Supabase-schema's of servicebeheer en niet uitvoerbaar voor `anon`/`authenticated`.
- Er zijn geen generieke `TO authenticated`-policies, grants, functies of productiedata gewijzigd.

**Verificatie:** Security Advisors opnieuw gecontroleerd (Lead Finder 7 informatieve `rls_enabled_no_policy`-meldingen; shop 16), grants gecontroleerd, views/functies gecontroleerd en `ENABLE_WORKSPACE_RLS=true pnpm rls:smoke` geslaagd. Open: policies alleen toevoegen wanneer een tabel bewust via Data API ontsloten wordt; gedeelde productie-rate limiting blijft een Vercel-configuratiepunt.

## Fase 21 — Eindverificatie applicatie en tenantisolatie (2026-09-12)

- De volledige testset is opnieuw uitgevoerd: API `294 passed / 16 skipped`, web `42 passed`.
- Typecheck, lint en production build zijn geslaagd; de build genereerde 119 pagina's. Lint heeft 0 errors en alleen bestaande waarschuwingen.
- Database-integratietests met RLS zijn geslaagd (`13/13`). De RLS-smoke bevestigde opnieuw dat workspace A 141 eigen leads en workspace B 2 eigen leads ziet; cross-workspace ID's blijven geblokkeerd.
- Lokale routecheck: `/api/health` en `/login` geven `200`; beschermde `/domains`, `/leads` en `/settings/integrations` geven `307` naar login wanneer geen sessie aanwezig is.
- `git diff --check` is geslaagd. Er is niets gecommit, gepusht of gedeployed.

**Open risico's:** productie Redis/Upstash is nog niet aantoonbaar actief; de volledige geauthenticeerde productie-browserflow is niet bewezen met credentials; Vercel toont nog de bestaande shop-deprecationwarning en historische Lead Finder-runtimemeldingen. Externe integraties en Cloudflare/Vercel beheerinstellingen zijn niet volledig live getest.

## Fase 22 — Lokale Playwright eindcontrole (2026-09-12)

- De lokale Playwright-suite is uitgevoerd met 32 scenario's: 8 geslaagd en 24 overgeslagen.
- Geslaagde scenario's omvatten de health endpoint, responsive marketingweergave op desktop/tablet/mobile, publieke embeds en portal-uploadbeveiliging.
- De overgeslagen scenario's zijn authenticated owner/admin/member/viewer-, moduleguard-, cross-tenant- en kernflowtests waarvoor de lokale testomgeving geen expliciete browsercredentials heeft ingesteld.
- Geen browserfouten of wijzigingen aan productie-infrastructuur uitgevoerd. De lokale app blijft bereikbaar op `http://localhost:3000`.

**Verificatie:** `pnpm test:e2e` eindigde succesvol (`8 passed / 24 skipped`, circa 53 seconden). Authenticated browserflows blijven transparant als niet bewezen gemarkeerd; de onderliggende API-, integratie- en RLS-tests zijn wel geslaagd.

## Fase 23 — Lokale authenticated E2E-preflight (2026-09-12)

- Lokale E2E-fixtures zijn gecontroleerd met tijdelijk gegenereerde testcredentials; het wachtwoord is niet opgeslagen of gelogd.
- De database accepteert de lokale Owner-credentials aantoonbaar (`scrypt`, account geverifieerd). De NextAuth callback retourneert rechtstreeks de dashboard-URL.
- De Playwright-browserflow blijft geblokkeerd: de hergebruikte lokale server blijft na de UI-submit op `/login` en de Playwright API-context time-out op dezelfde callback. Dit wijst op testserver/runtime-state, niet op een ongeldig seedwachtwoord.
- De tijdelijke Playwright-workaround is teruggedraaid; de bestaande testsetup blijft intact. Typecheck en `git diff --check` zijn geslaagd.

**Open risico:** authenticated browserflows voor Owner, Admin, Member, Viewer en cross-tenant navigatie zijn lokaal nog niet bewezen. Eerst de devserver op een schone poort met één consistente env starten, daarna de suite opnieuw uitvoeren.

## Fase 37 — Private workspacebestanden (2026-09-12)

- Nieuwe bestanden via `/api/files/upload` worden in productie als private Vercel Blob opgeslagen (`blob-private`) in plaats van als publiek leesbare URL.
- De bestaande geauthenticeerde downloadroute valideert workspace-eigendom en leest private blobs server-side met `get(..., { access: "private" })`; cache omzeilen voorkomt dat gevoelige bestanden via een publieke CDN-cache blijven hangen.
- Oude records met `storage = "blob"` blijven compatibel. Hun bestaande publieke opslag wordt niet automatisch gemigreerd of verwijderd; sociale media-assets blijven publiek zodat externe platformen ze kunnen ophalen.
- De downloadroute accepteert voor oude publieke blobs alleen Vercel Blob-hosts en weigert onbekende externe hosts, waardoor een gemanipuleerde opslag-URL geen server-side fetch naar willekeurige hosts kan veroorzaken.
- Er is geen productie-upload, data-migratie, Blob-verwijdering of deployment uitgevoerd.

**Verificatie:** `pnpm typecheck` geslaagd; `git diff --check` geslaagd. Open: bestaande portalbestanden zijn nog publieke Blob-URLs omdat het publieke klantportaal ze rechtstreeks rendert; private portal-downloads vereisen een aparte tokenroute en UI-wijziging.

## Fase 38 — Private klantportaalbestanden (2026-09-12)

- Nieuwe bestanden die via het publieke klantportaal worden geüpload, worden als private Blob opgeslagen (`blob-private`).
- De portal geeft geen directe Blob-URL meer terug voor nieuwe bestanden; downloads lopen via `/api/public/portal/:quoteId/file/:fileId` met dezelfde kortlevende portal-tokencontrole als de rest van het portaal.
- De downloadroute controleert offerte, workspace-eigenaar, offerte-ID en bestand-ID, gebruikt `private, no-store` headers en beschermt Blob-hosts/paden tegen willekeurige externe fetches.
- Oude portalbestanden met publieke opslag blijven leesbaar via de gecontroleerde compatibiliteitsroute; er is geen automatische migratie of verwijdering uitgevoerd.
- De portal-UI accepteert nu de nieuwe relatieve downloadroute en blijft compatibel met oude data-URL-velden.

**Verificatie:** `pnpm typecheck`, gerichte ESLint, `pnpm --filter @digitify/web test -- --run` (`42 passed`) en `git diff --check` geslaagd. De nieuwe route gaf zonder geldig token HTTP 403. De lokale app draait op `http://localhost:3000`; er is niets gedeployed.

## Fase 39 — Resource-autorisatie en bestandsaudit (2026-09-12)

- Uploads valideren nu server-side dat een gekoppelde lead, offerte, klantrelatie of project bij dezelfde workspace hoort. Onvolledige, onbekende en cross-workspace-relaties worden geweigerd.
- De tRPC-bestandslijst accepteert geen onvolledige `relatedType`/`relatedId`-filters meer.
- Geslaagde workspace-downloads worden als `FILE_DOWNLOADED` geregistreerd met actor, workspace, resource en request-id; bestandsnamen en metadata blijven beperkt tot niet-gevoelige informatie.
- Er zijn geen nieuwe databasevelden of migraties toegevoegd.

**Verificatie:** `pnpm typecheck`, gerichte ESLint, webtests (`42 passed`), API-tests (`294 passed / 16 skipped`) en `git diff --check` geslaagd. Geen productie-upload, deployment of datawijziging uitgevoerd.

## Fase 40 — Gecombineerd activiteiten- en securitylog (2026-09-12)

- De activiteitenquery levert nu gewone activiteiten en toegestane security-events samen, workspacegebonden en gesorteerd op tijd.
- Owner en Admin kunnen filteren op gebruiker, actie, resultaat, resource/module en periode; gewone gebruikers zien geen security-eventdata.
- De API geeft uitsluitend beperkte actorinformatie terug. Security-metadata, tokens, wachtwoorden en volledige payloads blijven server-side.
- De activiteitenpagina heeft compacte filters met loading-, fout- en lege staten behouden.

**Verificatie:** `pnpm typecheck`, gerichte ESLint, webtests (`42 passed`) en `git diff --check` geslaagd. Geen databasewijziging, productieactie of deployment uitgevoerd.

## Fase 41 — Shop Blob-delivery en 3D-assets (2026-09-12)

- De live shop gaf 3D-modellen via een directe Blob-CDN-URL door, terwijl die URL voor de actuele assets `403` gaf. De eigen `/assets/...`-route gaf dezelfde modellen wel correct terug.
- In `digitify-3d-webshop` is `BLOB_PUBLIC_BASE_URL` losgekoppeld van de publieke delivery-resolver. Alleen een expliciete `ASSET_CDN_BASE`/`PUBLIC_ASSET_CDN` wordt nog als CDN gebruikt; anders blijft same-origin delivery actief.
- De shop is gedeployed naar het bestaande Vercel-project en opnieuw gealiased naar `shop.digitify.be`.
- De 3D-modellen voor NFC-polsbandjes, LED lichtbak kabel en LED lichtbak oplaadbaar geven live HTTP 200 met `model/gltf-binary`. `/api/health` is `healthy`, database/storage/sample3d zijn ok.
- Oude production-deployments zijn bewust behouden voor rollback. Er zijn geen Blob-objecten of deployments verwijderd in deze fase.

**Verificatie:** shoptests `45/45` geslaagd; gerichte security/CDN-tests `4/4` geslaagd; productie-deployment `dpl_7kBu5YezvxUF6BuYTNazbm72zxvK` staat `READY`; live 3D-assets en healthcheck gecontroleerd. Open: Vercel Blob staat nog boven de quotaweergave en Functions Storage is hoog; opruimen vereist een aparte selectie van oude deployments/assets.

## Fase 42 — Productie-opslag en live eindcontrole (2026-09-12)

- Oude Vercel-deployments van de shop zijn opgeschoond. De huidige productieversie en één rollbackversie zijn behouden.
- Oude Vercel-deployments van Leads zijn opgeschoond. De drie recente productieversies van vandaag zijn behouden voor gecontroleerde rollback.
- De huidige Leads-deployment (`dpl_S68Bb7aKUJRKojDe8pj2zVwzodaP`) heeft in de laatste 24 uur geen error- of warningroutes.
- De huidige shop-deployment (`dpl_7kBu5YezvxUF6BuYTNazbm72zxvK`) geeft alleen de bekende Node `url.parse()`-deprecatie; requests en healthcheck blijven HTTP 200/healthy.
- Blob-bestanden zijn niet verwijderd: zonder projectspecifieke `BLOB_READ_WRITE_TOKEN` kan niet betrouwbaar worden vastgesteld welke objecten actief zijn. De actieve 3D-assets blijven daarom intact.

**Verificatie:** `pnpm test` geslaagd (`294 passed / 16 skipped` API, `42 passed` web), `pnpm typecheck` geslaagd, beide live healthchecks HTTP 200, shop 3D-assets HTTP 200. Geen databasegegevens verwijderd of gewijzigd.

## Fase 43 — Blob-inventarisatie en veilige cleanupgrens (2026-09-12)

- De bestaande productievariabele `BLOB_READ_WRITE_TOKEN` is aanwezig voor zowel Leads als Shop; er is geen nieuwe token aangemaakt en geen secretwaarde uitgelezen of gedeeld.
- De gekoppelde Leads-Blob bevat 317 objecten met samen ongeveer 916 MB. De objecten bestaan voornamelijk uit workspace-media, social exports en video’s.
- Er zijn geen Blob-objecten verwijderd. Een veilige verwijdering vereist een betrouwbare vergelijking met de productie-database; de lokale env-context mag daarvoor niet als productiebron worden gebruikt.
- De actieve 3D-assets en alle huidige deploymentversies blijven intact.

**Volgende veilige stap:** productie-databasecontext expliciet vastzetten, objecten koppelen aan `WorkspaceFile`, media- en social-records, en daarna alleen aantoonbaar verweesde test- of dubbele objecten in een kleine batch verwijderen.

## Fase 44 — Productie-Blob cleanup (2026-09-12)

- De actuele productie-database is rechtstreeks via Supabase gecontroleerd op Blob-verwijzingen in gebruikers, instellingen, media-generaties en social posts/metadata.
- 48 Blob-objecten blijven behouden omdat ze door actuele productiegegevens worden gebruikt.
- 269 niet-gerefereerde Leads-objecten zijn in kleine batches verwijderd: ongeveer 782,8 MB vrijgemaakt.
- Leads Blob staat nu op 48 objecten en ongeveer 169,9 MB; Shop Blob staat op 120 objecten en ongeveer 121,3 MB.
- Na de cleanup geven Leads en Shop HTTP 200 op hun healthchecks. De drie live shopmodellen geven nog steeds HTTP 200.
- Er zijn geen database-records verwijderd of aangepast. De enige referentie-afwijking was een slash-normalisatie in een opgeslagen JSON-waarde; het onderliggende logo-object bestaat nog.

## Fase 45 — Functions Storage en runtime-eindcontrole (2026-09-12)

- Leads houdt drie recente productie-deployments; Shop houdt twee recente productie-deployments. Oude deployment-artifacts zijn niet meer aanwezig in de projectlijsten.
- De actuele Leads-deployment blijft gezond; gemelde databasefouten in het brede 24-uursrapport horen bij een oudere deployment en worden niet als actuele live-regressie behandeld.
- De actuele Shop-deployment heeft geen databasefout; de resterende runtime-melding is de bekende Node `url.parse()`-deprecatie.
- Er is geen extra deployment verwijderd omdat dit de huidige rollbackmarge zou verkleinen.

## Fase 46 — Dashboard roundtrip-optimalisatie (2026-09-12)

- De Topbar vroeg op `/dashboard` opnieuw de volledige `dashboard.getOverview` op naast de voorgehydrateerde dashboardpagina.
- Die tweede zware query is vervangen door het bestaande lichte `dashboard.getAttentionSummary`; de dashboardpagina behoudt de volledige overview voor de inhoud.
- De attention-badge blijft werken op dashboard, leads en contacten met dezelfde refreshregels.

**Verificatie:** `pnpm typecheck`, webtests (`42 passed`), gerichte ESLint en `git diff --check` geslaagd.

## Fase 47 — Dashboardcache direct invalideren na workflowmutaties (2026-09-12)

- De bestaande tRPC-routemeting registreert al gemiddelde, p95-, maximum- en trage routetijden; er is daarom geen dubbele logging toegevoegd.
- Dashboardcache-invalidatie is uitgebreid voor taken, facturen, activiteiten, inbox-events, scoring en workflows.
- Hierdoor blijven snelle dashboardresponstijden behouden, terwijl wijzigingen in deze modules direct zichtbaar worden zonder handmatige volledige reload.
- De invalidatie blijft workspacegebonden; er worden geen tenant-ID's, secrets of gebruikersdata aan extra logs toegevoegd.

**Verificatie:** `pnpm typecheck`, API-tests (`294 passed / 16 skipped`), webtests (`42 passed`), gerichte ESLint en `git diff --check` geslaagd. Geen databasewijziging, deployment of productiegegevens gewijzigd.

## Fase 50 — Productiebundle-audit (2026-09-12)

- De ontwikkelmeting is onderscheiden van productie: de eerste lokale `/leads/search`-weergave werd vooral beïnvloed door koude Next.js-compilatie.
- De eerste production build liep lokaal tegen de standaard Node-heaplimiet van ongeveer 2 GB aan; met `NODE_OPTIONS=--max-old-space-size=4096` compileert en genereert de build volledig.
- De build bevestigde dat `/leads/search` al een kleine route-shell met dynamische clientmodule gebruikt. De grootste relevante eerste loads zitten bij outbound en instellingen.

**Verificatie:** production build geslaagd met 4 GB Node-heap. Bestaande lintwaarschuwingen blijven informatief en zijn niet stilzwijgend weggewerkt.

## Fase 51 — E-mailinstellingen lazy laden (2026-09-12)

- De visuele e-mailshell-editor en variabelenbibliotheek worden nu dynamisch geladen wanneer de betreffende tab wordt geopend.
- `/settings/email` daalde in de production build van `316 kB` naar `159 kB` First Load JS; de routegrootte daalde van `28.2 kB` naar `11.0 kB`.
- De editorfunctionaliteit, skeleton loading state en tabbediening blijven behouden.

**Verificatie:** production build geslaagd met 4 GB Node-heap, webtests `42 passed`, typecheck en gerichte ESLint geslaagd. Geen databasewijziging, deployment of externe integratie uitgevoerd.

## Fase 48 — Dashboard-prefetch achter sessiecheck (2026-09-12)

- Een browsermeting op een uitgelogde `/dashboard`-request liet zien dat de pagina parallel met de layout alvast `dashboard.getOverview` kon prefetchen.
- Daardoor ontstond onnodig zwaar werk en een `UNAUTHORIZED`-log voordat de layout naar `/login` doorstuurde.
- De dashboardpagina controleert nu zelf eerst `getCurrentUser()` en prefetch’t de overview pas voor een geldige sessie. De bestaande React-cache voorkomt een dubbele sessiequery binnen dezelfde render.
- De lokale healthcheck bleef HTTP 200 geven; er zijn geen productiegegevens of deployments gewijzigd.

**Verificatie:** webtests (`42 passed`), typecheck, ESLint en `git diff --check` geslaagd. Volledige ingelogde browsermetingen zijn lokaal geblokkeerd doordat er geen Playwright/seed-wachtwoord in de env staat; de publieke health- en unauthenticated redirect-check zijn wel lokaal uitgevoerd.

## Fase 49 — Ingelogde browser- en responsive controle (2026-09-12)

- Lokale testaccounts zijn opnieuw gegenereerd via de bestaande localhost-only seedprocedure; credentials zijn niet in de repository of logs geplaatst.
- Playwright `globalSetup` wacht nu op client-hydratatie/network-idle voordat het credentials-formulier wordt aangeklikt. Dit voorkomt een koude-start race waarbij een native form-GET naar `/login?` werd verstuurd.
- Owner, viewer, moderator en member konden lokaal succesvol inloggen.
- Dashboard, leads en lead-detail zijn gecontroleerd; de responsive kernflow slaagde op 375px, 768px en desktop.
- De meetronde vond op dashboard één gebundelde client tRPC-request en geen dubbele request-URL’s of page errors. Leads en lead zoeken gebruikten hun serverprefetch zonder dubbele clientrequests.

**Verificatie:** gerichte Playwright-flow `6 passed`, webtests `42 passed`, eerdere API-tests `294 passed / 16 skipped`, typecheck, ESLint en diffcontrole geslaagd. Open: koude Next-dev-compilatietijden zijn in development nog hoger; dit is geen productie-runtimemeting.

## Fase 52 — Outbound-preview lazy laden (2026-09-12)

- De zware e-mailpreview wordt nu dynamisch geladen in de goedkeuringswachtrij en op de draftdetailpagina.
- De preview wordt daardoor pas opgehaald wanneer het optionele previewgedeelte wordt gerenderd; lijst, editor, goedkeuren en verzenden blijven beschikbaar zonder de previewbundle in de primaire routebundel.
- `/contacts/approval` daalde in de production build van `268 kB` naar `165 kB` First Load JS; `/contacts/drafts/[id]` van `303 kB` naar `199 kB`.
- Bestaande skeleton loading states blijven zichtbaar tijdens het laden van de preview.

**Verificatie:** production build geslaagd met 4 GB Node-heap, webtests `42 passed`, typecheck en gerichte ESLint geslaagd. Geen databasewijziging, deployment of externe integratie uitgevoerd.

## Fase 53 — Template-index sneller laden (2026-09-12)

- De systeemtemplate-editor en previewdialoog worden nu dynamisch geladen wanneer de gebruiker bewerken of preview opent.
- De template-index, filters en zoekfunctie laden zonder de zware editor- en e-mailpreviewbundels.
- `/templates` daalde in de production build van `286 kB` naar `151 kB` First Load JS.
- Bestaande editor-, preview-, opslaan- en navigatiefuncties blijven behouden; de editor toont een skeleton tijdens laden.

**Verificatie:** production build geslaagd met 4 GB Node-heap, webtests `42 passed`, typecheck, gerichte ESLint en `git diff --check` geslaagd. Geen databasewijziging, deployment of externe integratie uitgevoerd.

## Fase 54 — Outbound browser-regressiecontrole (2026-09-12)

- De lokale outbound-smoke-suite is uitgevoerd tegen een geïsoleerde server op poort 3001.
- De lokale testaccounts zijn vooraf opnieuw gegenereerd met het localhost-only resetscript; wachtwoorden zijn niet in logs of documentatie opgenomen.
- De bestaande template-, compose- en Outbound Center-flows slagen.
- Een nieuwe Playwright-regressietest controleert dat template-preview en editor bij interactie laden, de juiste dialoog tonen en weer sluiten.
- De test controleert daarmee ook de nieuwe lazy-loaded componentgrenzen zonder echte e-mails te verzenden.

**Verificatie:** Playwright outbound smoke `6 passed`, webtests `42 passed`, typecheck en `git diff --check` geslaagd. De tijdelijke lokale testserver is gestopt. Geen databasewijziging, deployment of externe integratie uitgevoerd.
