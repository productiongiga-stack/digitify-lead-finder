import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { resolveCname, resolveTxt } from "node:dns/promises";
import {
  isSecretSettingKey,
  protectSettingValue,
  redactSecretSettingValue,
  SECRET_REDACTION_MASK,
} from "@digitify/db";
import { router, protectedProcedure, adminProcedure, ownerProcedure } from "../trpc";
import { loadEmailSettings } from "../lib/email-sender";
import { formatSmtpErrorMessage, normalizeTlsOptions } from "../lib/email-utils";
import { getSettingBoolean, getSettingString, settingsRowsToMap } from "../lib/settings";
import { loadUserSettingRows, userSettingKey } from "../lib/user-settings";
import { assertCanManageSettingKey, canReadSettingKey, filterReadableSettingsForRole } from "../lib/permissions";

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

function buildSmtpDnsGuide(input: { smtpHost: string; smtpUser: string; fromEmail: string; replyTo: string }) {
  const senderEmail = input.fromEmail || input.smtpUser || "";
  const senderDomain = getDomainFromEmail(senderEmail);
  const replyDomain = getDomainFromEmail(input.replyTo || "");
  const activeDomain = senderDomain || replyDomain;
  const mailSubdomain = activeDomain ? `mail.${activeDomain}` : "";
  const dmarcTarget = activeDomain ? `_dmarc.${activeDomain}` : "_dmarc.<jouwdomein>";

  return {
    senderEmail,
    activeDomain,
    mailSubdomain,
    smtpHost: input.smtpHost,
    records: [
      {
        type: "SPF",
        host: activeDomain || "<jouwdomein>",
        value:
          "v=spf1 include:<provider-spf-include> -all",
        note:
          "Gebruik de SPF include van je provider (bijv. _spf.google.com, spf.protection.outlook.com, mailgun.org).",
      },
      {
        type: "DKIM",
        host: "<selector>._domainkey." + (activeDomain || "<jouwdomein>"),
        value: "<provider-dkim-doel>",
        note: "Maak alle DKIM-records exact zoals je provider opgeeft.",
      },
      {
        type: "DMARC",
        host: dmarcTarget,
        value:
          activeDomain
            ? `v=DMARC1; p=none; rua=mailto:dmarc@${activeDomain}; fo=1`
            : "v=DMARC1; p=none; rua=mailto:dmarc@<jouwdomein>; fo=1",
        note: "Start met p=none, monitor rapporten, schakel later naar quarantine/reject.",
      },
    ],
    tips: [
      mailSubdomain
        ? `Gebruik bij voorkeur een verzend-subdomein zoals ${mailSubdomain} voor betere deliverability en isolatie.`
        : "Gebruik bij voorkeur een apart verzend-subdomein (bv. mail.jouwdomein.be).",
      "Zet dezelfde From-domeinidentiteit in SMTP/provider als in de app-instellingen om SPF/DKIM alignment te halen.",
      "Gebruik een Return-Path/Bounce domein via je provider wanneer beschikbaar.",
    ],
  };
}

export const settingsRouter = router({
  get: protectedProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ ctx, input }) => {
      const setting = await ctx.db.setting.findUnique({ where: { key: userSettingKey(ctx.user.id, input.key) } });
      if (!canReadSettingKey(ctx.user.role, input.key)) return null;
      if (!setting) return null;
      const settingsMap = settingsRowsToMap([{ key: input.key, value: setting.value }]);
      const value = settingsMap[input.key];
      return sanitizeSingleSettingForViewer(input.key, value);
    }),

  getAll: protectedProcedure.query(async ({ ctx }) => {
    const rows = await loadUserSettingRows(ctx.db, ctx.user.id);
    const map = settingsRowsToMap(rows);
    return sanitizeSettingsForViewer(filterReadableSettingsForRole(ctx.user.role, map));
  }),

  update: protectedProcedure
    .input(z.object({ key: z.string(), value: z.any() }))
    .mutation(async ({ ctx, input }) => {
      assertCanManageSettingKey(ctx.user.role, input.key);
      const scopedKey = userSettingKey(ctx.user.id, input.key);
      if (isSecretNoopUpdate(input.key, input.value)) {
        const current = await ctx.db.setting.findUnique({ where: { key: scopedKey } });
        if (current) return current;
        return ctx.db.setting.create({
          data: { key: scopedKey, value: "" },
        });
      }
      const result = await ctx.db.setting.upsert({
        where: { key: scopedKey },
        update: { value: sanitizeSettingValue(input.key, input.value) },
        create: { key: scopedKey, value: sanitizeSettingValue(input.key, input.value) },
      });
      await ctx.db.activity.create({
        data: {
          userId: ctx.user.id,
          type: "LEAD_UPDATED",
          title: `Instelling "${input.key}" gewijzigd`,
          metadata: { key: input.key, isSecret: isSecretSettingKey(input.key) },
        },
      });
      return result;
    }),

  batchUpdate: protectedProcedure
    .input(z.array(z.object({ key: z.string(), value: z.any() })))
    .mutation(async ({ ctx, input }) => {
      for (const item of input) {
        assertCanManageSettingKey(ctx.user.role, item.key.trim());
      }
      const uniqueEntries = Array.from(
        new Map(
          input
            .map((item) => ({ key: item.key.trim(), value: item.value }))
            .filter((item) => item.key.length > 0)
            .filter((item) => !isSecretNoopUpdate(item.key, item.value))
            .map((item) => [item.key, sanitizeSettingValue(item.key, item.value)]),
        ).entries(),
      )
        .filter(([key]) => key.length > 0)
        .map(([key, value]) => ({ key, value }));
      if (uniqueEntries.length === 0) return { success: true };
      await ctx.db.$transaction([
        ...uniqueEntries.map((item) =>
          ctx.db.setting.upsert({
            where: { key: userSettingKey(ctx.user.id, item.key) },
            create: { key: userSettingKey(ctx.user.id, item.key), value: item.value },
            update: { value: item.value },
          }),
        ),
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
      return { success: true };
    }),

  getScoringWeights: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.scoringWeight.findMany({ orderBy: { sortOrder: "asc" } });
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
      const { id, ...data } = input;
      return ctx.db.scoringWeight.update({ where: { id }, data });
    }),

  /* ---------- test connection endpoints ---------- */

  testGooglePlaces: ownerProcedure.mutation(async ({ ctx }) => {
    const settings = await loadUserSettingRows(ctx.db, ctx.user.id, ["api.google_places_key"]);
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
    const settings = await loadUserSettingRows(ctx.db, ctx.user.id, ["api.anthropic_key"]);
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
    const settings = await loadUserSettingRows(ctx.db, ctx.user.id, ["api.openai_key"]);
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

  testSmtp: ownerProcedure
    .input(
      z.object({
        toEmail: z.string().email().optional(),
      }).optional()
    )
    .mutation(async ({ ctx, input }) => {
      const nodemailer = await import("nodemailer");
      const settings = await loadUserSettingRows(ctx.db, ctx.user.id);
      const cfg = await loadEmailSettings(ctx.db, ctx.user.id);
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
      const settingRows = await loadUserSettingRows(ctx.db, ctx.user.id);
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
        guidance: [
          spfRecord
            ? "SPF record gevonden."
            : "Geen SPF record gevonden op je root-domein.",
          dkimHit
            ? `DKIM gevonden via selector "${dkimHit.selector}".`
            : "Geen DKIM record gevonden op de geteste selectors.",
          dmarcRecord
            ? `DMARC policy: ${dmarcPolicy || "onbekend"}.`
            : "Geen DMARC record gevonden op _dmarc.",
        ],
      };
    }),

  testImap: ownerProcedure.mutation(async ({ ctx }) => {
    const { ImapFlow } = await import("imapflow");
    const settings = await loadUserSettingRows(ctx.db, ctx.user.id);
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
