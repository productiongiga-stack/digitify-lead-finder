# Persoonlijke authenticatorbeveiliging

## Werking

Vrijwillige TOTP (SHA-1, zes cijfers, dertig seconden, maximaal één aangrenzende tijdstap) voor iedere rol. Alleen de ingelogde persoon kan zijn factor beheren; impersonatie kan geen instellingen wijzigen. De header vraagt de status van de echte sessiehouder op en blijft waarschuwen zolang 2FA niet ingesteld of niet gecontroleerd is.

Het wachtwoord levert alleen een vijf minuten geldige, gehashte challenge in een HttpOnly/SameSite=Strict-cookie op. De NextAuth-credentialsprovider accepteert uitsluitend deze server-issued challenge: rechtstreeks e-mail/wachtwoord aanbieden kan geen sessie maken. Per challenge vijf pogingen, accountgebonden tien mislukte factorcontroles per vijftien minuten en duurzame IP-/accountlimieten. Alle claims worden binnen een account-rowlock verwerkt. TOTP-stappen en herstelcodes zijn eenmalig, ook bij gelijktijdige verzoeken.

Setup duurt maximaal twintig minuten. De QR-code wordt lokaal gegenereerd, zonder externe QR-dienst. Een factor wordt pas actief na een geldige code én bevestiging dat tien herstelcodes bewaard zijn. Tijdens vervanging blijft de oude factor actief. Sleutels zijn AES-256-GCM-versleuteld met persoonlijke AAD en `TWO_FACTOR_ENCRYPTION_KEY`; herstelcodes en challenges worden alleen gehasht opgeslagen. Responses zijn `private, no-store` en gebruiken `no-referrer`.

Inschakelen, vervangen, uitschakelen, herstelcodes vernieuwen en gecontroleerd herstel trekken alle sessies/challenges in via `sessionVersion`. Wachtwoordreset behoudt 2FA en maakt pending setups en challenges ongeldig. JWT-factorbewijs wordt uitsluitend door de server gezet, nooit door een client-update. Beveiligingswijzigingen worden zonder geheimen geaudit en via de bestaande e-mailvoorziening gemeld. Mislukte mail blokkeert de beveiligingswijziging niet; afleverresultaat staat in het auditlog.

## Beheerherstel

Geen workspace-admin-reset, automatische e-mailomweg of gewone app-sessie tijdens herstel. Alleen een vertrouwde platformoperator gebruikt:

```sh
# DATABASE_URL moet vooraf naar de onafhankelijk gecontroleerde doelomgeving wijzen.
pnpm --filter @digitify/api exec tsx scripts/recover-two-factor.ts \
  --user ACCOUNT_ID --operator OPERATOR_ID --ticket DOSSIER \
  --reason 'Gedocumenteerde reden' --identity-verified --reviewer TWEEDE_OPERATOR
```

Dit is standaard een dry run. Na onafhankelijke identiteitcontrole en dossiercontrole kan `--execute` toegevoegd worden. OWNER/ADMIN vereisen een andere reviewer. Het commando geeft eenmaal een 24 uur geldige vergunning aan de operator; verstuur die uitsluitend via een gecontroleerd kanaal, niet in URL's of logs. De gebruiker vult vergunning én bestaand wachtwoord in op `/two-factor-recovery`, bevestigt een nieuwe authenticator en logt daarna opnieuw in. Een verbruikte vergunning of recovery-setupchallenge is geen geldige NextAuth-loginchallenge. Bij onderbroken setup is een nieuwe gecontroleerde vergunning nodig.

## Database en configuratie

Migraties `20261002210000_account_two_factor` en `20261002211000_auth_private_rls` zijn additief. Persoonlijke factor- en herstelcodetabellen hebben FORCE RLS op `app_user_id()`, zonder owner-bypass. Private challenge-, grant- en rate-tabellen zijn alleen voor vertrouwde serverrollen; openbare Supabase-rollen krijgen geen grants en worden ook door RLS geweigerd. Controleer productiegrants met de daadwerkelijke applicatierol.

Genereer een unieke productiekey met `openssl rand -hex 32`, bewaar die in de eigen secretmanager én als gevoelige Vercel-variable. Gebruik nooit de CI-testkey, lokale key of een bestaande auth-/settingskey. Sleutelverlies maakt bestaande authenticators onleesbaar; keyrotatie vereist gecontroleerde herencryptie en mag niet via willekeurig vervangen van de variable.

## Verificatie

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm test:integration
# Alleen tegen een lokale draaiende server en disposable database-accounts:
RUN_HTTP_INTEGRATION=1 TWO_FACTOR_TEST_URL=http://localhost:3001 \
  bash scripts/with-local-env.sh pnpm --filter @digitify/api exec vitest run \
  src/__tests__/two-factor-http.integration.test.ts
```

Tests behandelen encryptie/tampering, RFC-vector, TOTP-replay, parallelle codeclaims, vijf/tien-pogingenlimieten, persoonlijke RLS, vervangen/uitschakelen/vernieuwen, versie-intrekking na wachtwoordreset, gecontroleerd herstel en NextAuth-bypass. HTTP-tests zijn standaard uitgeschakeld en weigeren niet-lokale hosts. Geen echte accountauthenticator wordt voor verificatie gewijzigd.

## Productiepoort (2026-10-02)

Vercel-project `project-ubm6y` (`prj_LX6PrdtVRTO4KssiaEigGsVv9NQs`), GitHub-repository en productiebranch `main` zijn bevestigd. Domein `leads.digitify.be` is geverifieerd. Rollbackpunt: `dpl_A93BjMDQChS2DXVwDUhoMMtzCHBR`, commit `6ecb7d534f3e61e6bba2ab6df90d15515861d9f5`.

Productie heeft nog geen 2FA/Ads-tabellen en geen `public._prisma_migrations`. Bestaande productie-secrets zijn write-only en worden door Vercel alleen als `[SENSITIVE]` geëxporteerd. Dat exportbestand is **geen bruikbare productieconfiguratie**. `TWO_FACTOR_ENCRYPTION_KEY` en een apart preview-databaseprofiel ontbreken. De Supabase-projectidentiteit is alleen read-only bevestigd (`dlkyplyzgoscarytutin`); een herstelbare backup en daadwerkelijke applicatieverbinding zijn nog niet gecontroleerd.

Daarom geen productie-migratie, main-merge of deployment totdat backup/restore, gecontroleerde selectieve migratieprocedure en geïsoleerde previewverificatie afgerond zijn. Geen reset, seed, volledige historische migratierun of blinde baselining op productie. Compatibele additieve databasewijzigingen blijven bij applicatierollback staan. Externe advertenties en AI-planning blijven onaangeroerd.

## Resterende operationele controles

- Verifieer security-mailaflevering met de echte mailprovider vóór release; lokale tests bewijzen geen externe aflevering.
- Test mobiele weergave en de QR-/herstelcodeschermen visueel vóór merge. De lokale desktopbrowsercontrole bevestigt login, waarschuwing en beveiligingspagina; de beschikbare viewport-override bleef tijdens deze run op 1280 px staan.
- Bewaar auditgegevens volgens de privacyretentie. Ruim verlopen loginchallenges, vergunningen en rate-buckets periodiek op; momenteel zijn verlopen records inert maar er is nog geen automatische auth-retentietaak.
