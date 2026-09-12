# Digitify Suite v3 — Three-Layer Architecture

## 1. Executive Summary

Digitify Suite v3 evolves from a multi-tenant business OS (v2) into a **three-layer platform** that separates concerns into distinct architectural tiers:

| Layer | Purpose | Users |
|-------|---------|-------|
| **Core Business OS** | CRM, pipeline, quotes, invoices, scheduling, tasks | Internal team (authenticated) |
| **Builder Layer** | Configurator/Offerte Builder, booking page builder, form builder | Internal team (authenticated) |
| **Distribution Layer** | Public pages, embeds, widgets, API | End-users (public, unauthenticated) |

This document covers the **new Builder Layer** (Configurator/Offerte Builder) and **Distribution Layer** (embed architecture) added on top of v2.

---

## 2. Three-Layer Architecture

```
┌──────────────────────────────────────────────────────┐
│                  CORE BUSINESS OS                     │
│  CRM · Pipeline · Quotes · Invoices · Scheduling     │
│  Tasks · Templates · Automations · Analytics          │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │              BUILDER LAYER                       │ │
│  │  Configurator Builder · Booking Page Builder     │ │
│  │  Form Builder · Template Editor                  │ │
│  │  3-Panel UX · Versioning · Pricing Engine        │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │           DISTRIBUTION LAYER                     │ │
│  │  Hosted Pages · iframe Embed · JS Widget         │ │
│  │  Auto-resize · CSS Isolation · Event Callbacks   │ │
│  │  Public API · Webhooks                           │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

---

## 3. Configurator / Offerte Builder Module

### 3.1 Concept

A **Configurator** is a schema-driven, multi-step wizard that end-users fill out to configure a service/product and receive a live price calculation. Think: interactive offerte builder, product configurator, price calculator.

### 3.2 Data Model

```
Configurator (1) → (N) ConfiguratorVersion
    ConfiguratorVersion (1) → (N) ConfiguratorStep
        ConfiguratorStep (1) → (N) ConfiguratorBlock
    ConfiguratorVersion (1) → (N) PricingRule
Configurator (1) → (N) ConfiguratorSubmission
Configurator (1) → (0..1) EmbedSettings
```

- **Configurator** — Top-level entity with slug, branding, status (DRAFT/PUBLISHED/ARCHIVED)
- **ConfiguratorVersion** — Versioned snapshot allowing editing without breaking live version
- **ConfiguratorStep** — A page/screen in the wizard (with optional conditional visibility)
- **ConfiguratorBlock** — A form element (15 block types: SELECT_CARDS, SLIDER, CONTACT_FORM, etc.)
- **PricingRule** — Pricing logic (7 rule types: FIXED, PER_UNIT, TIERED, CONDITIONAL, etc.)
- **ConfiguratorSubmission** — End-user submissions with pricing breakdown and CRM linkage

### 3.3 Block Types

| Category | Types |
|----------|-------|
| Selection | SELECT_CARDS, SELECT_DROPDOWN, RADIO_GROUP, CHECKBOX_GROUP, TOGGLE |
| Input | TEXT_INPUT, TEXTAREA, NUMBER_INPUT, SLIDER, DATE_PICKER |
| Layout | HEADING, DIVIDER, IMAGE, PRICE_PREVIEW |
| Special | CONTACT_FORM |

### 3.4 Pricing Engine

The pricing engine is a **stateless evaluator** that takes pricing rules + selections → price breakdown.

Rule types:
- `FIXED` — Flat amount (e.g., base price €500)
- `PER_UNIT` — Amount × field value (e.g., €150 per page)
- `TIERED` — Bracket pricing (1-5 pages = €100/ea, 6-20 = €80/ea)
- `CONDITIONAL` — Add amount when condition matches (e.g., +€300 for SEO addon)
- `MULTIPLIER` — Multiply subtotal (e.g., ×1.5 for express delivery)
- `PERCENTAGE` — Tax/surcharge (e.g., 21% BTW)
- `DISCOUNT` — Subtract flat or percentage

Conditions use a minimal JSON-logic format:
```json
{ "==": [{ "var": "projectType" }, "website"] }
{ "in": ["seo", { "var": "addons" }] }
{ "and": [{ ">=": [{ "var": "pageCount" }, 10] }, { "==": [{ "var": "urgency" }, "express"] }] }
```

### 3.5 Builder UX

Three-panel layout (Figma/Canva-style):

```
┌──────────┬───────────────────┬─────────────┐
│  LEFT    │     CENTER        │   RIGHT     │
│  240px   │     flex          │   320px     │
│          │                   │             │
│ Structure│  Live Preview     │ Properties  │
│ - Steps  │  of configurator  │ - Step opts │
│ - Blocks │  in card frame    │ - Block opts│
│ - +-Add  │                   │ - Pricing   │
│          │                   │ - Condition │
│ Pricing  │                   │             │
│ - Rules  │                   │             │
│ - +-Add  │                   │             │
└──────────┴───────────────────┴─────────────┘
```

---

## 4. Distribution Layer / Embed Architecture

### 4.1 Three Delivery Modes

| Mode | URL Pattern | Use Case |
|------|-------------|----------|
| **Hosted Page** | `/configure/[slug]` | Full branded page with header/footer |
| **iframe Embed** | `/embed/configurator/[slug]` | Embed on external website |
| **JS Widget** | `widget.js` + shadow DOM | Advanced embed with auto-resize |

### 4.2 Embed Flow

```
External Website
  └── <script src="app.digitify.be/embed/widget.js" data-slug="..." />
        └── Creates Shadow DOM container
              └── Creates <iframe> pointing to /embed/configurator/[slug]
                    └── Loads PublicConfiguratorWizard
                    └── Posts messages: digitify:ready, digitify:resize, digitify:submitted
              └── Listens for postMessage → auto-resizes iframe
              └── Dispatches custom events → host page can react
```

### 4.3 CSS Isolation

- **EmbedShell** component uses `all: initial` to reset inherited styles
- **Shadow DOM** (in widget.js) for full CSS isolation on external sites
- Custom CSS injection via EmbedSettings.customCss

### 4.4 Auto-Resize Protocol

The `EmbedAutoResize` component:
1. Uses `ResizeObserver` on `document.documentElement`
2. Posts `{ type: "digitify:resize", height }` to parent
3. Parent's widget.js updates iframe height
4. Includes MutationObserver for dynamic content changes
5. Periodic fallback (2s interval) for edge cases

### 4.5 Event Callbacks

Host pages can listen for custom events:
```javascript
document.addEventListener('digitify:submitted', (e) => {
  console.log('Submission:', e.detail); // { configuratorId, total }
  // Trigger analytics, redirect, etc.
});
```

---

## 5. New File Index

### Services
| File | Purpose |
|------|---------|
| `src/lib/services/configurator.service.ts` | Full configurator CRUD, versioning, publishing, submission processing |
| `src/lib/services/pricing-engine.service.ts` | Stateless pricing evaluation engine with 7 rule types |
| `src/lib/services/public-embed.service.ts` | Embed code generation, domain validation, CSP headers |

### Validations
| File | Purpose |
|------|---------|
| `src/lib/validations/configurator.ts` | Zod schemas for configurators, versions, blocks, pricing rules, submissions |

### App Routes (Authenticated)
| Route | Purpose |
|-------|---------|
| `[workspaceSlug]/configurators/page.tsx` | Configurator list (grid cards) |
| `[workspaceSlug]/configurators/[id]/page.tsx` | Configurator detail with version overview, submissions, embed codes |
| `[workspaceSlug]/configurators/[id]/builder/page.tsx` | Full-screen 3-panel builder |

### Public Routes (Unauthenticated)
| Route | Purpose |
|-------|---------|
| `/configure/[slug]` | Full hosted configurator page |
| `/embed/configurator/[slug]` | Stripped embed configurator (iframe target) |
| `/embed/booking/[slug]` | Stripped embed booking widget (iframe target) |

### API Routes
| Route | Purpose |
|-------|---------|
| `POST /api/public/configurator/submit` | Public submission endpoint |
| `POST /api/configurators/[id]/versions` | Create new version (authenticated) |
| `POST /api/configurators/[id]/publish` | Publish a version (authenticated) |

### Components
| File | Purpose |
|------|---------|
| `configurator-builder.tsx` | Premium 3-panel builder with structure tree, live preview, property panels |
| `public-configurator-wizard.tsx` | Multi-step wizard with live pricing, block renderers, submission |
| `embed-shell.tsx` | CSS-isolated wrapper for embed pages |
| `embed-auto-resize.tsx` | postMessage-based iframe height sync |
| `public/embed/widget.js` | External JS loader with Shadow DOM, auto-resize, event callbacks |

### Prisma Schema Additions
- 8 new models: `Configurator`, `ConfiguratorVersion`, `ConfiguratorStep`, `ConfiguratorBlock`, `PricingRule`, `ConfiguratorSubmission`, `EmbedSettings`, `BookingPage`
- 5 new enums: `ConfiguratorStatus`, `ConfiguratorBlockType`, `PricingRuleType`, `ConfiguratorSubmissionStatus`, `EmbedType`

### Updated Files
- `prisma/schema.prisma` — Added all new models + Workspace relation
- `src/lib/permissions.ts` — Added CONFIGURATOR_VIEW/CREATE/EDIT permissions (bits 28-30)
- `src/config/navigation.ts` — Added "Builders" section with Configurators link
- `src/components/shared/status-badge.tsx` — Added PUBLISHED status

---

## 6. Pricing Engine Example

For a "Website Offerte" configurator:

```typescript
const rules: PricingRuleConfig[] = [
  { key: "base", label: "Basis website", ruleType: "FIXED", config: { amount: 500 }, position: 0 },
  { key: "pages", label: "Pagina's", ruleType: "PER_UNIT", config: { amountPerUnit: 150, fieldKey: "pageCount" }, position: 1 },
  { key: "seo", label: "SEO optimalisatie", ruleType: "CONDITIONAL", config: { amount: 300, condition: { "in": ["seo", { "var": "addons" }] } }, position: 2 },
  { key: "express", label: "Express levering", ruleType: "MULTIPLIER", config: { factor: 1.5, condition: { "==": [{ "var": "urgency" }, "express"] } }, position: 3 },
  { key: "btw", label: "BTW 21%", ruleType: "PERCENTAGE", config: { percentage: 21, of: "subtotal" }, position: 4 },
];

const selections = { projectType: "website", pageCount: 8, addons: ["seo", "analytics"], urgency: "normal" };
const result = calculatePrice(rules, selections);
// → subtotal: €2000, taxAmount: €420, total: €2420
// → lineItems: [Basis €500, Pagina's €1200, SEO €300, BTW €420]
```

---

## 7. Migration Plan

### From v2 (current state)
- No data migration needed — all new models
- Existing Workspace model gets `configurators` relation
- Existing permissions extended with 3 new bits (28-30)
- Navigation updated with new "Builders" section
- StatusBadge extended with PUBLISHED status

### From WordPress Offerte Maker (legacy plugin)
- Export existing templates → map to ConfiguratorVersion schemas
- Export submission history → import as ConfiguratorSubmission records
- Update embed codes on client websites from WP shortcodes to new JS widget
- Redirect old URLs to new hosted pages

---

## 8. Roadmap

| Phase | Scope |
|-------|-------|
| **Phase 1** (Current) | Core configurator CRUD, builder UI, pricing engine, public wizard, embed architecture |
| **Phase 2** | Drag-and-drop block reordering, version diffing, A/B testing |
| **Phase 3** | PDF generation from submissions, auto-quote creation |
| **Phase 4** | Advanced analytics (funnel, drop-off, conversion rates) |
| **Phase 5** | Booking page builder (same 3-panel UX for booking type customization) |
| **Phase 6** | Marketplace — shareable configurator templates |
