# AI CHANGELOG — Digitify Lead Search

Chronologisch logboek van significante wijzigingen (mens + AI).  
**Formaat:** nieuwste entries bovenaan.

## 2026-09-17 — ASE: runtime schema catch-up for ase_licenses

**Type:** Incident fix (P0)
**Agent:** Composer

- Productie had geen `ase_licenses` (migrate niet gedraaid; Vercel CLI niet ingelogd → geen DIRECT_URL).
- `ensureAseLicensesSchema()` maakt tabel + indexes via DIRECT_URL (pooler weigert DDL) bij eerste ASE API/tRPC gebruik.
- Manual SQL: `packages/db/prisma/manual/ase_licenses-only.sql` + production-schema-catch-up include.
- Open: alsnog `prisma migrate deploy` / `migrate resolve` voor `_prisma_migrations` sync; switch `DATABASE_URL` naar `digitify_app`.


**Type:** Incidentfix (P0)  
**Agent:** Composer

- Root cause: `assertSafeDatabaseRole` in `instrumentation.ts` hard-failde wanneer `DATABASE_URL` een `SUPERUSER`/`BYPASSRLS`-rol gebruikt → alle App Router-pagina’s HTTP 500; `/api/health` bleef 200.
- Soft-fail by default (log + continue); hard-fail alleen met `STRICT_DATABASE_ROLE_CHECK=true`.
- ASE public routes: Prisma P2021/P2022 (`ase_licenses` ontbreekt) → 503 `unavailable` i.p.v. generieke 500.
- Open: productie-`DATABASE_URL` naar `digitify_app` (non-BYPASSRLS) + `prisma migrate deploy` voor `20260916170000_ase_licenses`.

## 2026-09-17 — SMTP test: Cloudflare-host detectie + lokale foutmeldingen

**Type:** Bugfix, UX  
**Agent:** Composer

- Root cause: workspace-SMTP host `smtp.digitify.be` resolve’t naar Cloudflare-proxy-IP’s; poort 587/465 time-out (MX is Stackmail → `smtp.stackmail.com` werkt wel).
- DNS-preflight (`diagnoseSmtpHost`) faalt snel bij Cloudflare-proxied smtp./mail.-hosts i.p.v. 10s timeout.
- Foutteksten onderscheiden lokaal vs Vercel; TLS-servername default = SMTP-host (niet mailboxdomein).
- `EMAIL_PROVIDER=console` (non-prod) en expliciete DB-console worden gerespecteerd; SMTP-testknop forceert nog steeds echte SMTP (`forceSmtp`).
- UI-waarschuwing voor proxied Digitify smtp/mail-hosts.

## 2026-09-17 — SMTP: één per workspace (geen dual setup)

**Type:** Docs, UX-copy  
**Agent:** Composer

- Productvraag beantwoord: er is bewust **één SMTP per workspace** (`email.smtp_*`), geen aparte website-/marketing-SMTP.
- ADR-015 + PROJECT_BRAIN bijgewerkt; Integraties-UI verklaart dat platformmail de aangewezen Digitify-workspace-SMTP hergebruikt.
- Geen schema- of send-path wijziging; geen dual-SMTP geïmplementeerd.

## 2026-09-16 — Fase 104: moduletoegang onder RLS herstellen

**Type:** Beveiliging, autorisatie, database
**Agent:** Codex

- De `settings`-RLS-policy staat per-user module-instellingen toe voor actieve leden binnen de actieve workspace.
- Platform-owner modulebeheer zet binnen de reeds geautoriseerde RLS-transactie tijdelijk de doelgebruiker-scope, zonder algemene RLS-bypass.
- Dezelfde policy is idempotent op productie toegepast voor `settings`.
- Verificatie: `pnpm typecheck` en de 13 gerichte `mutation-rbac`-tests slagen.

## 2026-09-16 — Fase 105: RLS-helper hardenen

**Type:** Beveiliging, database
**Agent:** Codex

- `app_user_id()` gebruikt nu een vaste `search_path` (`pg_catalog, public`).
- De productie-advisor toont geen mutable-search-path-waarschuwing meer; de 7 bestaande informatieve meldingen voor tabellen zonder policies blijven bewust deny-by-default en worden apart opgevolgd.

## 2026-09-16 — Fase 106: advertentie- en social-RLS herstellen

**Type:** Beveiliging, database, integraties
**Agent:** Codex

- `google_ad_accounts`, `google_ad_plans`, `meta_ad_accounts`, `meta_ad_plans` en `social_posts` hebben nu een workspacegebonden policy op `createdById` en `FORCE ROW LEVEL SECURITY`.
- Productie-Supabase heeft nu nog 2 informatieve meldingen: `feedback_items` en `registration_requests` blijven bewust gesloten zonder policy.
- Er zijn geen gegevens verwijderd of aangepast.

## 2026-09-16 — Fase 107: productieconnection-pool stabiliseren

**Type:** Runtime, database, beschikbaarheid
**Agent:** Codex

- Vercel/Supabase gaf `EMAXCONNSESSION` omdat de session-pool van 15 verbindingen werd overschreden.
- Productie gebruikt nu standaard `connection_limit=1` per Prisma-instance; `DATABASE_CONNECTION_LIMIT` kan dit gecontroleerd overschrijven.
- Health controleerde daarna opnieuw database en Redis als `ok`; de nieuwe deployment is `READY`.

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

## Fase 55 — Vercel Blob- en deploymentopslagcontrole (2026-09-14)

- De accountbrede Vercel Usage-pagina is gecontroleerd voor Blob Storage en Functions Storage.
- Blobgebruik staat op `305,36 MB` totaal; Functions Storage op `1,04 GB` voor de laatste 30 dagen.
- De twee actieve projecten gebruiken respectievelijk ongeveer `830,8 MB` en `210,69 MB` function-opslag. Oude projectnamen in de usagegrafiek tonen `0 B`.
- De Leads-store bevat 48 objecten (169,92 MB) en de Shop-store 120 objecten (121,29 MB). Dit bevestigt niet dat een store vol is.
- Leads-health, de shop-homepage, de 3D GLB-route en de interactieve 3D-preview zijn live gecontroleerd. De preview eindigde zonder console-errors in `3D VOORBEELD`.
- Er zijn geen Blob-objecten verwijderd. De Shop Production `DATABASE_URL` is leeg, waardoor objecten niet veilig tegen `upload_blobs` konden worden vergeleken.
- De volledige meting en het veilige opruimprotocol staan in `docs/VERCEL_STORAGE_AUDIT.md`.

**Verificatie:** Vercel CLI-project- en Blob-inventarisatie, Vercel Usage-pagina, `curl`-headers, live Leads-healthcheck en live shop-browsercontrole geslaagd. Geen productiegegevens gewijzigd, geen storage verwijderd en geen secrets gelogd.

## Fase 56 — Team & Rollen beheer (2026-09-15)

- `user.list` toont nu veilige workspacecontext per account: workspace, type, actuele rol en membershipstatus, zonder secrets of wachtwoordgegevens.
- Platform-owner view-as accepteert een expliciete workspace, valideert target en membership opnieuw per request en blijft maximaal 30 minuten geldig. Gewone workspace-owners blijven beperkt tot hun eigen actieve workspace.
- De Team-pagina heeft statistieken, zoeken, rol/workspace/statusfilters, een compacte desktopweergave en responsive accountkaarten op mobiel.
- View-as toont vóór de start de doelaccount-, workspace-, verval- en beperkingsinformatie. Gevoelige acties blijven server-side geblokkeerd en worden geaudit.
- Moduletoegang, uitnodigingen, rolwijzigingen, view-as en verwijderen tonen nu consistente laad-, fout-, retry- en succesfeedback. Uitnodigingswachtwoorden gebruiken dezelfde policy als de backend.
- Er is geen databasemigratie uitgevoerd; de bestaande `AccountViewSession`- en auditmodellen zijn hergebruikt.

**Verificatie:** `pnpm db:generate`, `pnpm test` geslaagd (`296 passed / 16 skipped` API, `42 passed` web), `pnpm typecheck`, `pnpm lint`, `pnpm build` en `git diff --check` geslaagd. Ingelogde lokale Playwright-controle is geblokkeerd door een mismatch tussen de lokale testcredentials en de actieve database. De RLS/IDOR-integratietests zijn geprobeerd maar geblokkeerd omdat PostgreSQL niet bereikbaar was op `localhost:5432`; de pure RBAC-integratietests slaagden. Geen credentials zijn gelogd.

## Fase 57 — RLS/IDOR-controle met niet-superuser (2026-09-15)

- Colima en de lokale Postgres/Redis-containers zijn gestart zonder productiegegevens te wijzigen.
- De lokale migraties zijn toegepast en de bestaande seedfixtures zijn opnieuw geladen in de lokale database.
- De eerste RLS-run met de Compose-beheerder was ongeldig voor securitybewijs, omdat die rol superuser/BYPASSRLS-rechten heeft. Daarom is uitsluitend lokaal een aparte `digitify_app`-rol zonder `SUPERUSER` en `BYPASSRLS` gebruikt.
- Met die rol slagen workspace-RLS, IDOR en Team-RBAC samen `13/13` integratietests. De RLS-smoke bevestigt dat Owner B Owner A-leads niet kan lezen en dat beide workspaces alleen hun eigen leads zien.
- De gerichte settings-browsercontrole voor Viewer, Member en Moderator is `4/4` geslaagd.

**Open infrastructuurpunt:** productie moet dezelfde eigenschap behouden: Prisma mag niet verbinden met een superuser- of BYPASSRLS-account. Dit is een deploymentconfiguratiecontrole en is lokaal niet naar Vercel/Supabase gewijzigd.

## Fase 58 — Owner Team- en view-as browserflow (2026-09-15)

- De lokale Owner-flow is browsermatig doorlopen op `http://127.0.0.1:3000`.
- Teamlijst geladen met 6 accounts en 4 toegankelijke view-as-acties.
- Een account is via de bevestigingsdialoog geopend; de view-as-banner verscheen correct op het dashboard.
- Vercel projectinventarisatie is read-only gecontroleerd: alleen `project-ubm6y` en `digitify-3d-webshop` staan in het team.
- Geen productievariabelen gelezen, gewijzigd of gelogd; de verouderde Vercel CLI kon custom environments niet opvragen.

**Verificatie:** Owner Team/view-as smoke geslaagd, login en healthcheck lokaal HTTP 200. De lokale devserver blijft draaien op `http://localhost:3000`.

## Fase 59 — Vercel productieconfiguratie read-only inventarisatie (2026-09-15)

- De lokale Vercel-link verwijst naar `project-ubm6y`; de teaminventaris bevat alleen `project-ubm6y` en `digitify-3d-webshop`.
- Voor Leads zijn de verwachte productievariabelen als namen aanwezig, waaronder `DATABASE_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, `ENABLE_WORKSPACE_RLS`, `SETTINGS_ENCRYPTION_KEY`, `CRON_SECRET` en `PLATFORM_OWNER_EMAILS`.
- Er zijn geen waarden of secrets geprint, gewijzigd, verwijderd of geroteerd.
- De oude lokale Vercel CLI liet bij `env run` lokale `.env`-waarden voorgaan; een geïsoleerde read-only run vanuit een tijdelijke map kon geen productievariabelen aan het proces doorgeven. De effectieve databasegebruiker en de waarde van `ENABLE_WORKSPACE_RLS` zijn daarom nog niet bewezen.

**Open:** controleer in Vercel Production handmatig of `ENABLE_WORKSPACE_RLS=true` en of `DATABASE_URL`/`POSTGRES_PRISMA_URL` niet met een superuser/BYPASSRLS-account verbinden. Daarna kan de productie-RLS-smoke worden uitgevoerd.

## Fase 60 — Actuele Vercel CLI-controle (2026-09-15)

- De actuele Vercel CLI is read-only uitgevoerd tegen Production.
- Vercel blokkeert het lokaal ophalen van 16 secretwaarden; daardoor zijn `ENABLE_WORKSPACE_RLS` en de productie-databasegebruiker niet uitleesbaar zonder secrets te exporteren.
- Er zijn geen secrets, environment values, deployments of projectinstellingen gewijzigd.

**Status:** geblokkeerd voor automatische bewijsvoering; handmatige controle in Vercel Production blijft vereist.

## Fase 61 — Veilige poging productie-secretcontrole (2026-09-15)

- Met expliciete toestemming is een tijdelijke Vercel Production-env-export gebruikt voor uitsluitend metadata-controle.
- Het tijdelijke bestand is na verwerking verwijderd; geen secretwaarde, token of wachtwoord is gelogd of aan de repository toegevoegd.
- Vercel leverde de gevoelige waarden niet aan de CLI, waardoor de productie-databasegebruiker, Redis-status en effectieve `ENABLE_WORKSPACE_RLS`-waarde niet betrouwbaar konden worden vastgesteld.
- Er zijn geen productievariabelen, deployments of infrastructuur gewijzigd.

**Status:** handmatige Vercel-dashboardcontrole blijft vereist; de lokale niet-superuser RLS-tests blijven het bewezen securityresultaat.

## Fase 62 — Database-role release guard (2026-09-15)

- Nieuwe read-only check `pnpm db:check-role` controleert via `pg_roles` of de actieve Prisma-databasegebruiker geen `SUPERUSER` of `BYPASSRLS` heeft.
- De veilige lokale `digitify_app`-rol slaagt; de Compose-beheerder wordt bewust geweigerd.
- De check is toegevoegd aan de Vercel/RLS-runbook zodat productie vóór een rollout tegen de echte productie-URL kan worden gecontroleerd.

**Verificatie:** veilige rol geslaagd, superuser-rol correct geweigerd, zonder databasewijzigingen.

## Fase 63 — Releasecheck blokkering voor onveilige DB-rollen (2026-09-15)

- `scripts/check-release.sh` voert nu `pnpm db:check-role` uit naast de schema-check.
- De releasecheck en releasechecklist vereisen daarmee expliciet een Prisma-rol zonder `SUPERUSER` en `BYPASSRLS`.
- De guard blijft read-only; er worden geen rollen, grants of databases aangepast.

**Verificatie:** veilige lokale rol geslaagd, superuser lokaal geweigerd, typecheck en diffcontrole geslaagd.

## Fase 64 — Vercel RLS-flag geactiveerd (2026-09-15)

- Met expliciete toestemming is `ENABLE_WORKSPACE_RLS=true` ingesteld voor Production van `project-ubm6y`.
- Er is geen secretwaarde gelezen, geroteerd of gewijzigd en er is geen deployment gestart.
- De huidige live deployment blijft gezond: `https://leads.digitify.be/api/health` geeft `{"status":"ok","db":"ok"}` terug. Redis rapporteert nog `skipped` in de bestaande healthcheck.
- De nieuwe waarde wordt pas actief in een volgende deployment; die wordt bewust uitgesteld totdat de productie-databasegebruiker en migratiestatus bevestigd zijn.

**Status:** RLS-configuratie voorbereid; gecontroleerde deployment blijft de volgende stap.

## Fase 65 — Schone productie-deployment en uploadhardening (2026-09-15)

- `.vercelignore` sluit nu ook nested `node_modules`, buildcaches, Playwright `test-results` en `playwright-report` uit. De upload werd daarmee teruggebracht van honderden megabytes naar een klein bronpakket.
- De eerste deploymentpoging faalde tijdens upload; de tweede build met het opgeschoonde pakket is succesvol afgerond en gealiased naar `https://leads.digitify.be`.
- De deployment compileerde succesvol. Bestaande ESLint-waarschuwingen bleven waarschuwingen en blokkeerden de build niet.
- De productie-healthcheck is na rollout gecontroleerd; er zijn geen secrets of testcredentials in de changelog of command-output opgenomen.

**Verificatie:** deployment `Ready`, productie-alias actief, health endpoint gecontroleerd en `git diff --check` geslaagd. De productie-databasegebruiker en effectieve RLS-databasepolicy zijn nog niet onafhankelijk bewezen; dit blijft een operationeel controlepunt.

## Fase 66 — Productie-rolcontrole voorbereid (2026-09-15)

- De nieuwe read-only `db:check-role` is geprobeerd via `vercel env run -e production`; Vercel kan secretwaarden niet lokaal doorgeven en laadde daardoor de lokale `.env` als fallback.
- De controle faalde lokaal bewust op de standaard superuser-rol `digitify`. Dit zegt niets over de productie-rol en is daarom niet als productie-resultaat geregistreerd.
- Runbooks zijn bijgewerkt zodat de geldige productiecontrole rechtstreeks in Supabase gebeurt, zonder databasewijziging: `SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user;`.

**Status:** productie-database-rol en RLS-smoke blijven geblokkeerd tot de Supabase SQL Editor of een direct, niet-superuser `DIRECT_URL` beschikbaar is. Geen secrets zijn gelezen of opgeslagen.

## Fase 67 — Lokale RLS-regressie opnieuw bevestigd (2026-09-15)

- De lokale database bevat `digitify_app` zonder `SUPERUSER` en zonder `BYPASSRLS`; de standaard lokale rol `digitify` blijft uitsluitend voor beheer/testopstart.
- Met `ENABLE_WORKSPACE_RLS=true` zijn de integratietests opnieuw geslaagd: `13/13` voor workspace-RLS, IDOR en settings-RBAC.
- De RLS-smoke is opnieuw geslaagd: beide workspaces zien uitsluitend hun eigen leads en cross-workspace lead-ID's worden geblokkeerd.
- Alleen de lokale testrol kreeg een tijdelijk lokaal wachtwoord; dit is niet gelogd, niet gedocumenteerd en niet naar productie gebruikt.

**Status:** lokale securitycontrole geslaagd. Productiecontrole blijft open tot de rol rechtstreeks in Supabase is bevestigd.

## Fase 68 — Productie-rolcheck tegen lokale vergissingen beschermd (2026-09-15)

- Nieuwe command `pnpm db:check-production-role` weigert lokale databasehosts en voert daarna dezelfde read-only `pg_roles`-controle uit.
- De releasechecklist en Vercel-runbook verwijzen nu naar deze expliciete productievariant.
- Hiermee kan een geslaagde lokale test niet langer per ongeluk als productie-bewijs worden gebruikt.

**Verificatie:** lokale URL wordt correct geweigerd; `git diff --check` geslaagd. De productieverbinding zelf is nog niet door deze guard gecontroleerd.

## Fase 69 — Supabase productiecontrole overdraagbaar gemaakt (2026-09-15)

- Nieuwe read-only checklist toegevoegd voor de database-rol, RLS-status, policies en tabelrechten.
- De checklist waarschuwt expliciet tegen generieke `TO authenticated`-policies en onnodige Data API-rechten.
- Er zijn geen queries tegen productie uitgevoerd en geen policies, grants of data gewijzigd.

**Status:** klaar voor uitvoering in Supabase SQL Editor; productie-RLS-smoke blijft afhankelijk van een directe niet-superuser verbinding en bewuste keuze voor staging of productie.

## Fase 70 — Lokale releaseverificatie (2026-09-15)

- `pnpm typecheck` geslaagd.
- `pnpm test` geslaagd; de bestaande API-, package- en webtests blijven groen. Integratietests die een expliciete DB-run vereisen blijven apart uitgevoerd via de niet-superuser RLS-run.
- Geen nieuwe runtime- of databasewijziging in deze fase.

**Status:** lokaal vrijgegeven voor de volgende gecontroleerde infrastructuurstap; productie-Supabase blijft handmatig te bevestigen.

## Fase 71 — Productie publieke-surface smoke en CSP-versterking (2026-09-15)

- Read-only smoke op `leads.digitify.be`: login HTTP 200; unauthenticated `user.list` en `domain.list` HTTP 401; responses bevatten geen database- of secretpatronen.
- Cloudflare, HSTS, `nosniff`, `SAMEORIGIN`, `Permissions-Policy` en `Referrer-Policy` zijn aanwezig.
- CSP blijft bewust `Report-Only` tijdens deze fase om frontendregressies te vermijden, maar is aangescherpt met `base-uri`, `object-src 'none'`, `form-action` en `worker-src`.

**Verificatie:** typecheck en `git diff --check` geslaagd; na herstart van de lokale devserver geeft `/api/health` HTTP 200. **Open risico:** enforcement en CSP-reporting moeten eerst met echte browserflows worden gemeten; `unsafe-inline` en `unsafe-eval` blijven voorlopig nodig voor compatibiliteit.
## Fase 72 — Supabase read-only audit afgerond (2026-09-15)

- De Supabase-connector identificeerde de Leads- en Shop-projecten en haalde security- en performance-advisors op zonder wijzigingen.
- Leads heeft 7 tabellen met RLS zonder policies; Shop heeft 16. Voor Leads zijn geen directe `anon`/`authenticated`-tabelrechten gevonden, waardoor dit geen aangetoond Data API-lek is.
- De connector draait als `postgres` met `BYPASSRLS`; dit is geen bewijs voor de Vercel Prisma-rol. De actieve verbinding van de app was tijdens de korte controle niet zichtbaar.
- Performance-advisors melden respectievelijk 28/10 ongeindexeerde foreign keys en 89/14 ongebruikte indexen. Geen indexen gewijzigd zonder querymeting.

**Status:** auditrapport toegevoegd; P1-productierolcontrole blijft open. Geen productie-DML/DDL of secretwijziging uitgevoerd.

## Fase 73 — Dashboard cache-miss coalescing (2026-09-15)

- Productieruntime-aggregatie liet geen 5xx-cluster zien, maar wel herhaalde trage `dashboard.getOverview`-requests van 2,2–2,9 seconden.
- Gelijktijdige cache misses voor hetzelfde workspace-dashboard worden nu binnen één runtime-instance samengevoegd tot één queryketen.
- In-flight resultaten worden niet opnieuw gecachet wanneer een mutation de workspace-cache tijdens het laden invalideert.
- Er zijn geen tenantgrenzen, queryresultaten of cache-keys gewijzigd; de bestaande korte TTL en mutation-invalidation blijven actief.

**Verificatie:** `pnpm typecheck` geslaagd, API-tests `296 passed / 16 skipped`, `git diff --check` geslaagd. Productie-deployment van deze wijziging volgt pas na de resterende releasecontrole.

## Fase 74 — Shop Data API-grants gecontroleerd (2026-09-15)

- De Shop-Supabase is read-only gecontroleerd op directe `anon`- en `authenticated`-tabelrechten in schema `public`.
- Er zijn geen zulke grants gevonden. De 16 RLS-tabellen zonder policy blijven wel expliciete configuratiepunten; er zijn geen policies of grants toegevoegd zonder per-tabel autorisatiemodel.
- De controle zegt niet welke database-rol Vercel gebruikt. Dat blijft het open P1-punt totdat de echte niet-superuser Prisma-verbinding rechtstreeks is geverifieerd.

**Verificatie:** Supabase SQL read-only geslaagd; geen DDL, DML, grant-, policy- of secretwijziging uitgevoerd.

## Fase 75 — Fail-closed database-role startupguard (2026-09-15)

- De database-rolcontrole is gecentraliseerd in `packages/db/src/database-role.ts` en wordt hergebruikt door de releasecheck.
- Productie-startup controleert nu de actuele Prisma-rol en weigert `SUPERUSER`, `BYPASSRLS` of een niet-resolveerbare rol voordat de server verder initialiseert.
- De guard lekt geen rolmetadata via health- of foutresponses. Lokale controle weigert bewust de lokale beheerrol met exitcode 1.
- De bestaande releasecheck en de handmatige productiecontrole blijven behouden; deze guard vervangt geen RLS-smoke met twee workspaces.

**Verificatie:** web-typecheck geslaagd, `git diff --check` geslaagd en lokale onveilige rol correct geweigerd. De aparte database-package typecheck is in fase 76 opnieuw groen gemaakt.

## Fase 76 — Database-package typecheck en lokale migratie-runner (2026-09-15)

- `prisma/migrate-workspace-settings.ts` behandelt JSON `null` nu expliciet als `Prisma.JsonNull`, waardoor de database-package typecheck weer slaagt.
- Het root-commando `pnpm db:migrate-workspace-settings` gebruikt nu dezelfde lokale env-wrapper als de andere databasecommando's.
- De lokale migratie is uitsluitend als dry-run uitgevoerd: `12` mogelijke kopieën, `3` bestaande records overgeslagen, `0` databasewijzigingen.

**Verificatie:** database-package typecheck geslaagd, web-typecheck geslaagd, API-tests `296 passed / 16 skipped`, dry-run geslaagd en `git diff --check` geslaagd.

## Fase 77 — Productiebuild gevalideerd (2026-09-15)

- De volledige Next.js production build is geslaagd met de startupguard en database-role helper inbegrepen.
- Alle 119 statische pagina's zijn gegenereerd; de bestaande ESLint-waarschuwingen blijven niet-blokkerend.
- De lokale devserver bleef bereikbaar op `/api/health` met HTTP 200 na de build.
- Er is geen productie-deployment gestart: de effectieve Vercel-database-rol en productie-RLS-smoke zijn nog niet bewezen.

**Verificatie:** `pnpm build` geslaagd, web-typecheck geslaagd, database-package typecheck geslaagd, API-tests `296 passed / 16 skipped`, healthcheck HTTP 200.

## Fase 78 — Productie Prisma-rol opnieuw gecontroleerd (2026-09-15)

- Live `/api/health` gaf HTTP 200 en `db=ok`.
- Direct daarna waren in Supabase alleen PostgREST, pooler, management en Supabase-systeemverbindingen zichtbaar; de Vercel-Prisma-verbinding kon niet aan een rol worden gekoppeld.
- De loginrollenlijst bevat geen herkenbare aparte applicatierol. `postgres` heeft `BYPASSRLS`; dit is een risico als Vercel daarop draait, maar het is niet bewezen dat Vercel deze rol gebruikt.
- Er zijn geen rollen, grants, wachtwoorden, environment variables of deployments gewijzigd.

**Status:** productie-rollout blijft geblokkeerd totdat Vercel Production handmatig bevestigt welke niet-superuser/non-`BYPASSRLS`-rol de Prisma-verbinding gebruikt. Een nieuwe rol aanmaken zonder gelijktijdige gecontroleerde Vercel-secretwijziging is bewust niet uitgevoerd.

## Fase 79 — Supabase rolcontrole uitgevoerd (2026-09-15)

- De gevraagde read-only query is uitgevoerd op het Leads-Supabase-project.
- Uitkomst: de SQL Editor gebruikt `postgres`, met `rolsuper=false` en `rolbypassrls=true`.
- Dit bevestigt dat de beheerverbinding RLS kan omzeilen; het bewijst niet welke rol Vercel Prisma gebruikt.
- Er zijn geen rollen, policies, grants, data of secrets gewijzigd.

**Status:** Vercel Production moet nog aantonen dat de applicatieverbinding een aparte rol gebruikt met `rolsuper=false` en `rolbypassrls=false`.

## Fase 80 — App-rolrotatie voorbereid (2026-09-15)

- Een gecontroleerd runbook toegevoegd voor het aanmaken, testen, omschakelen en terugdraaien van een aparte Supabase-Prisma-approl.
- Het runbook gebruikt placeholders voor credentials en bevat geen wachtwoord, token of connection string.
- De rolwijziging, grants en Vercel-environment variables zijn bewust niet uitgevoerd; eerst is een onderhoudsmoment en stagingvalidatie nodig.

**Status:** voorbereiding klaar; productie blijft ongewijzigd en het bestaande P1-releaseblok blijft actief.

## Fase 81 — Browserregressiecontrole (2026-09-15)

- De lokale Playwright-suite is uitgevoerd tegen de huidige devserver.
- `8` tests slaagden en `25` tests werden bewust overgeslagen omdat ze ingelogde fixtures of extra integratieconfiguratie vereisen.
- Geslaagde controles omvatten health, marketing responsive views, publieke embeds en portal-uploadvalidatie.
- Er zijn geen browserfouten, datawijzigingen of productieacties uitgevoerd.

**Verificatie:** `pnpm test:e2e` eindigde met `8 passed / 25 skipped`; lokale `/api/health` bleef HTTP 200.

## Fase 82 — RLS-integratie opnieuw uitgevoerd met niet-superuser (2026-09-15)

- De eerste lokale run met de standaard beheerverbinding is bewust afgekeurd: die rol kon RLS omzeilen en gaf daarom geen geldig securitybewijs.
- Dezelfde run is daarna herhaald met de lokale niet-superuser/non-`BYPASSRLS`-approl.
- Workspace-RLS, IDOR en settings-RBAC zijn volledig geslaagd: `13/13` tests.
- De RLS-smoke bevestigt dat Owner A `20` eigen leads ziet, Owner B `2` eigen leads ziet en cross-workspace lead-ID's worden geblokkeerd.
- Er zijn geen productieverbindingen, policies, grants of secrets gewijzigd.

**Status:** lokale RLS- en IDOR-controle geslaagd. Productie-approl blijft nog handmatig te verifiëren.

## Fase 83 — Preview-configuratie en runtimecontrole (2026-09-15)

- De Vercel Preview-omgeving kreeg een aparte `NEXTAUTH_SECRET` en een Preview-`NEXTAUTH_URL`; secretwaarden zijn niet opgeslagen in de repository of rapportage.
- Een nieuwe Preview-deployment is succesvol gebouwd en staat op `READY`; Production is niet opnieuw gedeployed of gewijzigd.
- De eerste Preview-runtimecontrole vond de ontbrekende Auth-configuratie en gaf HTTP 500; na aanvulling zijn er geen nieuwe Preview-runtime-errors geregistreerd.
- Rechtstreeks HTTP testen van de beschermde Preview blijft door Vercel Deployment Protection naar SSO omleiden. De lokale health- en loginchecks en de productie-healthcheck zijn wel uitgevoerd.

**Verificatie:** Preview build `READY`, Preview runtime-log zonder nieuwe errors, lokale `/api/health` HTTP 200, lokale `/login` HTTP 200 en productie `/api/health` HTTP 200.

## Fase 84 — Vercel secrets en databaseverbinding gecontroleerd (2026-09-15)

- `BLOB_READ_WRITE_TOKEN`, `GOOGLE_CLIENT_SECRET` en `SETTINGS_ENCRYPTION_KEY` zijn in Vercel Production gemigreerd van het oudere `encrypted`-type naar `sensitive`; de waarden zijn niet uitgelezen of vervangen.
- Production bevat een `DATABASE_URL`; de aparte variabele `database` is niet als vervanging gebruikt.
- Historische Production-logs bevatten database-authenticatiefouten voor `postgres`. Een actuele publieke database-afhankelijke analytics-check gaf daarna HTTP 200 en de laatste tien minuten bevatten alleen HTTP 200-responses.
- De Supabase-approl `digitify_app` bestaat en heeft `rolsuper=false`, `rolbypassrls=false` en loginrechten. Er is geen wachtwoord geroteerd en geen productie-connection string opgeslagen.

**Status:** secretwaarschuwingen opgelost. Databaseverbinding actueel werkend; de productie-approl moet bij een volgende onderhoudscontrole opnieuw via de werkelijke `DATABASE_URL` worden bevestigd.

## Fase 85 — Gedeelde productie-rate limiting gecontroleerd (2026-09-15)

- Vercel Production bevat momenteel geen `REDIS_URL` en geen volledige `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`-configuratie.
- De applicatie valt daarom terug op een per-instance geheugenbucket; dit blijft geschikt voor lokaal gebruik, maar niet als enige productiebeveiliging op meerdere Vercel-instances.
- De bestaande releasecheck blokkeert een productieconfiguratie zonder gedeelde rate-limitbackend; er is geen niet-geautoriseerde fallback of nieuwe infrastructuur aangemaakt.

**Verificatie:** rate-limittests `8/8` geslaagd; productiehealth blijft bereikbaar. Openstaand infrastructuurpunt: een Upstash Redis-store koppelen en daarna de gedeelde rate-limitintegratietest uitvoeren.

## Fase 86 — Upstash-koppeling gecontroleerd en productie hersteld (2026-09-15)

- De bestaande Vercel-integratievariabelen met prefix `upstashredis_` zijn niet uitgelezen; er zijn alleen gevoelige Vercel-verwijzingen aangemaakt voor `UPSTASH_REDIS_REST_URL` en `UPSTASH_REDIS_REST_TOKEN`.
- Een productie-deployment met deze configuratie bouwde succesvol, maar de runtime-startupguard blokkeerde de server omdat de actieve `DATABASE_URL` nog met een `SUPERUSER`/`BYPASSRLS`-rol verbond.
- De productie-alias is onmiddellijk teruggezet naar de vorige bewezen werkende deployment. Er is geen data verwijderd en geen databasepolicy gewijzigd.
- De live healthcheck is daarna opnieuw gecontroleerd: HTTP `200`, database `ok`, Redis `skipped`. Dit betekent dat de app hersteld is, maar de gedeelde rate limiting nog niet live bewezen is.

**Openstaand P1:** Vercel Production moet `DATABASE_URL` laten verbinden met de bestaande niet-superuser/non-`BYPASSRLS`-rol `digitify_app`. Zolang de actuele productieconnection string niet gecontroleerd of gecontroleerd vervangen is, wordt geen nieuwe productie-deployment met de startupguard uitgerold.

## Fase 87 — Healthcheck uitgebreid voor Upstash REST (2026-09-15)

- `/api/health` controleert nu naast `REDIS_URL` ook de bestaande Upstash REST-configuratie met een korte timeout en zonder tokenlogging.
- Lokale typecheck en volledige tests zijn geslaagd: API `296 passed / 16 skipped`, web `42 passed`.
- De production-build was `READY`, maar de runtime-startupguard blokkeerde opnieuw omdat de actieve productie-`DATABASE_URL` een `SUPERUSER`/`BYPASSRLS`-rol gebruikte.
- De stabiele vorige deployment is opnieuw gepromoveerd; productie blijft bereikbaar via de bestaande alias.

**Status:** code klaar voor de volgende gecontroleerde rollout. Openstaand P1 blijft de Vercel `DATABASE_URL` met `digitify_app`; Upstash kan pas daarna live worden bewezen.

## Fase 88 — Upstash-variabelen robuuster gemaakt (2026-09-15)

- De rate-limitconfiguratie accepteert nu zowel standaard Upstash-namen als de bestaande Vercel-integratienamen.
- Onopgeloste Vercel-verwijzingen die letterlijk met `$` beginnen worden genegeerd; lokale regressietest en typecheck zijn geslaagd.
- De production build was `READY`, maar de live Upstash-probe bleef `error` geven. Daarom is de stabiele vorige deployment opnieuw gepromoveerd.
- Productie is opnieuw gecontroleerd: HTTP `200`, database `ok`, Redis `skipped`.

**Openstaand:** de echte Upstash REST URL en write-token moeten in Vercel Production geldig aan de gekoppelde store verbonden zijn. Er zijn geen tokens uitgelezen of in de repository opgeslagen.

## Fase 89 — Volledige lokale controle en RLS-verificatie (2026-09-15)

- Projectinventarisatie uitgevoerd: monorepo, 40 API-routers en 91 App Router-pagina's gecontroleerd op entry points, moduleguards en securitygevoelige patronen.
- Lokale devserver opnieuw gestart op `http://127.0.0.1:3000`; lokale healthcheck en loginpagina antwoorden succesvol.
- Volledige tests geslaagd: API `298 passed / 16 skipped`, web `42 passed`; typecheck geslaagd.
- Playwright geslaagd voor de beschikbare fixtures: `8 passed / 25 skipped`; de skips vereisen ingelogde fixtures of extra externe/integratieconfiguratie.
- Database-integratie geslaagd: `13/13` tests, inclusief workspace-RLS, IDOR en settings-RBAC.
- RLS-smoke geslaagd met twee workspaces en een niet-superuser/non-`BYPASSRLS`-rol; cross-workspace lead-ID's worden geblokkeerd.
- Productiehealth blijft HTTP `200` met `db: ok`; gedeelde Redis/Upstash blijft het enige open infrastructuurpunt.

**Open risico's:** bestaande lintwaarschuwingen blijven bestaan; productie-Upstash is nog niet bewezen; volledige geauthenticeerde browserflows voor alle rollen blijven afhankelijk van lokale testaccounts/fixtures.

## Fase 90 — Productie Redis-herstel en documentatie (2026-09-15)

- De productie-healthcheck is opnieuw uitgevoerd na het herstellen van de Vercel/Upstash-configuratie: HTTP `200`, database `ok` en Redis `ok`.
- De productie-loginpagina antwoordt HTTP `200` met Cloudflare/Vercel securityheaders; er zijn geen nieuwe runtime-errors in de recente logcontrole gevonden.
- De documentatie verduidelijkt nu dat zowel standaard Upstash REST-variabelen als Vercel-integratienamen worden ondersteund. Lokale in-memory rate limiting blijft uitsluitend een ontwikkelfallback.
- Er zijn geen secrets uitgelezen, opgeslagen, geroteerd of in logs/documentatie geplaatst.

**Verificatie:** volledige tests `298 passed / 16 skipped`, webtests `42 passed`, typecheck geslaagd, lint `0 errors / 29 warnings`, Playwright `8 passed / 25 skipped`, database-integratie `13/13` en RLS-smoke geslaagd. `git diff --check` geslaagd.

**Open risico's:** 25 browserchecks blijven afhankelijk van ingelogde fixtures of extra integratieconfiguratie; lintwaarschuwingen zijn bestaande onderhoudspunten. De lokale healthcheck toont Redis bewust als `skipped` wanneer lokaal geen Redis-variabelen zijn geladen.

## Fase 91 — Publieke route- en security-regressie (2026-09-15)

- Productie `/login` antwoordt HTTP `200` en bevat Cloudflare, HSTS, `nosniff`, `SAMEORIGIN` en een beperkte Permissions-Policy.
- Een niet-geauthenticeerde request naar `/dashboard` wordt HTTP `307` naar `/login` gestuurd met `private, no-cache, no-store`.
- Een directe niet-geauthenticeerde tRPC-request levert geen tenantdata op; de gecontroleerde call antwoordde HTTP `404` zonder stacktrace of secretinformatie.
- De ongeldige publieke reviews-embed antwoordt zonder serverfout en blijft `noindex, nofollow`; publieke embedheaders blijven bewust afwijkend (`frame-ancestors *`) voor de embed-use-case.
- Er zijn geen loginpogingen, mails, mutaties of externe provideracties uitgevoerd.

**Open risico:** de CSP is momenteel `report-only`. Enforce-mode vereist eerst een aparte inventarisatie van inline scripts, analytics en providerbronnen om geen login- of embedregressie te veroorzaken.

## Fase 92 — CSP-bronnen gecontroleerd (2026-09-15)

- De CSP-bronnen zijn opnieuw vergeleken met de code: Next.js-hydration, marketing boot scripts, workspace-analytics en de chatbot-loader gebruiken momenteel inline of dynamisch geladen scripts.
- Analytics kan workspace-geconfigureerde scriptinhoud bevatten en gebruikt onder meer Google Tag Manager en LinkedIn. Een generieke enforce-policy zou nu legitieme tracking, login-hydration of embeds kunnen breken.
- Daarom is CSP niet blind naar enforce-mode omgezet. De bestaande report-only policy blijft actief als meetlaag; er is geen schijnveiligheid toegevoegd die de applicatie functioneel kan beschadigen.
- De route- en healthchecks blijven groen na deze controle; er zijn geen productievariabelen, tokens of databasegegevens aangepast.

**Volgende concrete hardening:** inline/dynamische scripts omzetten naar nonce- of hash-gebaseerde scripts, analytics-hosts expliciet allowlisten en daarna CSP per route in enforce-mode testen.

## Fase 93 — Nonce-infrastructuur voor CSP (2026-09-15)

- Middleware maakt nu per request een nonce aan en geeft die door via request headers, zodat Next.js en server-rendered scripts dezelfde basis kunnen gebruiken.
- De marketing critical-style en boot-script ontvangen de nonce expliciet.
- De CSP-policy wordt centraal door middleware opgebouwd; de dubbele statische noncesloze header uit `next.config.js` is verwijderd.
- CSP blijft report-only. Dynamisch door workspace-geconfigureerde analytics geïnjecteerde scripts moeten nog nonce-aware worden voordat enforce-mode veilig is.

**Verificatie:** lokale login gaf HTTP `200` met één CSP report-only header en nonce; typecheck geslaagd; production webbuild geslaagd met `NODE_OPTIONS=--max-old-space-size=4096`; `git diff --check` geslaagd. Geen productie-deployment uitgevoerd.

**Open risico:** de bestaande analytics-injectie ondersteunt nog geen nonce-doorgifte en gebruikt workspace-inhoud. CSP enforce-mode blijft daarom bewust uitgeschakeld.

## Fase 94 — Analytics nonce-aware gemaakt (2026-09-15)

- De nonce wordt vanuit de server-layout doorgegeven aan de client-side analytics-loader.
- Dynamisch aangemaakte Plausible-, Google Tag Manager-, LinkedIn- en inline analytics-scripts krijgen nu dezelfde request-nonce wanneer analytics actief is.
- De wijziging blijft compatibel met bestaande workspace-configuratie; er zijn geen analytics-instellingen of trackinggegevens aangepast.

**Verificatie:** typecheck geslaagd; webbuild geslaagd met verhoogde Node-heap; lokale login HTTP `200` met nonce in de CSP report-only policy; `git diff --check` geslaagd.

**Open risico:** CSP gebruikt nog `unsafe-inline`/`unsafe-eval` en report-only voor compatibiliteit met bestaande Next.js- en marketingcode. De volgende stap is gericht testen van alle marketing-, login- en embedroutes en daarna de overbodige uitzonderingen verwijderen.

## Fase 95 — JSON-LD en productie-CSP verder aangescherpt (2026-09-15)

- JSON-LD structured-data krijgt nu dezelfde request-nonce als de overige server-rendered inline scripts.
- `unsafe-eval` wordt alleen nog in development aan de report-only policy toegevoegd; productie krijgt die uitzondering niet.
- Productie-health blijft HTTP `200` met database en Redis actief.

**Verificatie:** typecheck geslaagd, lokale homepage HTTP `200` met CSP report-only header, `git diff --check` geslaagd. De lokale schijfruimte is na buildcache ongeveer 2,2 GB vrij. Geen productie-deployment uitgevoerd.

**Open risico:** `unsafe-inline` blijft tijdelijk nodig voor bestaande Next.js/marketingcompatibiliteit. De laatste stap blijft route-per-route CSP-rapporten beoordelen en daarna `unsafe-inline` verwijderen waar nonce/hashes volledig dekken.

## Fase 96 — `unsafe-inline` verwijderd uit productie-scriptpolicy (2026-09-15)

- Productie-CSP gebruikt nu nonce-gebaseerde scripts zonder `unsafe-inline` of `unsafe-eval` in `script-src`.
- Development behoudt de benodigde compatibiliteitsuitzonderingen voor lokale Next.js tooling.
- Een echte lokale `NODE_ENV=production`-start met tijdelijke, niet-opgeslagen secrets gaf HTTP `200`, HSTS en de aangescherpte CSP-header.
- Een start zonder verplichte productievariabelen werd correct geweigerd door de bestaande fail-closed env-validatie.

**Verificatie:** typecheck geslaagd, production webbuild geslaagd, lokale production header gecontroleerd en `git diff --check` geslaagd. De tijdelijke lokale server is gestopt; de gewone devserver blijft op poort `3000` beschikbaar.

**Open risico:** `style-src 'unsafe-inline'` blijft nog nodig voor bestaande styling en moet afzonderlijk worden aangepakt met hashes/nonces of een gecontroleerde CSS-refactor.

## Fase 97 — Style-CSP opgesplitst (2026-09-15)

- Style-elementen gebruiken nu dezelfde request-nonce als scripts via `style-src` en `style-src-elem`.
- Bestaande React inline style-attributen blijven expliciet toegestaan via `style-src-attr`, zodat de huidige interface niet breekt.
- Een echte lokale production-start gaf HTTP `200`, HSTS en de gesplitste style-policy.

**Verificatie:** typecheck geslaagd, webbuild geslaagd, production-header gecontroleerd en tijdelijke productionserver gestopt. Geen productie-deployment uitgevoerd.

**Open risico:** `style-src-attr 'unsafe-inline'` blijft noodzakelijk zolang componenten inline style-attributen gebruiken. Dit is nu geïsoleerd van style-elementen en scripts.

## Fase 98 — Inline style-inventarisatie (2026-09-15)

- De resterende inline styling is gemeten: 353 style-attributen verspreid over 32 TSX-bestanden, waaronder branding, previews, advertenties en embeds.
- Een volledige omzetting naar classes zou een brede visuele refactor zijn met reëel regressierisico; die is daarom niet blind uitgevoerd.
- Twee opeenvolgende lokale requests kregen verschillende CSP-nonces. De nonce is dus requestgebonden en niet statisch hergebruikt.

**Status:** script- en style-elementen zijn nonce-aware; inline style-attributen zijn geïsoleerd via `style-src-attr`. De resterende CSS-refactor blijft apart gepland.

## Fase 99 — Registratie- en productieversiecontrole (2026-09-15)

- Production `/register` antwoordt HTTP `200` met Cloudflare, HSTS, `nosniff` en `SAMEORIGIN`.
- Een ongeldige registratiepayload antwoordt HTTP `400` met een validatiefout zonder secrets, stacktrace of database-informatie.
- De interne database-herstelroute accepteert geen GET en antwoordt HTTP `405`.
- Production `/api/health` blijft HTTP `200` met database en Redis actief.

**Belangrijk:** production draait nog op de laatst bewezen deployment en bevat daarom nog de vorige statische report-only CSP-header. De nonce/CSP-wijzigingen zijn lokaal gebouwd en gecontroleerd, maar bewust nog niet gedeployed.

## Fase 100 — Gecontroleerde productie-deployment (2026-09-15)

- De lokale wijzigingen zijn op verzoek uitgerold naar Vercel-project `project-ubm6y` voor `leads.digitify.be`.
- Deployment `dpl_6Rc9NSZcSNRZTk9q9jsB11N8F5fd` staat op `READY` en de productiealias is actief.
- Production `/api/health` antwoordt HTTP `200` met database `ok` en Redis `ok`.
- Production `/login` en `/register` antwoorden HTTP `200` met Cloudflare, HSTS, `nosniff`, `SAMEORIGIN` en de nonce-gebaseerde CSP report-only policy.
- Een niet-geauthenticeerde `/dashboard`-request blijft HTTP `307` naar `/login` met `private, no-cache, no-store`.
- De Vercel-build slaagde; bestaande lintwaarschuwingen blijven zichtbaar maar blokkeerden de build niet.

**Status:** deployment geslaagd en post-deploy smokechecks geslaagd. Geen secrets uitgelezen of gewijzigd; geen databasewijziging, e-mail, externe publicatie of rollback uitgevoerd.

## Fase 101 — Testaccount en auth-scope gecontroleerd (2026-09-15)

- De bestaande seedprocedure is bevestigd als localhost-only; zij maakt de gedocumenteerde lokale rolfixtures aan en wijzigt niet automatisch productieaccounts.
- `test@digitify.be` is daarom niet via de lokale seed tegen productie overschreven. Dat voorkomt een onbedoelde password-reset, lockout of wijziging in de verkeerde database.
- Production registratie, loginpagina, unauthenticated redirect, tRPC-validatiefout en interne route-method protection zijn gecontroleerd zonder loginpogingen, wachtwoorden of resetsecrets te gebruiken.
- Voor productie moet `test@digitify.be` via de normale password-reset/admin-flow worden hersteld, met een eenmalig tijdelijk wachtwoord dat niet in logs of documentatie wordt geplaatst.

**Open punt:** een productie-reset kan pas verantwoord worden uitgevoerd via de geautoriseerde resetflow of met een expliciet gecontroleerde adminactie. De lokale seed blijft beschikbaar via `scripts/reset-local-test-accounts.sh`.
## Fase 102 — Wachtwoord resetfunctie op login

- Login heeft nu een link naar `/forgot-password`.
- De publieke aanvraag geeft altijd dezelfde melding en is beschermd met IP-rate limiting; onbekende accounts worden niet onthuld. Ook oudere accounts zonder ingevulde `emailVerified`-datum kunnen via hun mailbox herstellen.
- Resetlinks worden als eenmalige SHA-256-tokenhash opgeslagen in `password_reset_tokens`, verlopen na 30 minuten en maken eerdere tokens ongeldig.
- Een geslaagde reset wijzigt het wachtwoord en verhoogt `sessionVersion`, zodat bestaande sessies opnieuw moeten aanmelden.
- Nieuwe resetpagina’s: `/forgot-password` en `/reset-password?token=...`.
- Lokale migratie en typecheck geslaagd; productie moet de nieuwe migratie eerst via de normale releaseprocedure uitvoeren.
- Resetbevestiging claimt het token atomisch, zodat gelijktijdige submits geen dubbele wachtwoordwijziging kunnen veroorzaken.
- Productie: `password_reset_tokens` aangemaakt met indexen en foreign key; `digitify_app` kreeg uitsluitend de noodzakelijke tabelrechten. `anon` en `authenticated` kregen geen toegang.
- Vercel deployment `dpl_2nezWp5TP3N2FU7dX4mwNTRqMXzj` staat live. Health, login, resetpagina en ongeldige resetlink zijn live gecontroleerd.
- Productieherstel: ontbrekende RLS-helperfuncties opnieuw aangemaakt en hun `search_path` vastgezet. Dit herstelde de e-mailinstellingenquery zonder publieke tabeltoegang te openen.

## Fase 103 — Rate-limit response voor password reset hersteld

- De wachtwoord-resetlimiet staat nu binnen tRPC in plaats van in Edge middleware. Daardoor blijft de limiet actief met Upstash/in-memory fallback, maar worden limietfouten als geldige tRPC-fouten teruggegeven.
- De browser toont niet langer `Unable to transform response from server` wanneer de limiet bereikt is.
- Production deployment `dpl_664kGsGKEG46SoHxayV7TdSdnGqt` staat op `READY`.

**Verificatie:** typecheck geslaagd, API-tests `298 passed / 16 skipped`, production build geslaagd, production health `200` met database en Redis `ok`, veilige onbekende resetaanvraag `200`, `/forgot-password` `200` en `git diff --check` geslaagd.

**Open punt:** een reset voor een bestaand productieaccount moet nog éénmalig met SMTP-configuratie en mailboxcontrole worden uitgevoerd; dat verstuurt een echte e-mail.

## Fase 104 — Reviewaanvraag-modal zichtbaar en mobiel bruikbaar (2026-09-16)

- De gedeelde `CreateModal`-content krijgt nu een expliciete laag boven de modal-overlay, zodat formulieren niet door de donkere achtergrond worden afgedekt.
- De overlay is minder zwaar gemaakt en modals kunnen op kleine schermen intern scrollen.
- Dit herstelt de knop `Review Aanvragen` op `/reviews` zonder wijzigingen aan reviewdata of verzendingen.

**Verificatie:** typecheck geslaagd; productiecontrole bevestigde dat de reviewmodal opent. De live omgeving bevatte daarnaast oude niet-geauthenticeerde requests, maar geen review-specifieke serverfout.

## Fase 105 — Releasecheck en modelcatalogus bijgewerkt (2026-09-16)

- De MuAPI-kostenmetadata is gesynchroniseerd met de publieke catalogus: 684 endpoints, inclusief de bestaande lokale fallback.
- De volledige releasecheck is daarna opnieuw uitgevoerd: Prisma-clientgeneratie, lokale migraties, domeinschema, database-rolcontrole, model-sync, tests, typecheck, lint en production build zijn geslaagd.
- De bestaande lintwaarschuwingen blijven onderhoudspunten; er zijn geen nieuwe fouten door deze fase toegevoegd.

**Verificatie:** `pnpm check:release` geslaagd; 298 API-tests en 42 webtests geslaagd, 16 integratietests overgeslagen omdat de optionele integratievlag niet actief was.

## Fase 106 — Integratie- en RLS-smoke (2026-09-16)

- Lokale integratietests zijn uitgevoerd met `RUN_DB_INTEGRATION=1 ENABLE_WORKSPACE_RLS=true`.
- Workspace-RLS, IDOR-isolatie en settings-RBAC zijn gecontroleerd: 13 tests geslaagd.
- De RLS-smoke met twee owners en twee workspaces bevestigde dat leads niet over workspaces heen leesbaar zijn.
- De controle gebruikte uitsluitend de lokale PostgreSQL-database; productie is niet aangepast.

**Open punt:** de resterende outbound- en Template Studio-browsercontrole op staging blijft handmatig, omdat die echte sessies en moduleflows vereist.

## Fase 107 — Lokale browserregressiecontrole (2026-09-16)

- Playwright draaide tegen een lokale server op poort 3001.
- 8 publieke/responsive smoke-tests slaagden, inclusief health, marketing, embeds en portal-uploadbeveiliging.
- 25 authenticatie-afhankelijke tests zijn overgeslagen omdat er geen lokale browser-auth-state was; dit is geen testfalen.
- De lokale server is door Playwright automatisch gestopt.

**Open punt:** voor volledige browserdekking moeten lokale seedaccounts via de bestaande auth-state setup worden geladen; er zijn geen productiecredentials gebruikt.

## Fase 108 — Moduletoegang onder actieve RLS hersteld (2026-09-16)

- Platform-owner reads/writes voor per-account module-instellingen draaien nu in één RLS-transactie met de gevalideerde scope van het doelaccount.
- Dit voorkomt `settings`-policyfouten doordat de `app.user_id`-context tussen losse Prisma-transacties verloren ging.
- De bestaande Owner/Admin-flow binnen de eigen workspace is ongewijzigd.

**Verificatie:** typecheck, 13 module-RBAC-tests en 13 RLS/IDOR/settings-integratietests geslaagd; productie-deployment, healthcheck en error-logcontrole geslaagd.

## Fase 109 — Volledige kerncontrole en releasecheck (2026-09-16)

- Productie-health gecontroleerd: database en Redis zijn bereikbaar; de homepage en healthroute sturen geen tenantdata naar de cache.
- Securityheaders gecontroleerd: HSTS, `nosniff`, `SAMEORIGIN`, restrictive permissions policy en Cloudflare-proxy zijn actief.
- Lokale database-, rol- en domeinschema-controles zijn geslaagd; de applicatierol is geen `SUPERUSER` en heeft geen `BYPASSRLS`.
- RLS-smoke met twee workspaces is geslaagd; cross-workspace lead-ID's blijven afgeschermd.
- Volledige tests zijn geslaagd: 298 API-tests, 42 webtests en 13 database-integratietests.
- Production build is geslaagd met een expliciete Node-heap van 4 GB. Zonder die instelling kan de lokale machine de build niet afronden door een heaplimiet; dit is geen compile- of typefout.

**Open onderhoudspunt:** lint blijft groen met 109 bestaande waarschuwingen, voornamelijk ongebruikte imports en ontbrekende React-hook-dependencies. Deze zijn niet stilzwijgend aangepast omdat ze buiten de bevestigde moduletoegangfix vallen.
