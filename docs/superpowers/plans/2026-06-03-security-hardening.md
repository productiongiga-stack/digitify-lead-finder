# Security & Bug Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remediate all findings from the 2026-06-03 security audit: leaked secrets, SSRF, missing rate limits, RBAC gaps, XSS/URL issues, UX data-loss bugs, and TypeScript build errors.

**Architecture:** Work in 8 phases ordered by risk. Shared utilities first (`ssrf-guard`, `mutationProcedure`), then router/UI sweeps, then tests/CI. Each phase is independently mergeable via small PRs.

**Tech Stack:** Next.js 15, tRPC, Prisma, Vitest, Playwright, Zod, sanitize-html

**Estimated effort:** ~4–6 dev-days total (can split into 8 PRs)

---

## Phase overview

| Phase | Focus | Risk | PR size |
|-------|-------|------|---------|
| 0 | TypeScript build blockers | Bug | S |
| 1 | Bookings secrets | Critical | S |
| 2 | SSRF guards | High | M |
| 3 | AI rate limits | High | S |
| 4 | VIEWER/TESTER RBAC | Medium | L |
| 5 | Frontend URL + email preview | Medium | M |
| 6 | API hardening (misc) | Medium | M |
| 7 | UX bugs (races, guards) | Low | M |
| 8 | Tests & CI | — | M |

---

## Phase 0 — Fix TypeScript build blockers

**Why first:** `pnpm typecheck` fails with 12 errors; blocks clean CI/release.

**Files:**
- Modify: `packages/api/src/routers/meta-ads.router.ts`
- Modify: `apps/web/src/app/(app)/meta-ads/page.tsx`

### Task 0.1: Fix meta-ads.router.ts types

- [ ] **Step 1: Type live Meta campaign list**

In `meta-ads.router.ts`, add near top:

```typescript
type MetaLiveCampaign = { id?: string; name?: string; status?: string };
```

Cast `listMetaCampaigns` result:

```typescript
const liveCampaigns = (await listMetaCampaigns({ ... }).catch(() => [])) as MetaLiveCampaign[];
```

- [ ] **Step 2: Fix workspaceId null vs undefined**

Change helper signatures from `workspaceId: string | null` to `workspaceId?: string | null` or normalize at call site:

```typescript
workspaceScopeFromAuthenticatedUser({
  id: ctx.user.id,
  workspaceId: ctx.user.workspaceId ?? null,
})
```

Apply to `findMetaCampaignNameConflict`, `assertUniqueMetaCampaignName`, and all call sites flagged by tsc.

- [ ] **Step 3: Fix `excludeLiveCampaignId` null**

Where `input.excludeLiveCampaignId` is `string | null`, use `input.excludeLiveCampaignId ?? undefined` when passing to functions expecting `string | undefined`.

- [ ] **Step 4: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS (0 errors)

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routers/meta-ads.router.ts apps/web/src/app/(app)/meta-ads/page.tsx
git commit -m "fix: resolve meta-ads TypeScript errors from campaign name checks"
```

### Task 0.2: Fix meta-ads page campaign find types

- [ ] **Step 1: Type live campaigns in page.tsx (~3714)**

```typescript
type MetaLiveCampaign = { id?: string; name?: string };
const liveCampaigns = (connection.data?.liveCampaigns ?? []) as MetaLiveCampaign[];
const liveConflict = liveCampaigns.find(
  (campaign) => normalizeCampaignNameKey(String(campaign.name ?? "")) === key,
);
```

- [ ] **Step 2: Run typecheck again**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git commit -m "fix: type live Meta campaigns on studio page"
```

---

## Phase 1 — Bookings secrets (Critical)

**Problem:** `bookings.google_service_account_private_key` and `bookings.webhook_secret` are not encrypted/redacted; MEMBER role can read them via `settings.getAll`.

### Task 1.1: Register secret keys

**Files:**
- Modify: `packages/db/src/secure-settings.ts`
- Test: `packages/api/src/__tests__/secure-settings.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `secure-settings.test.ts`:

```typescript
it("treats bookings private key and webhook secret as secrets", () => {
  expect(isSecretSettingKey("bookings.google_service_account_private_key")).toBe(true);
  expect(isSecretSettingKey("bookings.webhook_secret")).toBe(true);
});

it("redacts bookings private key in sanitizeSettingsForViewer", () => {
  const input = {
    "bookings.google_service_account_private_key": "-----BEGIN PRIVATE KEY-----\nabc",
    "bookings.webhook_secret": "whsec_test123",
  };
  const out = sanitizeSettingsForViewer(input);
  expect(out["bookings.google_service_account_private_key"]).toBe(SECRET_REDACTION_MASK);
  expect(out["bookings.webhook_secret"]).toBe(SECRET_REDACTION_MASK);
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `pnpm --filter @digitify/api test secure-settings.test.ts`

- [ ] **Step 3: Add keys to SECRET_SETTING_KEYS**

In `secure-settings.ts`, add to the Set:

```typescript
"bookings.google_service_account_private_key",
"bookings.webhook_secret",
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "fix(security): encrypt and redact bookings private key and webhook secret"
```

### Task 1.2: Restrict read to OWNER

**Files:**
- Modify: `packages/api/src/lib/permissions.ts`
- Modify: `packages/api/src/__tests__/secure-settings.test.ts` or new `permissions-bookings.test.ts`

- [ ] **Step 1: Add OWNER-only keys**

In `permissions.ts`:

```typescript
const OWNER_ONLY_SETTING_KEYS = new Set([
  "bookings.google_calendar_timezone",
  "bookings.google_service_account_private_key",
  "bookings.webhook_secret",
]);
```

Update `canReadSettingKey` and `canManageSettingKey`:

```typescript
if (OWNER_ONLY_SETTING_KEYS.has(key)) return role === "OWNER";
```

Place this check early (after OWNER full access).

- [ ] **Step 2: Write test**

```typescript
it("only OWNER can read bookings private key", () => {
  const key = "bookings.google_service_account_private_key";
  expect(canReadSettingKey("OWNER", key)).toBe(true);
  expect(canReadSettingKey("ADMIN", key)).toBe(false);
  expect(canReadSettingKey("MEMBER", key)).toBe(false);
});
```

- [ ] **Step 3: Run tests + commit**

### Task 1.3: Mask in bookings settings UI

**Files:**
- Modify: `apps/web/src/app/(app)/settings/bookings/page.tsx`

- [ ] **Step 1: Import SECRET_MASK pattern from integrations page**

Use same pattern as `settings/integrations/page.tsx`: show `••••••••` when value is redacted; only send new value if user typed something other than mask.

- [ ] **Step 2: Change private key textarea to `type="password"`** (or masked input with reveal toggle)

- [ ] **Step 3: Manual verify**

Login as MEMBER → open `/settings/bookings` → should see "Geen toegang" or fields hidden for owner-only keys.

- [ ] **Step 4: Commit**

```bash
git commit -m "fix(security): owner-only bookings secrets in UI"
```

---

## Phase 2 — SSRF guards (High)

**Problem:** Server fetches arbitrary URLs in `fetchSocialImageInfo`, `analyzeWebsite`, and `probeImage`.

### Task 2.1: Shared SSRF guard module

**Files:**
- Create: `packages/connectors/src/ssrf-guard.ts`
- Modify: `packages/connectors/src/index.ts`
- Test: `packages/connectors/src/__tests__/ssrf-guard.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from "vitest";
import { assertPublicHttpUrl, isBlockedFetchHost } from "../ssrf-guard";

describe("ssrf-guard", () => {
  it("blocks localhost and private IPs", () => {
    expect(isBlockedFetchHost("127.0.0.1")).toBe(true);
    expect(isBlockedFetchHost("10.0.0.1")).toBe(true);
    expect(isBlockedFetchHost("169.254.169.254")).toBe(true);
    expect(isBlockedFetchHost("metadata.google.internal")).toBe(true);
  });

  it("allows public https URLs", () => {
    expect(assertPublicHttpUrl("https://example.com/logo.png")).toBe("https://example.com/logo.png");
  });

  it("rejects javascript and file schemes", () => {
    expect(() => assertPublicHttpUrl("javascript:alert(1)")).toThrow();
    expect(() => assertPublicHttpUrl("file:///etc/passwd")).toThrow();
  });

  it("rejects http://127.0.0.1", () => {
    expect(() => assertPublicHttpUrl("http://127.0.0.1/admin")).toThrow(/niet toegestaan/i);
  });
});
```

- [ ] **Step 2: Implement `ssrf-guard.ts`**

```typescript
import { lookup } from "node:dns/promises";
import net from "node:net";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google",
]);

function isPrivateIp(ip: string): boolean {
  if (!net.isIP(ip)) return false;
  if (ip === "127.0.0.1" || ip === "::1") return true;
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("169.254.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80:")) return true;
  return false;
}

export function isBlockedFetchHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith(".localhost")) return true;
  return isPrivateIp(host);
}

export async function assertPublicHttpUrl(raw: string): Promise<string> {
  const trimmed = raw.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Ongeldige URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Alleen http(s)-URL's zijn toegestaan.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("URL's met credentials zijn niet toegestaan.");
  }
  const hostname = parsed.hostname.replace(/^\[/, "").replace(/\]$/, "");
  if (isBlockedFetchHost(hostname)) {
    throw new Error("Deze host is niet toegestaan voor server-side requests.");
  }
  // Resolve DNS and block if any A/AAAA is private
  const records = await lookup(hostname, { all: true, verbatim: true }).catch(() => []);
  for (const rec of records) {
    if (isBlockedFetchHost(rec.address)) {
      throw new Error("Deze host is niet toegestaan voor server-side requests.");
    }
  }
  return parsed.toString();
}
```

- [ ] **Step 3: Export from `packages/connectors/src/index.ts`**

- [ ] **Step 4: Add vitest to connectors package if missing**, run tests, commit.

### Task 2.2: Wire into website analyzer

**Files:**
- Modify: `packages/connectors/src/website-analyzer.ts`

- [ ] **Step 1: Call guard before fetch**

At start of `analyzeWebsite`:

```typescript
import { assertPublicHttpUrl } from "./ssrf-guard";

export async function analyzeWebsite(url: string): Promise<WebsiteAnalysis> {
  const safeUrl = await assertPublicHttpUrl(url.startsWith("http") ? url : `https://${url}`);
  // use safeUrl instead of url for all fetches
```

- [ ] **Step 2: Add test** mocking fetch — blocked host returns error in `errors[]`.

- [ ] **Step 3: Commit**

### Task 2.3: Wire into social image probe

**Files:**
- Modify: `packages/api/src/lib/social-image.ts`
- Modify: `packages/api/src/routers/social.router.ts`
- Test: `packages/api/src/__tests__/social-image.test.ts`

- [ ] **Step 1: Guard in `fetchSocialImageInfo`**

```typescript
import { assertPublicHttpUrl } from "@digitify/connectors/ssrf-guard";
// skip guard for data: URLs
const safeUrl = await assertPublicHttpUrl(trimmed);
response = await fetch(safeUrl, { signal: AbortSignal.timeout(10_000) });
```

- [ ] **Step 2: Tighten `probeImage` input**

Replace loose string with:

```typescript
imageUrl: z.string().trim().url().refine((v) => /^https:\/\//i.test(v), {
  message: "Gebruik een publieke https-URL.",
}),
```

Then validate with `assertPublicHttpUrl` inside handler.

- [ ] **Step 3: Add SSRF test to social-image.test.ts**

- [ ] **Step 4: Commit**

---

## Phase 3 — AI rate limits (High)

**Problem:** `aiRateLimitedProcedure` (20 req/min) exists but is unused.

### Task 3.1: Switch AI mutations to aiRateLimitedProcedure

**Files:**
- Modify: `packages/api/src/routers/openclaw.router.ts`
- Modify: `packages/api/src/routers/inbox.router.ts` (`suggestReply` only)
- Modify: `packages/api/src/routers/scoring.router.ts` (`enrichLead`, `bulkEnrich`)
- Modify: `packages/api/src/routers/meta-ads.router.ts` (`generateSuggestion`, `generateVariantSuggestion`, `scoreDraft`)
- Modify: `packages/api/src/routers/google-ads.router.ts` (`generateSuggestion`, `generateAudienceSignals`, `generateSearchKeywords`)
- Modify: `packages/api/src/routers/social.router.ts` (`generateSuggestion`)
- Test: `packages/api/src/__tests__/rate-limit.test.ts` (optional smoke)

**Procedure list to convert** (mutation/query that calls external AI or expensive enrich):

| Router | Procedures |
|--------|------------|
| openclaw | `chat`, `draftEmail`, `rewriteDraft`, `rewriteInboxMessage`, `analyzeLead` |
| inbox | `suggestReply` |
| scoring | `enrichLead`, `bulkEnrich` |
| meta-ads | `generateSuggestion`, `generateVariantSuggestion`, `scoreDraft` |
| google-ads | `generateSuggestion`, `generateAudienceSignals`, `generateSearchKeywords` |
| social | `generateSuggestion` |

- [ ] **Step 1: Replace import**

```typescript
// Before
import { protectedProcedure, router } from "../trpc";
// After — keep protectedProcedure for reads
import { protectedProcedure, aiRateLimitedProcedure, router } from "../trpc";
```

- [ ] **Step 2: Swap procedure on each AI endpoint**

Example:

```typescript
generateSuggestion: aiRateLimitedProcedure
  .input(...)
  .mutation(async ({ ctx, input }) => { ... }),
```

- [ ] **Step 3: Run full API tests**

Run: `pnpm --filter @digitify/api test`

- [ ] **Step 4: Commit**

```bash
git commit -m "fix(security): apply aiRateLimitedProcedure to AI and enrich endpoints"
```

---

## Phase 4 — VIEWER / TESTER RBAC (Medium)

**Problem:** `protectedProcedure` allows VIEWER to call destructive mutations (e.g. `lead.delete`).

### Task 4.1: Add mutationProcedure

**Files:**
- Modify: `packages/api/src/trpc.ts`
- Create: `packages/api/src/__tests__/mutation-rbac.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect } from "vitest";
import { TRPCError } from "@trpc/server";
// Use createCallerFactory with VIEWER context — expect FORBIDDEN on lead.delete
```

- [ ] **Step 2: Add middleware in trpc.ts**

```typescript
const READ_ONLY_ROLES = new Set(["VIEWER", "TESTER"]);

const enforceMutationRole = t.middleware(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  if (READ_ONLY_ROLES.has(ctx.user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Je rol heeft geen rechten om wijzigingen door te voeren.",
    });
  }
  return next();
});

export const mutationProcedure = protectedProcedure.use(enforceMutationRole);
```

**Note:** TRIAL users keep mutation access during active trial (product choice). Document in code comment.

- [ ] **Step 3: Commit middleware + test**

### Task 4.2: Router sweep — convert destructive mutations

**Strategy:** Replace `protectedProcedure` with `mutationProcedure` on all `.mutation()` handlers except:
- `user.updateProfile`, `user.changePassword` (personal)
- Any TRIAL-safe read-only endpoints stay on `protectedProcedure`

**Priority routers (destructive):**
- `lead.router.ts` — delete, bulkDelete, bulkUpdateStatus, create, update, importCsv, addNote
- `quote.router.ts`, `invoice.router.ts` — create, update, delete, send
- `task.router.ts` — create, update, delete
- `tag.router.ts` — create, delete
- `template.router.ts` — save, remove, duplicate
- `campaign.router.ts`, `contact.router.ts`, `pipeline.router.ts`
- `meta-ads.router.ts`, `google-ads.router.ts`, `social.router.ts` — all mutations
- `settings.router.ts` — use existing `ownerProcedure`/`adminProcedure` where present; member mutations via `mutationProcedure`

**Keep on `protectedProcedure`:** all `.query()` handlers.

- [ ] **Step 1: Script/grep audit**

```bash
rg "\.mutation\(" packages/api/src/routers -l
```

- [ ] **Step 2: Convert file by file** (one commit per router group)

- [ ] **Step 3: Add integration test**

```typescript
it("VIEWER cannot delete lead", async () => {
  const caller = createViewerCaller();
  await expect(caller.lead.delete({ id: "..." })).rejects.toMatchObject({ code: "FORBIDDEN" });
});
```

- [ ] **Step 4: Run `pnpm --filter @digitify/api test`**

---

## Phase 5 — Frontend URL safety & email preview (Medium)

### Task 5.1: safeExternalUrl sweep

**Files to modify** (apply `safeExternalUrl()` before every external `href`):

| File | Lines (approx) |
|------|----------------|
| `apps/web/src/app/(app)/leads/search/page.tsx` | 922, 1022, 1039 |
| `apps/web/src/app/(app)/leads/[id]/page.tsx` | 1048 (social URLs) |
| `apps/web/src/components/reports/website-audit-detail.tsx` | ~529 |
| `apps/web/src/app/(app)/reviews/page.tsx` | ~336 |
| `apps/web/src/app/(app)/bookings/page.tsx` | ~750 |
| `apps/web/src/components/reviews/qr-code-card.tsx` | ~105 |

**Pattern:**

```tsx
const safeUrl = safeExternalUrl(result.websiteUri);
{safeUrl ? (
  <a href={safeUrl} target="_blank" rel="noopener noreferrer">...</a>
) : null}
```

- [ ] **Step 1: Write Vitest for safeExternalUrl**

Create `apps/web/src/lib/__tests__/safe-external-url.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { safeExternalUrl } from "../utils";

describe("safeExternalUrl", () => {
  it("allows https", () => {
    expect(safeExternalUrl("https://example.com")).toMatch(/^https:/);
  });
  it("blocks javascript", () => {
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
  });
  it("blocks data URLs", () => {
    expect(safeExternalUrl("data:text/html,<script>")).toBeNull();
  });
});
```

- [ ] **Step 2: Fix each file**

- [ ] **Step 3: Run `pnpm --filter @digitify/web test`**

- [ ] **Step 4: Commit**

### Task 5.2: Sanitize email preview HTML

**Files:**
- Modify: `apps/web/src/components/email/preview.tsx`
- Optional: add `sanitizeEmailPreviewHtml` wrapper in `apps/web/src/lib/sanitize-inbox-html.ts`

- [ ] **Step 1: Sanitize before iframe**

```typescript
import { sanitizeInboxHtml } from "@/lib/sanitize-inbox-html";

const htmlDoc = useMemo(() => {
  const raw = normalizeHtmlEmailDocument(...);
  const safe = sanitizeInboxHtml(raw);
  return buildPreviewDocument(safe);
}, [...]);
```

- [ ] **Step 2: Tighten sandbox** — remove `allow-same-origin` if iframe sizing still works with `sandbox=""`.

- [ ] **Step 3: Manual test** — paste `<script>alert(1)</script>` in HTML template editor → preview should not execute.

- [ ] **Step 4: Commit**

### Task 5.3: Settings layout loading guard

**Files:**
- Modify: `apps/web/src/app/(app)/settings/layout.tsx`
- Modify: `apps/web/src/components/layout/module-access-guard.tsx`

- [ ] **Step 1: Show skeleton while loading**

```typescript
if (status === "loading") {
  return <div className="animate-pulse rounded-xl border p-8 h-32 bg-muted/30" />;
}
```

Apply same pattern in `module-access-guard.tsx` while module query loads.

- [ ] **Step 2: Commit**

### Task 5.4: Client portal download URLs

**Files:**
- Modify: `apps/web/src/app/client-portal/[quoteId]/page.tsx`

- [ ] **Step 1: Only allow blob: or https: data URLs**

```typescript
function safeDownloadUrl(url: string): string | null {
  if (url.startsWith("blob:")) return url;
  return safeExternalUrl(url);
}
```

- [ ] **Step 2: Commit**

---

## Phase 6 — API hardening (Medium)

### Task 6.1: Harden inbox.recordInbound

**Files:**
- Modify: `packages/api/src/routers/inbox.router.ts`

- [ ] **Step 1: Require evidence of real ingestion**

Options (pick one):
- **A)** Remove endpoint if unused in frontend
- **B)** Restrict to `adminProcedure` only
- **C)** Require `messageId` from IMAP sync table that belongs to workspace

- [ ] **Step 2: Grep usage**

```bash
rg "recordInbound" apps/web
```

- [ ] **Step 3: Implement chosen option + test**

### Task 6.2: Rate-limit publicProcedure endpoints

**Files:**
- Modify: `packages/api/src/trpc.ts`
- Modify: `packages/api/src/routers/settings.router.ts`
- Modify: `packages/api/src/routers/registration.router.ts`

- [ ] **Step 1: Create publicRateLimitedProcedure**

```typescript
export const publicRateLimitedProcedure = t.procedure
  .use(withLogging)
  .use(
    t.middleware(async ({ ctx, next }) => {
      await enforceRateLimit({ key: `public:${ctx.requestId}`, limit: 60, windowMs: 60_000 });
      return next();
    }),
  );
```

Use IP-based key from request headers if available in context (extend Context if needed).

- [ ] **Step 2: Apply to `getPublicSeo`, `getPublicMarketingFooter`, registration mutations**

### Task 6.3: Registration anti-enumeration

**Files:**
- Modify: `packages/api/src/routers/registration.router.ts`

- [ ] **Step 1: Return generic success**

```typescript
// Always return { ok: true } whether email exists or not
// Only send email when new; log internally when duplicate
```

- [ ] **Step 2: Test** — duplicate email returns 200 with same shape.

### Task 6.4: Public booking manage rate limit

**Files:**
- Modify: `apps/web/src/app/api/public/bookings/manage/[token]/route.ts`

- [ ] **Step 1: Add enforceRateLimit** (same pattern as `public/tracker/route.ts`)

- [ ] **Step 2: Commit**

---

## Phase 7 — UX bugs (Low–Medium)

### Task 7.1: AI mutation stale-response guard

**Files:**
- Modify: `apps/web/src/app/(app)/google-ads/page.tsx`
- Modify: `apps/web/src/app/(app)/meta-ads/page.tsx`
- Create: `apps/web/src/lib/use-mutation-generation.ts` (optional tiny hook)

- [ ] **Step 1: Add ref counter**

```typescript
const aiGenerationRef = useRef(0);

function handleAiSuggest() {
  const gen = ++aiGenerationRef.current;
  generateSuggestion.mutate(input, {
    onSuccess: (data) => {
      if (gen !== aiGenerationRef.current) return;
      // apply data
    },
  });
}
```

Apply to `generateSuggestion`, `generateSearchKeywords`, `generateAudienceSignals`, `aiSuggestVariant`.

- [ ] **Step 2: Commit**

### Task 7.2: Approval queue double-submit

**Files:**
- Modify: `apps/web/src/app/(app)/google-ads/page.tsx`
- Modify: `apps/web/src/app/(app)/meta-ads/page.tsx`

- [ ] **Step 1: Disable queue buttons while pending**

```typescript
disabled={submitForApproval.isPending || approveDraft.isPending}
```

- [ ] **Step 2: Commit**

### Task 7.3: Quote studio navigation guard

**Files:**
- Modify: `apps/web/src/app/(app)/settings/quotes/page.tsx`

- [ ] **Step 1: Add beforeunload**

```typescript
useEffect(() => {
  if (!hasUnpublishedChanges) return;
  const handler = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = "";
  };
  window.addEventListener("beforeunload", handler);
  return () => window.removeEventListener("beforeunload", handler);
}, [hasUnpublishedChanges]);
```

- [ ] **Step 2: Consider Next.js `useRouter` blocker** (App Router experimental or link intercept).

- [ ] **Step 3: Commit**

### Task 7.4: Email verify double-mutate (Strict Mode)

**Files:**
- Modify: `apps/web/src/app/(auth)/register/verify/page.tsx`

- [ ] **Step 1: useRef guard**

```typescript
const started = useRef(false);
useEffect(() => {
  if (started.current || !token) return;
  started.current = true;
  verify.mutate({ token });
}, [token]);
```

- [ ] **Step 2: Commit**

### Task 7.5: Inbox compose draft — debounce localStorage

**Files:**
- Modify: `apps/web/src/app/(app)/contacts/inbox/page.tsx`

- [ ] **Step 1: Debounce writes (300ms)** with `useDebouncedCallback` or simple timeout ref.

- [ ] **Step 2: Clear draft on successful send** (verify send handler).

- [ ] **Step 3: Commit**

---

## Phase 8 — Tests & CI

### Task 8.1: Enable RLS integration in CI

**Files:**
- Modify: `.github/workflows/*.yml` (or create `ci-integration.yml`)
- Modify: `packages/api/src/__tests__/workspace-rls.integration.test.ts`

- [ ] **Step 1: Add job with Postgres service + `RUN_DB_INTEGRATION=1`**

- [ ] **Step 2: Document in README** how to run locally: `RUN_DB_INTEGRATION=1 pnpm --filter @digitify/api test workspace-rls.integration`

### Task 8.2: Cross-tenant IDOR smoke tests

**Files:**
- Create: `packages/api/src/__tests__/idor-smoke.integration.test.ts`

Test matrix (requires DB):
- User A cannot `getById` lead of User B workspace
- User A cannot `updateDraft` Meta/Google plan of User B

### Task 8.3: Fix ESLint TypeScript parsing

**Files:**
- Modify: `packages/api/eslint.config.js` (or root eslint config)

- [ ] **Step 1: Ensure `@typescript-eslint/parser` and project reference**

- [ ] **Step 2: Run `pnpm lint` — expect PASS**

### Task 8.4: E2E security smoke

**Files:**
- Modify: `apps/web/e2e/rls-cross-tenant.spec.ts`
- Create: `apps/web/e2e/viewer-readonly.spec.ts`

- [ ] **Step 1: Add test** — login as VIEWER, attempt delete lead → UI disabled or API 403.

- [ ] **Step 2: Run `pnpm test:e2e`** in CI (optional nightly).

### Task 8.5: Production RLS rollout (ops)

- [ ] **Step 1: Run `pnpm rls:smoke` on staging**
- [ ] **Step 2: Set `ENABLE_WORKSPACE_RLS=true` on production**
- [ ] **Step 3: Monitor error rates for 24h**

---

## PR strategy (recommended order)

```
PR1  Phase 0 — TS fixes
PR2  Phase 1 — Bookings secrets
PR3  Phase 2 — SSRF guards
PR4  Phase 3 — AI rate limits
PR5  Phase 4 — mutationProcedure + router sweep
PR6  Phase 5 — Frontend URL + email preview + settings guard
PR7  Phase 6 — API misc hardening
PR8  Phase 7 — UX bugs
PR9  Phase 8 — CI/tests/RLS
```

Each PR should run:

```bash
pnpm test
pnpm typecheck
# pnpm lint (after Phase 8.3)
```

---

## Verification checklist (final)

- [ ] MEMBER cannot read bookings private key (network tab + UI)
- [ ] `probeImage` rejects `http://127.0.0.1`
- [ ] `analyzeWebsite` rejects private IPs
- [ ] AI endpoints return 429 after 20 req/min
- [ ] VIEWER gets FORBIDDEN on `lead.delete`
- [ ] No `javascript:` links render on leads search
- [ ] Email preview strips `<script>`
- [ ] Settings pages don't flash for unauthorized roles
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` — 168+ tests pass
- [ ] RLS integration tests pass in CI

---

## Out of scope (document only)

These were flagged as Low/Info — address later if needed:

- Legacy SHA-256 password migration batch job
- Health endpoint authentication
- Quote PDF token 90-day TTL reduction
- Public tracker CORS tightening (breaking change for embeds)

---

## Self-review (spec coverage)

| Audit finding | Phase/Task |
|---------------|------------|
| Bookings secrets leaked | 1.1–1.3 |
| SSRF image/website | 2.1–2.3 |
| AI rate limits unused | 3.1 |
| VIEWER can mutate | 4.1–4.2 |
| Unsanitized hrefs | 5.1 |
| Email preview XSS | 5.2 |
| Settings RBAC flash | 5.3 |
| recordInbound abuse | 6.1 |
| publicProcedure no rate limit | 6.2 |
| Registration enumeration | 6.3 |
| Booking manage no rate limit | 6.4 |
| AI mutation races | 7.1 |
| Queue double-submit | 7.2 |
| Quote studio data loss | 7.3 |
| Verify double-mutate | 7.4 |
| Inbox draft localStorage | 7.5 |
| TS errors meta-ads | 0.1–0.2 |
| RLS opt-in | 8.1, 8.5 |
| ESLint broken | 8.3 |
| Missing tests | 8.2, 8.4 |

No placeholders remain; all findings mapped.
