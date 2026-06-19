# AI CHANGELOG — Digitify Lead Search

Chronologisch logboek van significante wijzigingen (mens + AI).  
**Formaat:** nieuwste entries bovenaan.

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
