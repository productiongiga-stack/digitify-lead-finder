# MVP-kern — Digitify Lead Search

Dit document legt vast welke bestaande verkoopflow de eerste productkern vormt. Het is een scope- en navigatiereferentie; het voegt geen databasevelden, statusvelden of nieuwe publieke API toe.

## Kernflow

`Leads zoeken → Lead selecteren → Score bekijken → Contactdraft maken → Goedkeuring → Verzending → Opvolging → Offerte → CRM/klant → Factuur`

De leaddetailpagina is het operationele startpunt. Vanuit die pagina moet de gebruiker context kunnen behouden bij het openen van een contactdraft, goedkeuringswachtrij, offerte, taak of CRM-relatie.

## In scope

| Stap | Bestaande route of bron | Beslissing |
|---|---|---|
| Leads zoeken | `/leads/search` | Zoekresultaat importeren of openen als lead |
| Lead beheren | `/leads`, `/leads/[id]` | Status blijft een expliciete gebruikersactie |
| Score | Lead score/factoren in de leaddetail | Score verklaart commerciële prioriteit, maar verandert de leadstatus niet automatisch |
| Contact | `/contacts/compose?leadId=...` | Draft blijft gescheiden van goedkeuring en verzending |
| Goedkeuring en verzending | `/contacts`, outbound/approval-routes | `doNotContact`, suppressie, ontvanger- en workspacecontrole blijven verplicht |
| Opvolging | `/tasks` en activiteiten | Antwoorden kunnen als activiteit/signaal worden vastgelegd; kwalificatie blijft handmatig |
| Offerte | `/quotes/new?leadId=...`, `/quotes/[id]` | Bestaande quote-statusflow blijft leidend: `DRAFT → SENT → VIEWED → ACCEPTED/REJECTED/EXPIRED` |
| CRM/klant | `/crm` | Conversie gebruikt bestaande lead- en CRM-relaties |
| Factuur | `/invoices` | Facturen blijven gekoppeld aan geldige workspace- en offertegegevens |

## Status- en eigenaarschapregels

- Leadstatussen worden alleen gewijzigd via bestaande leadmutaties en een expliciete gebruikersactie.
- Een e-mail of antwoord verandert de commerciële leadstatus niet automatisch.
- Goedgekeurde outbound-inhoud en ontvangers zijn beschermd tegen wijzigingen; inhoudelijke wijzigingen vragen opnieuw goedkeuring.
- Onzekere aflevering mag niet automatisch opnieuw worden verzonden zonder expliciete reconciliatie.
- Iedere query en mutation blijft workspace-, rol- en modulegebonden.
- Viewer- en andere read-only policies blijven gelden; de MVP-kern omzeilt geen autorisatie.

## Buiten de MVP-kern

Integraties, automatiseringen, formulieren, landing pages, projecten, bestanden, contracten, klantportaal, agenda, uitgebreide SEO, advertenties en AI-functies blijven uitbreidbare modules. Ze mogen bestaande navigatie en toegangsinstellingen blijven gebruiken, maar zijn geen vereiste voor de eerste verkoopflow.

Er worden in deze fase geen modules automatisch uitgeschakeld en er wordt geen fictieve data toegevoegd. Per-account moduleflags blijven een afzonderlijke, bewuste configuratie van Owner/Admin en worden in fase 11.2 verder uitgewerkt.

## Definition of done

De MVP-kern is functioneel wanneer een geautoriseerde gebruiker vanuit één lead, zonder handmatige URL-wijzigingen, een contactdraft kan maken, die kan laten goedkeuren en verzenden, opvolging kan plannen, een offerte kan maken en de bestaande CRM- en factuurflow kan openen. Cross-workspace toegang, ontbrekende relaties en geblokkeerde outbound-acties tonen een veilige fout- of lege staat.
