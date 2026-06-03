import { createHmac } from "node:crypto";
import type { PrismaClient } from "@digitify/db";
import { assertPublicHttpUrl } from "@digitify/connectors";
import { log } from "./logger";

export type BookingWebhookEvent =
  | "booking.created"
  | "booking.confirmed"
  | "booking.rejected"
  | "booking.cancelled"
  | "booking.completed"
  | "booking.updated";

export const ALL_WEBHOOK_EVENTS: BookingWebhookEvent[] = [
  "booking.created",
  "booking.confirmed",
  "booking.rejected",
  "booking.cancelled",
  "booking.completed",
  "booking.updated",
];

function settingKey(userId: string, key: string) {
  return `user:${userId}:${key}`;
}

async function loadWebhookSettings(db: PrismaClient, userId: string) {
  const rows = await db.setting.findMany({
    where: {
      key: {
        in: [
          settingKey(userId, "bookings.webhook_url"),
          settingKey(userId, "bookings.webhook_secret"),
          settingKey(userId, "bookings.webhook_events"),
        ],
      },
    },
    select: { key: true, value: true },
  });

  const get = (suffix: string) => {
    const row = rows.find((r) => r.key === settingKey(userId, suffix));
    return typeof row?.value === "string" ? row.value.trim() : "";
  };

  return {
    url: get("bookings.webhook_url"),
    secret: get("bookings.webhook_secret"),
    events: get("bookings.webhook_events")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean) as BookingWebhookEvent[],
  };
}

export async function fireBookingWebhook(
  db: PrismaClient,
  userId: string,
  event: BookingWebhookEvent,
  booking: Record<string, unknown>
): Promise<void> {
  try {
    const { url, secret, events } = await loadWebhookSettings(db, userId);
    if (!url) return;
    if (events.length > 0 && !events.includes(event)) return;

    const timestamp = new Date().toISOString();
    const payload = JSON.stringify({ event, booking, timestamp });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "Digitify-Webhooks/1.0",
      "X-Digitify-Event": event,
      "X-Digitify-Timestamp": timestamp,
    };

    if (secret) {
      const sig = createHmac("sha256", secret).update(payload).digest("hex");
      headers["X-Digitify-Signature"] = `sha256=${sig}`;
    }

    let safeUrl: string;
    try {
      safeUrl = await assertPublicHttpUrl(url);
    } catch {
      log.api.warn("Webhook URL blocked by SSRF guard", { event, url });
      return;
    }

    const response = await fetch(safeUrl, {
      method: "POST",
      headers,
      body: payload,
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      log.api.warn("Webhook delivery failed", { event, status: response.status, url });
    }
  } catch (error) {
    log.api.warn("Webhook request error", { event }, error);
  }
}
