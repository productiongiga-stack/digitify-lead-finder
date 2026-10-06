# Creative Studio — wizards en credits

Creative Studio start vanuit een doel: social post, advertentiemateriaal, afbeelding, video of sprekende video. Merkkits komen uit Social Planner; workspace-branding blijft de standaard. De bibliotheek filtert op merk, type en status. Bestaande tab- en generatie-links blijven ondersteund.

## Lokaal starten

1. Voer de nieuwe Prisma-migratie uit op de lokale database en genereer de client.
2. Start de webapp op localhost:3001 met NEXTAUTH_URL=http://localhost:3001.
3. Concepten slaan zichzelf op per gebruiker en workspace. Open een concept via “Verder werken”. Een gewijzigde revisie uit een ander tabblad blokkeert overschrijven. Nieuwe centrale jobs worden atomair aan het concept gekoppeld vóór het providerantwoord; dezelfde draft kan geen tweede lopende generatie starten.

Social posts kunnen eigen uploads of generaties gebruiken. De bestaande Social Planner-composer handelt captions, previews, goedkeuring en planning af. In Creative Studio start deze bij tekst: account en merk worden overgenomen. Zonder account kun je het Creative Studio-concept met caption en media bewaren; inplannen vraagt een gekoppeld account. Rollen blijven leidend. Afbeeldingen kunnen naar Google Ads (liggend/vierkant); video-overdracht naar Google wordt geweigerd. Meta ontvangt nieuwe varianten, inclusief video met een echte video_data payload bij expliciete campagnepublicatie. Video moet daarvoor in Blob staan. Meta kan nog verwerkingstijd voor thumbnails vereisen; er wordt nooit vanuit Creative Studio gepubliceerd.

## Centrale provider en testbetalingen

Stel server-side in:

- CREATIVE_MUAPI_KEY: centrale Digitify-providerkey.
- CREATIVE_STRIPE_TEST_SECRET_KEY: sk_test_ sleutel van Digitify. De aanwezige workspace-Stripe-instelling wordt bewust niet automatisch gebruikt: eigenaarschap is niet bevestigd.
- CREATIVE_STRIPE_WEBHOOK_SECRET: signing secret voor /api/webhooks/creative-stripe.
- CREATIVE_OPERATOR_USER_IDS: Digitify-gebruikers die prijzen mogen beheren; OWNER/ADMIN blijft vereist.

CREATIVE_CREDITS_ENABLED is standaard actief. Zonder providerconfiguratie kunnen gebruikers concepten maken; generatie blijft geblokkeerd. Een expliciete false behoudt tijdelijk de oude persoonlijke-key-flow. Oude jobs zonder provider=central gebruiken altijd de sleutel van hun oorspronkelijke auteur, ook wanneer een collega het resultaat bekijkt.

Open /creative-studio?tab=pricing als Digitify-operator. In Integraties staat centrale AI vooraan; persoonlijke sleutels voor oude jobs staan onder Geavanceerd. Configureer bundels (credits en europrijs) en de exacte model/instellingencombinaties. Niet geprijsde combinaties blijven geblokkeerd. Checkout is uitsluitend in Stripe-testmodus; er bestaat geen live-schakelaar in deze versie. Live verkoop vereist een afzonderlijke implementatie en controle van de zakelijke prijzen/configuratie.

Stripe CLI voor een eigen testaccount:

    stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded --forward-to localhost:3001/api/webhooks/creative-stripe

Gebruik het bijbehorende webhooksecret. Credits worden uitsluitend toegekend vanuit ondertekende betaalde testevents, nooit vanuit de terugkeerpagina. Bestelling, bedrag, valuta en session-ID worden gecontroleerd. Herhaalde events leveren geen extra credits op.

## Boekingen en herstel

Credits zijn per gebruiker en worden over diens workspaces gedeeld. Elke generatie reserveert de vaste prijs onder een lock op de wallet. De job bewaart die prijs; latere prijswijzigingen veranderen bestaande reserveringen niet. Een geslaagd technisch resultaat verbruikt de reservering. Een definitieve technische fout geeft die vrij. Nieuwe varianten kosten opnieuw credits. Opslag- en pollingfouten starten geen nieuwe generatie.

De bestaande media-reconcile cron vereffent terminale jobs en herstelt vastgelopen jobs. Een oude pending-job zonder provider-request-ID wordt als technische startfout afgehandeld. Generaties die nog verwerken behouden hun reservering. Bibliotheekoverdracht vereist duurzame opslag; een opslagfout laat het resultaat intact voor opnieuw proberen.

De nieuwe tabellen zijn server-only; publieke databaserollen worden geweigerd. De financiële helpers gebruiken de vertrouwde serverclient. Routers controleren identiteit, workspace, rollen en bestemmingstoegang. Creditconfiguratie is globaal en alleen toegankelijk voor expliciet aangewezen Digitify-operators.

## Verificatie

    pnpm db:generate
    pnpm typecheck
    pnpm test
    bash scripts/with-local-env.sh env RUN_CREATIVE_INTEGRATION=1 pnpm --filter @digitify/api exec vitest run src/__tests__/creative-studio.integration.test.ts

De aanvullende integratietests weigeren een niet-lokale database en controleren gelijktijdige reserveringen, eenmalige vereffening, dubbele checkout-fulfillment, verschillende gebruikers/workspaces en revisieconflicten. Gebruik Stripe-testcredentials voor een echte Checkout-test. Geen productiebetalingen of providerkosten zijn nodig voor de automatische tests.

- Aanvullende controles: stabiele merkkit- en referentie-JSON, bescherming van bestaande advertentieconcepten, serverkoppeling van lopende jobs aan concepten, en eenmalige afronding van creditreserveringen.
