import { describe, it, expect } from "vitest";
import { canManageSettingKey, canReadSettingKey } from "../lib/permissions";

describe("bookings owner-only settings", () => {
  const privateKey = "bookings.google_service_account_private_key";
  const webhookSecret = "bookings.webhook_secret";
  const timezone = "bookings.google_calendar_timezone";
  const calendarId = "bookings.google_calendar_id";

  it("only OWNER can read bookings secrets and timezone", () => {
    for (const key of [privateKey, webhookSecret, timezone]) {
      expect(canReadSettingKey("OWNER", key)).toBe(true);
      expect(canReadSettingKey("ADMIN", key)).toBe(false);
      expect(canReadSettingKey("MEMBER", key)).toBe(false);
      expect(canReadSettingKey("VIEWER", key)).toBe(false);
    }
  });

  it("only OWNER can manage bookings secrets and timezone", () => {
    for (const key of [privateKey, webhookSecret, timezone]) {
      expect(canManageSettingKey("OWNER", key)).toBe(true);
      expect(canManageSettingKey("ADMIN", key)).toBe(false);
      expect(canManageSettingKey("MEMBER", key)).toBe(false);
    }
  });

  it("MEMBER can still read other bookings settings", () => {
    expect(canReadSettingKey("MEMBER", calendarId)).toBe(true);
    expect(canManageSettingKey("MEMBER", calendarId)).toBe(true);
  });
});
