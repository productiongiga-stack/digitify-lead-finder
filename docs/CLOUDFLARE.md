# Cloudflare-runbook

## Aanbevolen route voor Digitify

Gebruik Cloudflare eerst als DNS-, TLS-, WAF- en proxylaag voor de bestaande runtime. Laat de Next.js-app voorlopig op Vercel of een beheerde VPS draaien. Daarmee blijft de huidige Next.js/tRPC/Prisma-architectuur intact en wordt er geen tweede runtime geïntroduceerd.

```text
bezoeker -> Cloudflare DNS/proxy/WAF -> Vercel of VPS -> PostgreSQL/Redis
```

Cloudflare proxying is geschikt voor HTTP-verkeer op de publieke webhost. DNS-records voor diensten die Cloudflare-proxying niet ondersteunen, zoals sommige database- of webhookverbindingen, blijven DNS-only.

## Voorbereiding

1. Voeg de Digitify-zone toe aan Cloudflare en controleer de nameservers.
2. Maak voor de app-host alleen de noodzakelijke DNS-records aan.
3. Gebruik Full (strict) TLS met een geldig certificaat op de origin.
4. Zet `ENABLE_WORKSPACE_RLS=true` en controleer de productie-env vóór DNS-omschakeling.
5. Stel rate limiting, bot protection en WAF-regels in zonder tRPC, cron en publieke formulier- of embedroutes te blokkeren.
6. Test `/api/health`, login, publieke embeds, formulier-submit, cron-authenticatie en uploads vanaf de Cloudflare-hostnaam.
7. Monitor eerst met een lage TTL; wijzig pas daarna de proxystatus of nameservers definitief.

## Belangrijke uitzonderingen

- `DATABASE_URL`, `DIRECT_URL` en Redis-records worden niet via de webproxy gepubliceerd.
- Webhooks moeten het publieke HTTPS-adres blijven gebruiken, maar hun authenticatie blijft server-side verplicht.
- `CRON_SECRET`, OAuth-secrets, SMTP-secrets en encryptiesleutels komen uitsluitend in runtime secrets, nooit in DNS, clientcode of auditlogs.
- Cloudflare caching mag geen tenant- of gebruikergebonden tRPC-responses cachen. Cache alleen publieke statische assets en expliciet publieke routes.

## Volledige Cloudflare Workers-migratie

Een volledige Workers-deploy is technisch mogelijk via de huidige Cloudflare Next.js-route met `vinext`, of via de OpenNext-adapter voor een bestaande compatibele setup. Dit blijft een aparte migratiefase. Eerst moeten minimaal deze punten worden bewezen:

- Prisma en de gekozen PostgreSQL-verbinding vanuit Workers.
- NextAuth/JWT, cookies en server-side sessievalidatie.
- Node-afhankelijkheden in routers, mail, uploads en externe connectors.
- Vercel Blob-vervanging of expliciete Blob-compatibiliteit.
- Cron-vervanging en idempotente background jobs.
- RLS, rate limiting, logging en cold-startgedrag.

Er wordt geen Workers-configuratie of dependency toegevoegd zonder een geslaagde compatibiliteitscheck en een aparte stagingomgeving.

## Huidige productiecontrole

- Zone `digitify.be` is actief via Cloudflare-nameservers.
- `leads.digitify.be` en `shop.digitify.be` gebruiken proxied Cloudflare DNS-records.
- TLS staat op `Full (strict)` en de certificaatstatus is actief.
- De applicaties sturen HSTS, `nosniff` en `SAMEORIGIN` mee.
- Cloudflare `Always Use HTTPS` staat aan en minimum TLS staat op `1.2`. De HTTP-hosts sturen aantoonbaar door naar HTTPS met een `301`.
- De beheerde WAF-regels en L7 DDoS-bescherming blijven actief. Deze ronde heeft geen DNS-, mail- of WAF-regels verwijderd of aangepast.
- Mailrecords blijven DNS-only; wijzig die niet naar proxied.

## Lokale verificatie

```bash
pnpm check:production-env
pnpm check:release
ENABLE_WORKSPACE_RLS=true pnpm rls:smoke
RUN_DB_INTEGRATION=1 ENABLE_WORKSPACE_RLS=true pnpm test:integration
```

De huidige lokale app blijft draaien op `http://localhost:3000`; Cloudflare beschermt de productiehosts.

## Bronnen

- Cloudflare Next.js/Workers: https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- Cloudflare OpenNext: https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/
- Cloudflare DNS proxystatus: https://developers.cloudflare.com/dns/proxy-status/
