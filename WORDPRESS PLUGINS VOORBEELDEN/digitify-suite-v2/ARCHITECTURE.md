# Digitify Suite v2 — Production SaaS Architecture Blueprint

## 1. Executive Summary

Digitify Suite v2 is a complete rebuild of the proof-of-concept prototype into a
production-grade, multi-tenant SaaS platform for agencies, service businesses, and
operational SMEs. It replaces the localStorage-backed, single-file module system with
a proper Next.js App Router application backed by PostgreSQL/Prisma, featuring strict
domain boundaries, RBAC, workspace isolation, event-driven automation, and both
internal team workflows and client-facing public surfaces.

**Key decisions:**
- **Auth**: NextAuth v5 (Auth.js) — open-source, self-hosted, full control over user
  model, no vendor lock-in, native Prisma adapter. Clerk is great but costs $25/mo+
  per workspace at scale and locks you into their user model.
- **Multi-tenancy**: Workspace-slug routing (`/app/[workspaceSlug]/...`) with
  row-level tenancy via `workspaceId` foreign key on every tenant-scoped entity.
- **State**: Server Components by default. TanStack Query only for interactive lists
  and optimistic mutations. Zustand for ephemeral UI state (command palette, sidebar).
- **Email**: Resend — best DX, React Email integration, reasonable pricing.
- **Jobs**: Trigger.dev v3 — native Next.js integration, typed jobs, dashboard.
- **Storage**: UploadThing for MVP, abstract behind `FileService` for future S3 swap.
- **PDF**: `@react-pdf/renderer` server-side for quotes/invoices.
- **Billing**: Stripe Subscriptions with webhook-driven state sync.
- **Permissions**: Bitfield RBAC with workspace-scoped roles.

---

## 2. Key Failures in Current Prototype

| # | Problem | Severity |
|---|---------|----------|
| 1 | localStorage repos — no persistence, no multi-device, no queries | Critical |
| 2 | No auth/session — anyone can access everything | Critical |
| 3 | No workspace isolation — single-tenant by design | Critical |
| 4 | Business logic mixed into render functions | High |
| 5 | No API boundary — DOM-coupled onclick handlers | High |
| 6 | No validation layer — raw form data flows everywhere | High |
| 7 | No type safety — plain JS, no TypeScript, no schemas | High |
| 8 | Module files are 500+ line monoliths | Medium |
| 9 | No reusable page patterns — each module reinvents list/detail | Medium |
| 10 | No event/activity system — timeline is hardcoded seed data | Medium |
| 11 | No quote/invoice lifecycle model | Medium |
| 12 | No notification, search, or command palette | Low |
| 13 | No mobile responsiveness strategy beyond breakpoint hacks | Low |

**What's salvageable:** The conceptual module structure (Dashboard, CRM, Leads, Booking,
Agenda, Offertes, Companies, Settings) maps roughly to the new architecture. The seed
data shapes inform the Prisma model. The CSS design tokens and color palette can inspire
the Tailwind theme. Everything else must be rebuilt.

---

## 3. Product Vision 2.0

**Digitify Suite** = the operating system for service businesses.

Not a CRM. Not a project manager. Not a booking tool. All three, unified.

A single platform where a 3-50 person agency or service company manages their entire
commercial operation: from first lead to signed quote to invoiced payment to recurring
client relationship.

**Core value props:**
1. Unified pipeline: Lead → Deal → Quote → Invoice — one flow, one system
2. Client-facing surfaces: booking pages, proposal pages, intake forms, client portal
3. Multi-brand workspaces: agencies managing multiple brands from one account
4. Automation-ready: trigger emails, tasks, stage changes on events
5. Premium UX: Stripe/Linear quality, not generic admin dashboard

---

## 4. Recommended Information Architecture

### Sidebar Structure

```
┌─────────────────────────┐
│ [Workspace Switcher]    │
├─────────────────────────┤
│                         │
│ 🏠 Dashboard            │
│                         │
│ ─── RELATIONSHIPS ───── │
│ 👤 Contacts             │
│ 🏢 Organizations        │
│                         │
│ ─── PIPELINE ────────── │
│ 🎯 Leads                │
│ 💼 Deals                │
│                         │
│ ─── REVENUE ─────────── │
│ 📄 Quotes               │
│ 💰 Invoices             │
│                         │
│ ─── OPERATIONS ──────── │
│ 📅 Scheduling           │
│ 📋 Planner              │
│                         │
│ ─── ENGAGE ──────────── │
│ 📝 Forms                │
│ 📨 Templates            │
│ ⚡ Automations          │
│                         │
│ ─── INSIGHTS ────────── │
│ 📊 Analytics            │
│                         │
├─────────────────────────┤
│ ⚙️ Settings             │
│ 👥 Team                 │
│ 🔌 Integrations        │
└─────────────────────────┘
```

### Key Naming Decisions

| Old Name | New Name | Rationale |
|----------|----------|-----------|
| CRM | Contacts | "CRM" is the whole product, not a page |
| Companies | Organizations | Industry-standard, clearer relationship model |
| Offertes | Quotes | English-first product, "Quotes & Proposals" label |
| Booking | Scheduling | Broader scope: availability, booking types, public pages |
| Agenda | Planner | Merged agenda + tasks into unified workspace planner |
| Leads + pipeline | Leads + Deals | Separated: Leads = inbound unqualified, Deals = qualified pipeline |

### Key Merges/Splits

- **Agenda + Tasks → Planner**: One unified view with calendar + task list + timeline
- **Leads vs Deals**: Leads are pre-qualification (inbound). Deals are qualified
  opportunities in a pipeline. Lead converts to Deal.
- **Settings**: Split into sub-pages: General, Team, Billing, Integrations, Branding,
  Notifications, API Keys

---

## 5. Recommended Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Next.js 15 (App Router) | RSC, streaming, route groups, middleware |
| Language | TypeScript (strict) | Non-negotiable for production SaaS |
| Styling | Tailwind CSS 4 | Utility-first, design token compatible |
| Components | shadcn/ui | Composable, owns the code, excellent quality |
| ORM | Prisma 6 | Type-safe, migrations, excellent DX |
| Database | PostgreSQL 16 | JSONB, full-text search, proven at scale |
| Auth | NextAuth v5 (Auth.js) | Self-hosted, Prisma adapter, full control |
| Validation | Zod | Runtime + static types, composable schemas |
| Forms | React Hook Form | Performant, Zod resolver, field arrays |
| Client State | Zustand (minimal) | Sidebar, command palette, ephemeral UI only |
| Server State | TanStack Query v5 | Optimistic updates, infinite scroll, cache |
| Email | Resend + React Email | Best DX, transactional + marketing |
| Jobs | Trigger.dev v3 | Typed background jobs, dashboard, retries |
| Storage | UploadThing → S3 | Simple start, abstract for swap |
| PDF | @react-pdf/renderer | Server-side quote/invoice generation |
| Payments | Stripe | Subscriptions, invoicing, checkout |
| Search | PostgreSQL full-text → Meilisearch | Start simple, upgrade when needed |
| Monitoring | Sentry + Vercel Analytics | Error tracking + performance |
| Deployment | Vercel | Native Next.js, edge middleware, previews |

---

## 6. Production Folder Structure

```
digitify-suite-v2/
├── prisma/
│   ├── schema.prisma           # Full data model
│   ├── seed.ts                 # Development seed data
│   └── migrations/             # Auto-generated
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root: providers, fonts, metadata
│   │   ├── (auth)/             # Auth routes (no app shell)
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── invite/[token]/page.tsx
│   │   ├── (app)/              # Authenticated app shell
│   │   │   ├── layout.tsx      # App shell: sidebar + topbar + providers
│   │   │   └── [workspaceSlug]/
│   │   │       ├── layout.tsx  # Workspace resolver + context
│   │   │       ├── page.tsx    # Dashboard
│   │   │       ├── contacts/
│   │   │       │   ├── page.tsx         # List
│   │   │       │   └── [id]/page.tsx    # Detail
│   │   │       ├── organizations/
│   │   │       ├── leads/
│   │   │       ├── deals/
│   │   │       ├── quotes/
│   │   │       │   ├── page.tsx
│   │   │       │   ├── new/page.tsx
│   │   │       │   └── [id]/page.tsx
│   │   │       ├── invoices/
│   │   │       ├── scheduling/
│   │   │       ├── planner/
│   │   │       ├── forms/
│   │   │       ├── templates/
│   │   │       ├── automations/
│   │   │       ├── analytics/
│   │   │       └── settings/
│   │   │           ├── layout.tsx       # Settings shell
│   │   │           ├── general/page.tsx
│   │   │           ├── team/page.tsx
│   │   │           ├── billing/page.tsx
│   │   │           └── integrations/page.tsx
│   │   ├── (public)/           # Unauthenticated public surfaces
│   │   │   ├── book/[slug]/page.tsx     # Public booking
│   │   │   ├── proposal/[token]/page.tsx # Public quote view
│   │   │   └── portal/[token]/page.tsx  # Client portal
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── webhooks/stripe/route.ts
│   │       └── uploadthing/route.ts
│   ├── lib/
│   │   ├── db.ts               # Prisma client singleton
│   │   ├── auth.ts             # Auth config + helpers
│   │   ├── auth-guard.ts       # Server-side auth guard
│   │   ├── workspace.ts        # Workspace resolver
│   │   ├── permissions.ts      # RBAC engine
│   │   ├── activity.ts         # Activity logger
│   │   ├── errors.ts           # Typed error classes
│   │   ├── constants.ts        # App-wide constants
│   │   ├── utils.ts            # Shared utilities
│   │   ├── validations/        # Zod schemas
│   │   │   ├── contacts.ts
│   │   │   ├── deals.ts
│   │   │   ├── quotes.ts
│   │   │   └── ...
│   │   └── services/           # Domain service layer
│   │       ├── base.service.ts
│   │       ├── contacts.service.ts
│   │       ├── deals.service.ts
│   │       ├── quotes.service.ts
│   │       ├── scheduling.service.ts
│   │       ├── invoices.service.ts
│   │       ├── activity.service.ts
│   │       └── ...
│   ├── components/
│   │   ├── ui/                 # shadcn/ui primitives (generated)
│   │   ├── layout/
│   │   │   ├── app-shell.tsx
│   │   │   ├── sidebar.tsx
│   │   │   ├── sidebar-config.ts
│   │   │   ├── workspace-switcher.tsx
│   │   │   ├── command-bar.tsx
│   │   │   ├── command-palette.tsx
│   │   │   ├── notification-center.tsx
│   │   │   └── user-menu.tsx
│   │   ├── shared/
│   │   │   ├── data-table.tsx
│   │   │   ├── page-header.tsx
│   │   │   ├── record-detail.tsx
│   │   │   ├── activity-feed.tsx
│   │   │   ├── empty-state.tsx
│   │   │   ├── status-badge.tsx
│   │   │   ├── avatar-stack.tsx
│   │   │   └── confirm-dialog.tsx
│   │   └── modules/
│   │       ├── contacts/
│   │       ├── deals/
│   │       ├── quotes/
│   │       └── ...
│   ├── hooks/
│   │   ├── use-workspace.ts
│   │   ├── use-permissions.ts
│   │   ├── use-debounce.ts
│   │   └── ...
│   ├── types/
│   │   ├── index.ts
│   │   └── permissions.ts
│   └── config/
│       ├── site.ts
│       └── navigation.ts
├── public/
├── .env.example
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

---

## 7. Frontend Architecture

### App Shell Pattern
The app uses a persistent shell (`AppShell` component) with:
- **Sidebar**: Fixed left, 260px, workspace switcher at top, nav sections, settings at bottom
- **Command Bar**: Top strip with search trigger (⌘K), quick create (+), notifications, user avatar
- **Content Area**: Scrollable, max-width 7xl container with consistent padding

### Page Patterns (reusable across all modules)
1. **List Page**: PageHeader → Filters/Search → DataTable → Pagination
2. **Detail Page**: PageHeader + breadcrumbs → 2/3 main + 1/3 activity sidebar
3. **Create/Edit Page**: PageHeader → Form card with sections → Submit footer
4. **Settings Page**: Section cards with description + form + save footer (Stripe pattern)

### State Strategy
- **Server Components by default** — data fetching in page.tsx via service layer
- **TanStack Query** — only for interactive lists (optimistic drag on Kanban, infinite scroll)
- **Zustand** — only for ephemeral UI: command palette open/close, sidebar collapse state
- **URL state** — filters, pagination, sort order live in searchParams (shareable, bookmarkable)

### Component Organization
```
components/
├── ui/          # shadcn/ui primitives (Button, Input, Dialog, Select, etc.)
├── layout/      # App shell, sidebar, command palette, workspace switcher
├── shared/      # Reusable: PageHeader, DataTable, StatusBadge, EmptyState, ActivityFeed
└── modules/     # Module-specific: ContactForm, DealKanban, QuoteBuilder, BookingWidget
```

---

## 8. Backend / API Architecture

### Architecture Decision: Service Layer + Server Components

**No separate REST API needed.** Next.js App Router + Server Components + Server Actions
provide a clean server-side execution model:

- **Server Components** call services directly for reads (list, detail pages)
- **Server Actions** call services for mutations (create, update, delete)
- **API Route Handlers** only for: webhooks (Stripe, integrations), public API, file uploads

### Service Layer Pattern
```
Page Component → Service → Prisma → PostgreSQL
                    ↓
              Activity Logger → Activity table
                    ↓
              Event Bus → Automation Engine (future)
```

Every service:
1. Extends `BaseService` (inherits workspace scoping + RBAC assertion)
2. Receives `ServiceContext` (workspaceId, userId, role, permissions)
3. Validates input (Zod schemas at the boundary)
4. Executes business logic
5. Logs activity
6. Returns typed result

### Route Structure
```
/app/[workspaceSlug]/              → Dashboard (server component)
/app/[workspaceSlug]/contacts      → Contacts list (server component)
/app/[workspaceSlug]/contacts/[id] → Contact detail (server component)
/app/[workspaceSlug]/deals         → Deals pipeline (client for Kanban drag)
/app/[workspaceSlug]/quotes/new    → Quote builder (client for dynamic form)
/app/[workspaceSlug]/settings/*    → Settings sections (server components)

/book/[slug]                       → Public booking (server + client widget)
/proposal/[token]                  → Public quote view (server component)
/portal/[token]                    → Client portal (server component)

/api/auth/[...nextauth]            → Auth endpoints
/api/webhooks/stripe               → Stripe webhook handler
/api/uploadthing                   → File upload endpoint
```

---

## 9. Prisma / Domain Model

See `prisma/schema.prisma` for the complete model (35+ models, all documented).

### Key Design Decisions
- **Tenancy**: Every business entity has `workspaceId` FK + composite index
- **Soft delete**: `archivedAt` on Contact, Organization, Deal (not hard delete)
- **Dedup**: Contact email is unique per workspace (`@@unique([workspaceId, email])`)
- **Pipeline**: Separate Pipeline → PipelineStage → Deal chain (multiple pipelines per workspace)
- **Quote lifecycle**: DRAFT → SENT → VIEWED → ACCEPTED/DECLINED → INVOICED (tracked with timestamps)
- **Public tokens**: Quote.publicToken for unauthenticated proposal viewing
- **JSON flexibility**: Workspace.settings, AutomationRule.trigger/actions, Form.schema stored as JSON

---

## 10. RBAC + Multi-Tenant Model

### Multi-Tenancy
- **Row-level isolation**: Every query includes `workspaceId` in WHERE clause
- **URL-based routing**: `/app/[workspaceSlug]/...` identifies the active workspace
- **Workspace resolver**: Server-side middleware verifies membership before data access
- **Cross-workspace**: Users can belong to multiple workspaces (agencies managing brands)

### RBAC
- **4 built-in roles**: OWNER, ADMIN, MEMBER, VIEWER
- **28 permission bits**: Bitfield stored as integer, checked via bitwise AND
- **Role defaults**: Each role maps to a default permission mask
- **Per-member overrides**: Optional explicit permission field on WorkspaceMember
- **Enforcement**: BaseService.assertPermission() called before every operation

---

## 11. Activity / Event / Automation Architecture

### Activity System
Every business event creates an Activity record:
- **Type**: Dotted notation (`contact.created`, `deal.stage_changed`, `quote.accepted`)
- **Summary**: Human-readable text for display
- **Metadata**: Structured JSON for automation matching
- **Links**: entityType + entityId for polymorphic navigation, contactId for timeline

### Audit Logging
Separate AuditLog table for compliance:
- Records create/update/delete operations with field-level change tracking
- Includes IP address and user agent
- Append-only (never deleted)

### Automation Engine (Phase 6)
```
Trigger (event type + conditions) → Actions (send email, create task, change stage, webhook)
```
- AutomationRule stores trigger config + action chain as JSON
- AutomationRun tracks execution history
- Executed via Trigger.dev background jobs

---

## 12. UX/UI System

### Design Language
- **Font**: Inter (system-compatible, excellent for data-dense UIs)
- **Colors**: Indigo primary (#6366f1), semantic status colors, neutral gray scale
- **Radius**: 0.5rem default (slightly rounded, not bubbly)
- **Shadows**: Minimal — borders for structure, shadows only for overlays/modals
- **Spacing**: 4px grid, generous padding in cards (p-6), tight in tables (py-3)
- **Typography**: tracking-tight on headings, text-sm for body, text-xs for labels

### Key Patterns
- **Cards**: `rounded-xl border border-border bg-card p-6`
- **Tables**: Grid-based (not `<table>`), sortable headers, hover rows
- **Badges**: Color-coded status with border + background + text
- **Empty states**: Icon + title + description + CTA in dashed border
- **Forms**: Label above, border input, focus ring, save button in footer
- **Settings**: Section card with header (title + description) + content + save footer

---

## 13. Module-by-Module Redesign

### Dashboard
- **Purpose**: At-a-glance workspace health
- **KPIs**: Contact count, active leads, open quotes value, won revenue, upcoming bookings
- **Quick actions**: Links to common create flows
- **Activity feed**: Recent activities across all modules
- **Rebuild**: Fully new. KPI queries are Prisma aggregates, activity feed is server component.

### Contacts
- **Purpose**: Central person records that connect all modules
- **Screens**: List (searchable, filterable, paginated), Detail (info + tags + timeline + related)
- **Key flows**: Create, edit, archive, tag, merge, import CSV
- **From prototype**: Contact model survives but is rebuilt with proper relations

### Organizations
- **Purpose**: Company/account records linked to contacts
- **Screens**: List, Detail (contacts + deals + quotes)
- **New**: Didn't exist properly in prototype (was "Companies" = workspaces, not clients)

### Leads
- **Purpose**: Inbound unqualified prospects before they enter the sales pipeline
- **Screens**: List with status filters, Detail, Convert to Deal flow
- **Lifecycle**: NEW → CONTACTED → QUALIFIED → CONVERTED / LOST
- **From prototype**: Lead model survives, pipeline stages are now on Deal

### Deals
- **Purpose**: Qualified sales opportunities in a visual pipeline
- **Screens**: Kanban board (drag between stages), List view, Detail
- **New**: Proper Pipeline model with configurable stages per workspace

### Quotes (Offertes)
- **Purpose**: Generate, send, and track proposals/offertes
- **Screens**: List, Detail (document view), Builder (create/edit form), Public proposal page
- **Lifecycle**: DRAFT → SENT → VIEWED → ACCEPTED/DECLINED → INVOICED
- **Key features**: Section-based line items, auto-calculate totals, public token link, PDF export, e-signature
- **From prototype**: Core concept preserved but rebuilt with sections model and public pages

### Invoices
- **Purpose**: Bill clients, track payments
- **Screens**: List, Detail, Create from quote
- **Lifecycle**: DRAFT → SENT → VIEWED → PAID / OVERDUE / VOID
- **New**: Not in prototype. Phase 5.

### Scheduling
- **Purpose**: Client-facing booking system (Calendly-like)
- **Screens**: Booking types management, Availability editor, Bookings list, Public booking page
- **From prototype**: Calendar and slot logic rewritten as React component

### Planner
- **Purpose**: Internal team planning — calendar events + tasks in one view
- **Screens**: Week view (calendar), Task list, Kanban
- **From prototype**: Merges Agenda + Tasks from prototype

### Forms
- **Purpose**: Custom intake forms for lead capture, onboarding, feedback
- **Screens**: Form builder, Submissions list, Public form page
- **New**: Not in prototype. Phase 4.

### Templates
- **Purpose**: Reusable email/quote/proposal templates with variables
- **From prototype**: Templates concept survives, rebuilt with proper CRUD

### Automations
- **Purpose**: When X happens, do Y. Rule-based workflow automation.
- **New**: Phase 6. Trigger-action model with background job execution.

### Analytics
- **Purpose**: Revenue reports, pipeline metrics, conversion rates, activity analytics
- **New**: Phase 6. Server-side aggregation queries.

### Settings
- **Purpose**: Workspace configuration
- **Sections**: General, Team, Branding, Notifications, Billing, Integrations, API Keys
- **UX**: Stripe/Vercel pattern — section cards with description + form + save footer

---

## 14. Migration Strategy

### What survives from prototype
- ✅ Module concepts (Dashboard, CRM, Leads, Booking, Agenda, Offertes)
- ✅ Data model shapes (contacts, leads, quotes, bookings, tags, activities)
- ✅ UI patterns (list/detail, pipeline stages, status badges)
- ✅ Seed data structure (translates to Prisma seed)
- ✅ Color palette / design token concept

### What must die
- ❌ All localStorage code
- ❌ All inline onclick / DOM-coupled JS
- ❌ Monolithic module files (500+ line render functions)
- ❌ Manual HTML string building
- ❌ Hash-based router
- ❌ Global store pattern
- ❌ CSS class name mismatches
- ❌ No-auth architecture

### Migration approach
1. **Start fresh** — don't port code, port concepts
2. **Prisma schema first** — model the domain properly before writing UI
3. **Service layer second** — business logic before rendering
4. **One module at a time** — Dashboard → Contacts → Deals → Quotes (prioritized by value)
5. **Seed data** — translate prototype seed.js to Prisma seed.ts

---

## 15. Phased Roadmap

### Phase 1: Foundation (Week 1-2)
- Next.js project setup with App Router
- Prisma schema + migrations
- NextAuth (credentials + Google)
- Workspace creation + member management
- App shell (sidebar, command bar, workspace switcher)
- Settings pages (general, team)
- Seed data for development
- Deploy to Vercel

### Phase 2: CRM + Pipeline (Week 3-4)
- Contacts CRUD (list, detail, create, edit, archive)
- Organizations CRUD
- Tags system
- Leads CRUD with status management
- Deals with Pipeline + Kanban board
- Activity timeline on contact/deal detail
- Search across contacts/deals

### Phase 3: Quotes + Public Proposals (Week 5-6)
- Quote builder (sections + line items + auto-calc)
- Quote detail page (document view)
- Quote status lifecycle
- Public proposal page (/proposal/[token])
- Quote accept/decline flow
- PDF generation with @react-pdf
- Email sending via Resend

### Phase 4: Scheduling + Planner (Week 7-8)
- Booking types management
- Availability rules editor
- Public booking page (/book/[slug])
- Calendar events (week view)
- Tasks CRUD with status/priority
- Planner unified view

### Phase 5: Invoices + Payments (Week 9-10)
- Invoice creation (standalone + from quote)
- Invoice detail + PDF
- Stripe integration for online payments
- Subscription billing for Digitify Suite itself
- Billing settings page

### Phase 6: Automations + Analytics (Week 11-13)
- Automation rule builder (trigger → action)
- Background job execution (Trigger.dev)
- Email automation (welcome, follow-up, reminder)
- Analytics dashboard (revenue, pipeline, conversion)
- Forms builder + public form pages

### Phase 7: Scale + Polish (Week 14+)
- Client portal
- White-label / multi-brand
- Advanced RBAC (custom roles)
- Import/export (CSV, API)
- Integrations (Google Calendar, Slack, Zapier)
- Mobile responsive optimization
- Performance optimization
- SOC 2 / GDPR compliance documentation

---

## 16. Starter Code Scaffolding

All starter code is in the `src/` directory. Key files:

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Complete 35+ model data schema |
| `src/app/(app)/layout.tsx` | Authenticated app shell with workspace loading |
| `src/app/(app)/[workspaceSlug]/layout.tsx` | Workspace resolver |
| `src/app/(app)/[workspaceSlug]/page.tsx` | Dashboard with KPI queries |
| `src/app/(app)/[workspaceSlug]/contacts/page.tsx` | Contacts list (canonical list pattern) |
| `src/app/(app)/[workspaceSlug]/contacts/[id]/page.tsx` | Contact detail (canonical detail pattern) |
| `src/app/(app)/[workspaceSlug]/quotes/[id]/page.tsx` | Quote document view |
| `src/app/(app)/[workspaceSlug]/settings/layout.tsx` | Settings shell (Stripe pattern) |
| `src/app/(app)/[workspaceSlug]/settings/general/page.tsx` | General settings |
| `src/app/(auth)/login/page.tsx` | Login page |
| `src/app/(public)/proposal/[token]/page.tsx` | Public quote view + accept/decline |
| `src/app/(public)/book/[slug]/page.tsx` | Public booking page |
| `src/components/layout/app-shell.tsx` | Main app layout |
| `src/components/layout/sidebar.tsx` | Navigation sidebar |
| `src/components/layout/workspace-switcher.tsx` | Workspace dropdown |
| `src/components/layout/command-bar.tsx` | Top search/action bar |
| `src/components/layout/command-palette.tsx` | ⌘K command palette |
| `src/components/shared/page-header.tsx` | Reusable page header |
| `src/components/shared/status-badge.tsx` | Status badge with Dutch labels |
| `src/components/shared/activity-feed.tsx` | Activity timeline component |
| `src/components/shared/empty-state.tsx` | Empty state pattern |
| `src/components/modules/scheduling/public-booking-widget.tsx` | Client-side booking calendar |
| `src/config/navigation.ts` | Sidebar nav configuration |
| `src/lib/db.ts` | Prisma client singleton |
| `src/lib/auth.ts` | NextAuth v5 config |
| `src/lib/auth-guard.ts` | Server-side auth + workspace resolver |
| `src/lib/permissions.ts` | Bitfield RBAC engine |
| `src/lib/activity.ts` | Activity + audit logger |
| `src/lib/errors.ts` | Typed error classes |
| `src/lib/utils.ts` | Shared utilities |
| `src/lib/validations/contacts.ts` | Contact Zod schemas |
| `src/lib/validations/quotes.ts` | Quote Zod schemas |
| `src/lib/services/base.service.ts` | Base service with tenancy + RBAC |
| `src/lib/services/contacts.service.ts` | Full contacts service |
| `src/lib/services/quotes.service.ts` | Full quotes service |
| `src/hooks/use-command-palette.ts` | Zustand store for ⌘K |

---

## 17. What to Build First and Why

**Build Phase 1 + Phase 2 first.**

Why:
1. **Foundation** (auth, workspace, shell) is required for everything else
2. **Contacts + Deals** is the core value prop — it's the "CRM" that people sign up for
3. Everything else (quotes, booking, planning) depends on having contacts and deals
4. You can ship a useful product with just contacts + organizations + deals + pipeline

**First deploy target**: A working CRM with:
- Login / Google auth
- Workspace creation
- Contact list + detail
- Deal pipeline (Kanban)
- Activity timeline
- Settings

That's a shippable MVP in 4 weeks. Then layer on quotes, booking, and the rest iteratively.

**Do NOT try to build everything at once.** The prototype made that mistake — it built 8 modules
superficially instead of building 3 modules deeply. Go deep on CRM + Pipeline first.
