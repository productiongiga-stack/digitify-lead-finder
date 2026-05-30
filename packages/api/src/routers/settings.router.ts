import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { resolveCname, resolveTxt } from "node:dns/promises";
import {
  clearPerformanceSnapshot,
  getPerformanceSnapshot,
  isSecretSettingKey,
  protectSettingValue,
  redactSecretSettingValue,
  SECRET_REDACTION_MASK,
} from "@digitify/db";
import { router, publicProcedure, protectedProcedure, adminProcedure, ownerProcedure } from "../trpc";
import { loadEmailSettings } from "../lib/email-sender";
import { formatSmtpErrorMessage, normalizeTlsOptions } from "../lib/email-utils";
import { getSettingBoolean, getSettingString, settingsRowsToMap } from "../lib/settings";
import {
  invalidateWorkspaceSettingsCache,
  loadWorkspaceSettingRows,
  resolveSettingDbKey,
  workspaceScopeFromUser,
} from "../lib/workspace-settings";
import { loadUserSettingRows } from "../lib/user-settings";
import { assertCanManageSettingKey, canReadSettingKey, filterReadableSettingsForRole } from "../lib/permissions";
import { ensureUserWorkspace } from "../lib/user-workspace";
import { normalizeSettingKey, validateSettingValue } from "../lib/setting-validation";

/* ---------- helpers ---------- */

function sanitizeSettingValue(key: string, value: unknown): any {
  if (value === undefined || value === null) return "";
  if (isSecretSettingKey(key)) return protectSettingValue(key, value);
  if (typeof value === "string") return value.trim();
  return protectSettingValue(key, value);
}

function isSecretNoopUpdate(key: string, value: unknown) {
  if (!isSecretSettingKey(key)) return false;
  const normalized = typeof value === "string" ? value.trim() : value;
  return normalized === "" || normalized === SECRET_REDACTION_MASK || normalized === null || normalized === undefined;
}

function sanitizeSettingsForViewer(settings: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(settings).map(([key, value]) => [key, redactSecretSettingValue(key, value)]),
  );
}

function sanitizeSingleSettingForViewer(key: string, value: unknown) {
  return redactSecretSettingValue(key, value);
}

function getDomainFromEmail(value: string) {
  const candidate = value.trim().toLowerCase();
  const at = candidate.lastIndexOf("@");
  if (at < 0) return "";
  return candidate.slice(at + 1).trim();
}

function sanitizeDomain(value: string) {
  const clean = value.trim().toLowerCase().replace(/\.$/, "");
  if (!clean) return "";
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(clean)) return "";
  return clean;
}

function flattenTxt(records: string[][]) {
  return records
    .map((parts) => parts.join("").trim())
    .filter(Boolean);
}

async function tryResolveTxt(host: string) {
  try {
    const records = await resolveTxt(host);
    return {
      host,
      records: flattenTxt(records),
      errorCode: null as string | null,
    };
  } catch (err: any) {
    return {
      host,
      records: [] as string[],
      errorCode: String(err?.code || "ERR_DNS_LOOKUP"),
    };
  }
}

async function tryResolveCname(host: string) {
  try {
    const records = await resolveCname(host);
    return {
      host,
      records: records.map((item) => item.trim()).filter(Boolean),
      errorCode: null as string | null,
    };
  } catch (err: any) {
    return {
      host,
      records: [] as string[],
      errorCode: String(err?.code || "ERR_DNS_LOOKUP"),
    };
  }
}

function detectEmailProviderHint(smtpHost: string) {
  const host = smtpHost.toLowerCase();
  if (host.includes("google") || host.includes("gmail")) {
    return {
      label: "Google Workspace / Gmail",
      spfInclude: "include:_spf.google.com",
      docsUrl: "https://support.google.com/a/answer/33786",
    };
  }
  if (host.includes("outlook") || host.includes("office365") || host.includes("microsoft")) {
    return {
      label: "Microsoft 365 / Outlook",
      spfInclude: "include:spf.protection.outlook.com",
      docsUrl: "https://learn.microsoft.com/en-us/defender-office-365/email-authentication-spf-configure",
    };
  }
  if (host.includes("mailgun")) {
    return { label: "Mailgun", spfInclude: "include:mailgun.org", docsUrl: "https://documentation.mailgun.com/docs/mailgun/user-manual/domains/" };
  }
  if (host.includes("sendgrid")) {
    return { label: "SendGrid", spfInclude: "include:sendgrid.net", docsUrl: "https://docs.sendgrid.com/ui/account-and-settings/how-to-set-up-domain-authentication" };
  }
  if (host.includes("amazonses") || host.includes("amazonaws")) {
    return { label: "Amazon SES", spfInclude: "include:amazonses.com", docsUrl: "https://docs.aws.amazon.com/ses/latest/dg/send-email-authentication.html" };
  }
  if (host.includes("zoho")) {
    return { label: "Zoho Mail", spfInclude: "include:zoho.com", docsUrl: "https://www.zoho.com/mail/help/adminconsole/spf-configuration.html" };
  }
  return null;
}

function buildSmtpDnsGuide(input: { smtpHost: string; smtpUser: string; fromEmail: string; replyTo: string }) {
  const senderEmail = input.fromEmail || input.smtpUser || "";
  const senderDomain = getDomainFromEmail(senderEmail);
  const replyDomain = getDomainFromEmail(input.replyTo || "");
  const activeDomain = senderDomain || replyDomain;
  const mailSubdomain = activeDomain ? `mail.${activeDomain}` : "";
  const dmarcTarget = activeDomain ? `_dmarc.${activeDomain}` : "_dmarc.<jouwdomein>";
  const provider = detectEmailProviderHint(input.smtpHost);
  const spfInclude = provider?.spfInclude || "include:<provider-spf-include>";

  return {
    senderEmail,
    activeDomain,
    mailSubdomain,
    smtpHost: input.smtpHost,
    providerLabel: provider?.label || null,
    providerDocsUrl: provider?.docsUrl || null,
    records: [
      {
        type: "SPF",
        host: activeDomain || "<jouwdomein>",
        value: `v=spf1 ${spfInclude} -all`,
        note: provider
          ? `SPF voor ${provider.label}. Controleer in de provider-console of deze include volledig is.`
          : "Gebruik de SPF include van je provider (bijv. _spf.google.com, spf.protection.outlook.com).",
      },
      {
        type: "DKIM",
        host: "<selector>._domainkey." + (activeDomain || "<jouwdomein>"),
        value: "<provider-dkim-doel>",
        note: "Kopieer DKIM exact uit je mailprovider. Zonder DKIM dalen inbox-scores snel.",
      },
      {
        type: "DMARC",
        host: dmarcTarget,
        value:
          activeDomain
            ? `v=DMARC1; p=none; rua=mailto:dmarc@${activeDomain}; fo=1`
            : "v=DMARC1; p=none; rua=mailto:dmarc@<jouwdomein>; fo=1",
        note: "Start met p=none (monitoring). Na 2–4 weken: quarantine, daarna reject.",
      },
    ],
    tips: [
      mailSubdomain
        ? `Verzend bij voorkeur via ${mailSubdomain} — scheidt marketing-mail van je hoofddomein.`
        : "Gebruik een apart verzend-subdomein (bv. mail.jouwdomein.be).",
      "From-adres, SMTP-login en DNS-domein moeten hetzelfde merk/domein tonen (alignment).",
      "Controleer hieronder met «Controleer DNS» of SPF/DKIM/DMARC al live staan.",
      provider?.docsUrl ? `Provider-documentatie: ${provider.label}.` : "Vraag je hosting/DNS-beheerder om TXT-records toe te voegen.",
    ],
  };
}

export const settingsRouter = router({
  getPerformanceMetrics: ownerProcedure
    .input(z.object({ limit: z.number().min(5).max(200).default(50) }).optional())
    .query(async ({ input }) => getPerformanceSnapshot(input?.limit ?? 50)),

  clearPerformanceMetrics: ownerProcedure.mutation(async () => {
    clearPerformanceSnapshot();
    return { success: true };
  }),

  getPublicSeo: publicProcedure.query(async ({ ctx }) => {
    const { loadMarketingPublicSeoConfig } = await import("../lib/seo-settings");
    const fallbackCanonical =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
    return loadMarketingPublicSeoConfig(ctx.db, { fallbackCanonical });
  }),

  getPublicMarketingFooter: publicProcedure.query(async ({ ctx }) => {
    const { resolveMarketingWorkspaceOwnerId } = await import("../lib/public-tenant");
    const ownerId = await resolveMarketingWorkspaceOwnerId(ctx.db);
    const owner = ownerId
      ? await ctx.db.user.findUnique({ where: { id: ownerId }, select: { id: true } })
      : null;

    if (!owner) {
      return {
        brandName: "Digitify Lead Finder",
        tagline: "Partner in Digital Solutions",
        description: "Premium lead discovery en opvolging voor bedrijven die digitale groei praktisch willen organiseren.",
        email: "hello@digitify.be",
        phone: "+32 (0) 486 51 57 73",
        location: "België",
        websiteLabel: "www.digitify.be",
        websiteUrl: "https://www.digitify.be",
        legalLine: `© ${new Date().getFullYear()} Digitify`,
        copyrightLine: `© ${new Date().getFullYear()} Digitify. Webdesign, media en marketing voor digitale groei.`,
      };
    }

    const keys = [
      "company.footer_brand_name",
      "company.footer_tagline",
      "company.footer_description",
      "company.footer_email",
      "company.footer_phone",
      "company.footer_location",
      "company.footer_website_label",
      "company.footer_website_url",
      "company.footer_legal_line",
      "company.footer_copyright_line",
    ];
    const rows = await loadUserSettingRows(ctx.db, owner.id, keys);
    const settings = settingsRowsToMap(rows);
    const year = new Date().getFullYear();

    return {
      brandName: getSettingString(settings, "company.footer_brand_name", "Digitify Lead Finder"),
      tagline: getSettingString(settings, "company.footer_tagline", "Partner in Digital Solutions"),
      description: getSettingString(
        settings,
        "company.footer_description",
        "Premium lead discovery en opvolging voor bedrijven die digitale groei praktisch willen organiseren.",
      ),
      email: getSettingString(settings, "company.footer_email", "hello@digitify.be"),
      phone: getSettingString(settings, "company.footer_phone", "+32 (0) 486 51 57 73"),
      location: getSettingString(settings, "company.footer_location", "België"),
      websiteLabel: getSettingString(settings, "company.footer_website_label", "www.digitify.be"),
      websiteUrl: getSettingString(settings, "company.footer_website_url", "https://www.digitify.be"),
      legalLine: getSettingString(settings, "company.footer_legal_line", `© ${year} Digitify`),
      copyrightLine: getSettingString(
        settings,
        "company.footer_copyright_line",
        `© ${year} Digitify. Webdesign, media en marketing voor digitale groei.`,
      ),
    };
  }),

  get: protectedProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ ctx, input }) => {
      const key = normalizeSettingKey(input.key);
      const scope = workspaceScopeFromUser(ctx.user);
      await ensureUserWorkspace(ctx.db, scope.workspaceId, ctx.user.name);
      const setting = await ctx.db.setting.findUnique({
        where: { key: resolveSettingDbKey(scope, key) },
      });
      if (!canReadSettingKey(ctx.user.role, key)) return null;
      if (!setting) return null;
      const settingsMap = settingsRowsToMap([{ key, value: setting.value }]);
      const value = settingsMap[key];
      return sanitizeSingleSettingForViewer(key, value);
    }),

  getBranding: protectedProcedure.query(async ({ ctx }) => {
    const scope = workspaceScopeFromUser(ctx.user);
    await ensureUserWorkspace(ctx.db, scope.workspaceId, ctx.user.name);
    const keys = [
      "branding.company_name",
      "branding.company_slogan",
      "branding.logo_url",
      "branding.favicon_url",
      "branding.primary_color",
      "branding.website",
      "branding.phone",
      "branding.email",
      "branding.address",
      "branding.vat_number",
      "branding.bank_account",
      "company.name",
      "company.website",
      "company.phone",
      "company.email",
      "company.address",
      "company.vat",
      "company.kbo",
      "company.niche",
      "email.from_name",
      "email.from_email",
    ];
    const rows = await loadWorkspaceSettingRows(ctx.db, scope, keys);
    const map = settingsRowsToMap(rows);
    return sanitizeSettingsForViewer(filterReadableSettingsForRole(ctx.user.role, map));
  }),

  getAll: protectedProcedure.query(async ({ ctx }) => {
    const scope = workspaceScopeFromUser(ctx.user);
    await ensureUserWorkspace(ctx.db, scope.workspaceId, ctx.user.name);
    const rows = await loadWorkspaceSettingRows(ctx.db, scope);
    const map = settingsRowsToMap(rows);
    return sanitizeSettingsForViewer(filterReadableSettingsForRole(ctx.user.role, map));
  }),

  update: protectedProcedure
    .input(z.object({ key: z.string(), value: z.any() }))
    .mutation(async ({ ctx, input }) => {
      const key = normalizeSettingKey(input.key);
      const scope = workspaceScopeFromUser(ctx.user);
      assertCanManageSettingKey(ctx.user.role, key);
      const scopedKey = resolveSettingDbKey(scope, key);
      if (isSecretNoopUpdate(key, input.value)) {
        const current = await ctx.db.setting.findUnique({ where: { key: scopedKey } });
        if (current) return current;
        return ctx.db.setting.create({
          data: { key: scopedKey, value: "" },
        });
      }
      const validatedValue = validateSettingValue(key, input.value);
      const sanitizedValue = sanitizeSettingValue(key, validatedValue);
      const result = await ctx.db.setting.upsert({
        where: { key: scopedKey },
        update: { value: sanitizedValue },
        create: { key: scopedKey, value: sanitizedValue },
      });
      await ctx.db.activity.create({
        data: {
          userId: ctx.user.id,
          type: "LEAD_UPDATED",
          title: `Instelling "${key}" gewijzigd`,
          metadata: { key, isSecret: isSecretSettingKey(key) },
        },
      });
      invalidateWorkspaceSettingsCache(scope);
      return result;
    }),

  batchUpdate: protectedProcedure
    .input(z.array(z.object({ key: z.string(), value: z.any() })))
    .mutation(async ({ ctx, input }) => {
      const scope = workspaceScopeFromUser(ctx.user);
      const normalizedEntries = input.map((item) => ({
        key: normalizeSettingKey(item.key),
        value: item.value,
      }));

      for (const item of normalizedEntries) {
        assertCanManageSettingKey(ctx.user.role, item.key);
      }
      const uniqueEntries = Array.from(
        new Map(
          normalizedEntries
            .filter((item) => !isSecretNoopUpdate(item.key, item.value))
            .map((item) => [item.key, sanitizeSettingValue(item.key, validateSettingValue(item.key, item.value))]),
        ).entries(),
      )
        .map(([key, value]) => ({ key, value }));
      if (uniqueEntries.length === 0) return { success: true };
      await ctx.db.$transaction([
        ...uniqueEntries.map((item) => {
          const storageKey = resolveSettingDbKey(scope, item.key);
          return ctx.db.setting.upsert({
            where: { key: storageKey },
            create: { key: storageKey, value: item.value },
            update: { value: item.value },
          });
        }),
        ctx.db.activity.create({
          data: {
            userId: ctx.user.id,
            type: "LEAD_UPDATED",
            title: `${uniqueEntries.length} instellingen gewijzigd`,
            metadata: {
              keys: uniqueEntries.map((e) => e.key),
              secretKeys: uniqueEntries.filter((e) => isSecretSettingKey(e.key)).map((e) => e.key),
            },
          },
        }),
      ]);
      invalidateWorkspaceSettingsCache(scope);
      return { success: true };
    }),

  removeSettings: protectedProcedure
    .input(z.object({ keys: z.array(z.string().min(1)).min(1).max(32) }))
    .mutation(async ({ ctx, input }) => {
      const scope = workspaceScopeFromUser(ctx.user);
      const normalizedKeys = [...new Set(input.keys.map((key) => normalizeSettingKey(key)))];

      for (const key of normalizedKeys) {
        assertCanManageSettingKey(ctx.user.role, key);
      }

      const storageKeys = normalizedKeys.map((key) => resolveSettingDbKey(scope, key));
      const deleted = await ctx.db.setting.deleteMany({
        where: { key: { in: storageKeys } },
      });

      await ctx.db.activity
        .create({
          data: {
            userId: ctx.user.id,
            type: "LEAD_UPDATED",
            title: `${deleted.count} integratie-instelling(en) verwijderd`,
            metadata: { keys: normalizedKeys, removed: deleted.count },
          },
        })
        .catch(() => null);

      invalidateWorkspaceSettingsCache(scope);
      return { success: true, removed: deleted.count, keys: normalizedKeys };
    }),

  getScoringWeights: protectedProcedure.query(async ({ ctx }) => {
    const { loadMergedScoringWeights } = await import("../lib/scoring-weights");
    return loadMergedScoringWeights(ctx.db, ctx.user.workspaceId!);
  }),

  updateScoringWeight: adminProcedure
    .input(
      z.object({
        id: z.string(),
        weight: z.number().optional(),
        enabled: z.boolean().optional(),
        label: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { resolveWorkspaceScoringWeightForUpdate } = await import("../lib/scoring-weights");
      const target = await resolveWorkspaceScoringWeightForUpdate(
        ctx.db,
        ctx.user.workspaceId!,
        input.id,
      );
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Scoringfactor niet gevonden." });
      }
      const { id: _ignored, ...data } = input;
      return ctx.db.scoringWeight.update({ where: { id: target.id }, data });
    }),

  /* ---------- test connection endpoints ---------- */

  testGooglePlaces: ownerProcedure.mutation(async ({ ctx }) => {
    const scope = workspaceScopeFromUser(ctx.user);
    const settings = await loadWorkspaceSettingRows(ctx.db, scope, ["api.google_places_key"]);
    const key = getSettingString(settingsRowsToMap(settings), "api.google_places_key");
    if (!key) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Google Places API key is niet geconfigureerd." });

    try {
      const res = await fetch(
        `https://places.googleapis.com/v1/places:searchText`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask": "places.displayName",
          },
          body: JSON.stringify({ textQuery: "restaurant", maxResultCount: 1 }),
        }
      );
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      return { success: true, message: "Google Places API key is geldig." };
    } catch (err: any) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Google Places test mislukt: ${err.message}` });
    }
  }),

  testAnthropicKey: ownerProcedure.mutation(async ({ ctx }) => {
    const scope = workspaceScopeFromUser(ctx.user);
    const settings = await loadWorkspaceSettingRows(ctx.db, scope, ["api.anthropic_key"]);
    const key = getSettingString(settingsRowsToMap(settings), "api.anthropic_key");
    if (!key) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Anthropic API key is niet geconfigureerd." });

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 10,
          messages: [{ role: "user", content: "Ping" }],
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      return { success: true, message: "Anthropic API key is geldig." };
    } catch (err: any) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Anthropic test mislukt: ${err.message}` });
    }
  }),

  testOpenaiKey: ownerProcedure.mutation(async ({ ctx }) => {
    const scope = workspaceScopeFromUser(ctx.user);
    const settings = await loadWorkspaceSettingRows(ctx.db, scope, ["api.openai_key"]);
    const key = getSettingString(settingsRowsToMap(settings), "api.openai_key");
    if (!key) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "OpenAI API key is niet geconfigureerd." });

    try {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      return { success: true, message: "OpenAI API key is geldig." };
    } catch (err: any) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `OpenAI test mislukt: ${err.message}` });
    }
  }),

  testDeepseekKey: ownerProcedure.mutation(async ({ ctx }) => {
    const scope = workspaceScopeFromUser(ctx.user);
    const settings = await loadWorkspaceSettingRows(ctx.db, scope, ["api.deepseek_key"]);
    const key = getSettingString(settingsRowsToMap(settings), "api.deepseek_key");
    if (!key) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "DeepSeek API key is niet geconfigureerd." });

    try {
      const res = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          max_tokens: 8,
          messages: [{ role: "user", content: "Ping" }],
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      return { success: true, message: "DeepSeek API key is geldig." };
    } catch (err: any) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `DeepSeek test mislukt: ${err.message}` });
    }
  }),

  testSmtp: ownerProcedure
    .input(
      z.object({
        toEmail: z.string().email().optional(),
      }).optional()
    )
    .mutation(async ({ ctx, input }) => {
      const nodemailer = await import("nodemailer");
      const scope = workspaceScopeFromUser(ctx.user);
      const settings = await loadWorkspaceSettingRows(ctx.db, scope);
      const cfg = await loadEmailSettings(ctx.db, scope);
      const host = cfg.smtpHost;
      const port = cfg.smtpPort;
      const user = cfg.smtpUser;
      const pass = cfg.smtpPass;

      if (!host || !user || !pass) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "SMTP is niet geconfigureerd." });
      }
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "SMTP poort is ongeldig. Gebruik een poort tussen 1 en 65535.",
        });
      }

      try {
        const transporter = nodemailer.default.createTransport({
          host,
          port,
          secure: port === 465,
          auth: { user, pass },
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 20_000,
          tls: normalizeTlsOptions({
            host,
            explicitServername: cfg.smtpServername,
            username: user,
            rejectUnauthorized: cfg.smtpRejectUnauthorized,
          }),
        });

        const userProfile = await ctx.db.user.findUnique({ where: { id: ctx.user.id }, select: { email: true } });
        const toEmail = input?.toEmail?.trim() || userProfile?.email || user;

        const settingsMap = settingsRowsToMap(settings);
        const companyName = getSettingString(settingsMap, "branding.company_name", "Lead Finder");
        const fromEmail = getSettingString(settingsMap, "email.from_email") || user;
        const fromName = getSettingString(settingsMap, "email.from_name") || companyName;
        const replyTo = getSettingString(settingsMap, "email.reply_to");

        await transporter.verify();
        await transporter.sendMail({
          from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail,
          to: toEmail,
          subject: `SMTP Test - ${companyName}`,
          text: "Dit is een test e-mail. Je SMTP configuratie werkt correct!",
          html: "<p>Dit is een test e-mail. Je SMTP configuratie werkt correct!</p>",
          replyTo: replyTo || undefined,
        });

        return {
          success: true,
          message: `Test e-mail verstuurd naar ${toEmail}.`,
          dnsGuide: buildSmtpDnsGuide({
            smtpHost: host,
            smtpUser: user,
            fromEmail,
            replyTo,
          }),
        };
      } catch (err: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: formatSmtpErrorMessage(err) });
      }
    }),

  checkEmailDns: ownerProcedure
    .input(
      z
        .object({
          domain: z.string().optional(),
        })
        .optional(),
    )
    .mutation(async ({ ctx, input }) => {
      const scope = workspaceScopeFromUser(ctx.user);
      const settingRows = await loadWorkspaceSettingRows(ctx.db, scope);
      const settingsMap = settingsRowsToMap(settingRows);
      const fromEmail = getSettingString(settingsMap, "email.from_email");
      const smtpUser = getSettingString(settingsMap, "email.smtp_user");
      const replyTo = getSettingString(settingsMap, "email.reply_to");

      const requestedDomain = sanitizeDomain(input?.domain || "");
      const senderDomain =
        sanitizeDomain(getDomainFromEmail(fromEmail)) ||
        sanitizeDomain(getDomainFromEmail(smtpUser)) ||
        sanitizeDomain(getDomainFromEmail(replyTo));
      const domain = requestedDomain || senderDomain;

      if (!domain) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Geen geldig domein gevonden. Stel eerst een afzender e-mail in of vul een domein in.",
        });
      }

      const rootTxt = await tryResolveTxt(domain);
      const spfRecord = rootTxt.records.find((record) => /^v=spf1\b/i.test(record)) || "";

      const dmarcHost = `_dmarc.${domain}`;
      const dmarcTxt = await tryResolveTxt(dmarcHost);
      const dmarcRecord = dmarcTxt.records.find((record) => /^v=dmarc1\b/i.test(record)) || "";
      const dmarcPolicyMatch = dmarcRecord.match(/\bp=([a-z]+)/i);
      const dmarcPolicy = dmarcPolicyMatch?.[1]?.toLowerCase() || "";

      const selectorFromSettings = getSettingString(settingsMap, "email.dkim_selector");
      const selectors = Array.from(
        new Set(
          [selectorFromSettings, "default", "selector1", "selector2", "mail", "smtp"]
            .flatMap((item) => String(item || "").split(","))
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      ).slice(0, 8);

      const dkimChecks = await Promise.all(
        selectors.map(async (selector) => {
          const host = `${selector}._domainkey.${domain}`;
          const txt = await tryResolveTxt(host);
          const cname = await tryResolveCname(host);
          const dkimTxt = txt.records.find((record) => /\bv=dkim1\b/i.test(record)) || "";
          return {
            selector,
            host,
            txtRecords: txt.records,
            cnameRecords: cname.records,
            txtError: txt.errorCode,
            cnameError: cname.errorCode,
            hasDkimTxt: Boolean(dkimTxt),
            hasCname: cname.records.length > 0,
            recordPreview: dkimTxt || cname.records[0] || "",
          };
        }),
      );

      const dkimHit = dkimChecks.find((item) => item.hasDkimTxt || item.hasCname) || null;

      const spfStatus = spfRecord ? "ok" : "missing";
      const dmarcStatus = dmarcRecord ? "ok" : "missing";
      const dkimStatus = dkimHit ? "ok" : "missing";
      const okCount = [spfStatus, dmarcStatus, dkimStatus].filter((status) => status === "ok").length;
      const overall = okCount === 3 ? "healthy" : okCount >= 1 ? "partial" : "risk";

      return {
        success: true,
        domain,
        senderEmail: fromEmail || smtpUser || "",
        overall,
        checks: {
          spf: {
            status: spfStatus,
            host: domain,
            record: spfRecord || null,
            lookupError: rootTxt.errorCode,
          },
          dkim: {
            status: dkimStatus,
            selector: dkimHit?.selector || null,
            host: dkimHit?.host || null,
            record: dkimHit?.recordPreview || null,
            scanned: dkimChecks.map((item) => ({
              selector: item.selector,
              host: item.host,
              hasRecord: item.hasDkimTxt || item.hasCname,
            })),
          },
          dmarc: {
            status: dmarcStatus,
            host: dmarcHost,
            record: dmarcRecord || null,
            policy: dmarcPolicy || null,
            lookupError: dmarcTxt.errorCode,
          },
        },
        summary:
          overall === "healthy"
            ? "SPF, DKIM en DMARC zijn publiek zichtbaar. Je domein is goed ingesteld voor authenticatie."
            : overall === "partial"
              ? `${okCount} van 3 controles OK. Los de ontbrekende records op voor betere inbox-plaatsing.`
              : "Geen van de drie records gevonden. Voeg SPF, DKIM en DMARC toe vóór bulk verzending.",
        guidance: [
          spfRecord
            ? `SPF OK — ${spfRecord.length > 72 ? `${spfRecord.slice(0, 72)}…` : spfRecord}`
            : "SPF ontbreekt op het root-domein. Ontvangers weten niet welke servers namens jou mogen verzenden.",
          dkimHit
            ? `DKIM OK — selector «${dkimHit.selector}» op ${dkimHit.host}`
            : `DKIM niet gevonden. Geteste selectors: ${selectors.join(", ")}. Kopieer DKIM exact uit je mailprovider (Stackmail, Google, …).`,
          dmarcRecord
            ? `DMARC OK — policy «${dmarcPolicy || "none"}»${dmarcPolicy === "none" ? " (alleen monitoren)" : dmarcPolicy === "quarantine" ? " (twijfelachtige mail in spam)" : ""}`
            : `DMARC ontbreekt op ${dmarcHost}. Voeg een TXT-record toe om misbruik van je domein te beperken.`,
        ],
      };
    }),

  testImap: ownerProcedure.mutation(async ({ ctx }) => {
    const { ImapFlow } = await import("imapflow");
    const scope = workspaceScopeFromUser(ctx.user);
    const settings = await loadWorkspaceSettingRows(ctx.db, scope);
    const settingsMap = settingsRowsToMap(settings);
    const host = getSettingString(settingsMap, "email.imap_host");
    const port = getSettingString(settingsMap, "email.imap_port", "993");
    const user = getSettingString(settingsMap, "email.imap_user");
    const pass = getSettingString(settingsMap, "email.imap_pass");
    const tls = getSettingBoolean(settingsMap, "email.imap_tls", true);

    if (!host || !user || !pass) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "IMAP is niet geconfigureerd." });
    }

    try {
      const client = new ImapFlow({
        host,
        port: parseInt(port, 10),
        secure: tls,
        auth: { user, pass },
        logger: false as any,
      });

      await client.connect();
      const folders = await client.list();
      await client.logout();

      const folderNames = folders.map((f: any) => f.path).slice(0, 10);
      return { success: true, message: `IMAP verbinding gelukt. Mappen: ${folderNames.join(", ")}` };
    } catch (err: any) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `IMAP test mislukt: ${err.message}` });
    }
  }),
});
