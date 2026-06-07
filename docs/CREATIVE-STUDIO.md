# Creative Studio (Open Generative AI integratie)

Digitify integreert [Open Generative AI](https://github.com/anil-matcha/open-generative-ai) via **MuAPI.ai** als hybride media-module:

- **Creative Studio** (`/creative-studio`) — afbeeldingen, video's en marketing-advertenties
- **Social Planner** — knop *Genereer afbeelding* in de composer
- **Meta Ads** — link naar gegenereerde advertentievideo's

## Setup per gebruiker (BYOK)

1. Maak een account op [muapi.ai](https://muapi.ai)
2. Genereer een access key op [muapi.ai/access-keys](https://muapi.ai/access-keys)
3. Ga in Digitify naar **Instellingen → Creative Studio**
4. Plak de key en klik **Sleutel opslaan**

De sleutel wordt versleuteld opgeslagen als `user:{userId}:api.muapi_key` en nooit naar de browser teruggestuurd na opslag.

## Omgevingsvariabelen

| Variabele | Vereist | Doel |
|-----------|---------|------|
| `SETTINGS_ENCRYPTION_KEY` | Productie | Versleuteling van API-keys |
| `BLOB_READ_WRITE_TOKEN` | Productie | Permanente opslag van gegenereerde media |

## Database

Voer de migratie uit:

```bash
pnpm db:migrate
```

Model: `MediaGeneration` in `packages/db/prisma/schema.prisma`.

## Architectuur

```
UI (Creative Studio / Social Planner)
  → tRPC media.*
    → @digitify/media-studio (MuAPI client)
    → api.muapi.ai
  → importToBlob → Vercel Blob
```

Optionele proxy voor directe MuAPI-calls: `/api/muapi/*` (server-side key injectie).

## Kosten

Elke generatie verbruikt MuAPI-tegoed. Controleer je balance in **Instellingen → Creative Studio** vóór je grote video- of advertentiebatches start.

## Ondersteunde modellen

Creative Studio toont alle modellen uit `packages/media-studio/src/models.ts` via `media.listModels`. Highlights:

- **Afbeeldingen (t2i):** Flux, HiDream, Nano Banana, Seedream v3–v5, GPT Image, Midjourney v7/v8, Ideogram v3, Imagen 4
- **Bewerken (i2i):** Nano Banana Edit (tot 14 refs), Flux Kontext/Flux 2 Edit, Seedream/SeedEdit, GPT-4o Edit
- **Video (t2v):** Seedance 2.0, Kling v3/2.x, Veo 3, Grok Imagine, Wan, PixVerse, Hailuo, Runway
- **Image-to-video:** Seedance 2 I2V (multi-ref), Kling, Veo, Grok Imagine I2V, Runway, Wan
- **Lip sync (9):** Infinite Talk, Wan Speech, LTX Lipsync, Sync, LatentSync, Creatify, Veed
- **Advertenties (3):** Seedance VIP Omni Reference (720p/1080p), fast-variant

Endpoints komen overeen met het [MuAPI-modelcatalogus](https://muapi.ai/docs/models). Nieuwe modellen toevoegen in `packages/media-studio/src/models.ts`.

**Sync-scripts:**
- `node packages/media-studio/scripts/sync-model-costs.mjs [--check]` — prijzen
- `node packages/media-studio/scripts/sync-models-from-muapi.mjs [--check]` — catalogus-drift rapport

Prijzen worden getoond als geschatte EUR (`€0,0000`) met USD-bronprijs in de detailregel.

## Workflow

- **Dual-mode generators:** Afbeeldingen (tekst→beeld / bewerken) en Video (tekst→video / startframe) met model-zoekveld en gegroepeerde modellen.
- **Referentiebibliotheek:** workspace-brede upload history voor hergebruik van referentiebeelden.
- **Opnieuw genereren:** `?regenerate={jobId}` opent de generator met dezelfde prompt en instellingen.
- **Bibliotheek:** na generatie kun je handmatig opslaan, of automatisch via **Instellingen → Creative Studio → Automatisch opslaan in bibliotheek**.
- **Social Planner:** `?imageJob=`, `?videoJob=`, `?socialPostId=` en **Plan in agenda** deep links.
- **Meta Ads:** `?adJob=` laadt advertentievideo + script in de campaign builder.
- **Usage dashboard:** hero-stats tonen generaties deze maand, geschatte kosten en mislukte jobs.
- **Historie:** paginatie, status-badges, download, verwijderen en **Opnieuw** op de Historie-tab.

## Job lifecycle

Generaties worden client-side gepolled (`useMediaJob`, elke 2,5s). Vastgelopen jobs worden elke 15 minuten opgepikt door `/api/cron/media-reconcile`.

## Merkkit

Tab **Merkkit** in Creative Studio of `/creative-studio?tab=brand`:

- Hergebruikt branding uit **Instellingen → Branding** (naam, slogan, logo, kleur)
- Extra velden: bedrijfsomschrijving, tone of voice, merkwoorden, vermijd-lijst
- Optioneel logo als referentiebeeld bij generatie
- Chatbot-training (`chatbot.training_notes`) en OpenClaw-context worden automatisch meegenomen

Opslag: workspace-instellingen onder `creative.*`.
