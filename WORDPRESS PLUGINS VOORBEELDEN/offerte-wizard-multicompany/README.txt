# Offerte Wizard (Multi-Company) v1.2.0

## Installatie
1. Upload de zip in WordPress: Plugins → Nieuwe plugin → Upload plugin.
2. Activeer **Offerte Wizard (Multi-Company) v1.2.0**.
3. Ga naar **Offerte Wizard → Bedrijven** en maak een bedrijf aan.
4. Plaats de wizard op een pagina met: `[offerte_wizard company="jouw-slug"]`.

## Wat is er customizable per bedrijf?
- Wizard flow (diensten/vraagstelling/stapteksten) via Wizard Builder (v1: JSON schema).
- Naam, logo, telefoon, e-mail, header meta
- Primary kleur + basis kleuren
- Bedankpagina (titel/tekst)

## Leads
- Worden opgeslagen in een eigen tabel.
- Admin lijst + filter + CSV export.

## Endpoint
- REST: `POST /wp-json/offerte-wizard/v1/lead`
- Verwacht header: `X-LEAD-TOKEN` (te vinden/rotaten in Instellingen).


## Wizard Builder (v1.2.0)
- Visuele builder: diensten + vragen + sorteren (drag & drop)
- Copy per stap + locatie/contact labels
- JSON blijft beschikbaar onder 'Geavanceerd'
