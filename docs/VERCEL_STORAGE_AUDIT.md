# Vercel Storage Audit

**Datum:** 2026-09-14
**Scope:** `project-ubm6y` (leads.digitify.be) en `digitify-3d-webshop` (shop.digitify.be)

## Meting

De meting is uitgevoerd via de Vercel CLI en de accountbrede Usage-pagina. Tokens zijn alleen lokaal uit de Vercel environment gehaald en staan niet in dit document.

| Onderdeel | Actuele meting |
| --- | ---: |
| Vercel Blob, alle stores | 305,36 MB |
| Vercel Functions Storage, alle projecten, laatste 30 dagen | 1,04 GB |
| Functions: `project-ubm6y` | 830,8 MB |
| Functions: `digitify-3d-webshop` | 210,69 MB |

Blob-inventaris:

- Leads: 48 objecten, 178.174.892 bytes (169,92 MB).
- Shop: 120 objecten, 127.182.396 bytes (121,29 MB).
- Totaal van de twee gekoppelde stores: 305,36 MB.

## Controle

- De twee bedoelde Vercel-projecten zijn actief en gekoppeld aan de verwachte domeinen.
- De Leads-healthcheck geeft HTTP 200 met `db: ok`.
- De shop-homepage geeft HTTP 200.
- De shop-3D asset `assets/products/digitify/nfc-polsbandjes/model.glb` geeft HTTP 200 met `model/gltf-binary`.
- De interactieve 3D-preview is in de live shop aangezet; de preview eindigt in de toestand `3D VOORBEELD` zonder browser-waarschuwingen of -errors.
- De Leads- en Shop-Blob-tokens zijn als Vercel environment variables aanwezig. Tokenwaarden zijn niet uitgelezen of gelogd.

## Besluit

Er is in deze ronde niets verwijderd. De Blob-stores zijn volgens de actuele accountmeting niet vol en de Leads-store was eerder al opgeschoond. Shop-objecten zijn niet verwijderd omdat de productie-`DATABASE_URL` in de Vercel Production environment leeg is; zonder de bronregistratie in `upload_blobs` kan een object niet veilig als verweesd worden bewezen.

De Shop-store bevat meerdere historisch aangemaakte brandingbestanden met timestampnamen. Dat is een opruimkans, maar eerst moet de productie-DB-koppeling of een gecontroleerde export van `upload_blobs` beschikbaar zijn. Blind verwijderen kan logo's, favicons of productassets breken.

## Herhaalbare controle

Gebruik lokaal, zonder waarden te printen:

```bash
vercel project ls --scope productiongiga-7978s-projects
vercel list project-ubm6y --scope productiongiga-7978s-projects
vercel list digitify-3d-webshop --scope productiongiga-7978s-projects
vercel usage --help
```

Voor Blob-inventarisatie moet `BLOB_READ_WRITE_TOKEN` tijdelijk uit `vercel env pull` worden geladen. Gebruik nooit `cat`, screenshots of logs met de tokenwaarde en verwijder tijdelijke env-bestanden na gebruik.

## Volgende veilige stap

1. Herstel eerst de Shop Production `DATABASE_URL` als de database daadwerkelijk onderdeel is van de runtime.
2. Voer daarna een dry-run uit die `upload_blobs.path` vergelijkt met Blob-pathnames.
3. Verwijder uitsluitend objecten die zowel buiten `upload_blobs` als buiten statische `public/assets` vallen.
4. Controleer daarna de shop-homepage, catalogus, designer en 3D-assets opnieuw.
