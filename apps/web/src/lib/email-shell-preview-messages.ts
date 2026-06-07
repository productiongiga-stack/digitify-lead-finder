import {
  EMAIL_SHELL_PREVIEW_BODY,
  EMAIL_SHELL_PREVIEW_SUBJECT,
} from "@/lib/email-shell-branding";

export type ShellPreviewMessageGroup = "generic" | "starter" | "system";

export type ShellPreviewMessage = {
  id: string;
  group: ShellPreviewMessageGroup;
  groupLabel: string;
  label: string;
  subject: string;
  body: string;
  bodyFormat?: "TEXT" | "HTML";
  ctaText?: string;
  ctaUrl?: string;
};

export const GENERIC_SHELL_PREVIEW_MESSAGE: ShellPreviewMessage = {
  id: "generic",
  group: "generic",
  groupLabel: "Algemeen",
  label: "Generiek voorbeeld",
  subject: EMAIL_SHELL_PREVIEW_SUBJECT,
  body: EMAIL_SHELL_PREVIEW_BODY,
  ctaText: "Plan een gesprek",
  ctaUrl: "{{bookingLink}}",
};

type SystemMessageRow = {
  templateKey: string;
  module: string;
  moduleLabel: string;
  name: string;
  subject: string;
  body: string;
  bodyFormat?: "TEXT" | "HTML";
  ctaText?: string | null;
  ctaUrl?: string | null;
};

type StarterRow = {
  name: string;
  subject: string;
  body: string;
  bodyFormat?: "TEXT" | "HTML";
  ctaText?: string;
  ctaUrl?: string;
};

export function buildShellPreviewMessageCatalog(
  systemMessages?: SystemMessageRow[],
  starterPack?: StarterRow[],
): ShellPreviewMessage[] {
  const items: ShellPreviewMessage[] = [GENERIC_SHELL_PREVIEW_MESSAGE];

  for (const starter of starterPack ?? []) {
    items.push({
      id: `starter:${starter.name}`,
      group: "starter",
      groupLabel: "Outreach-starters",
      label: starter.name,
      subject: starter.subject,
      body: starter.body,
      bodyFormat: starter.bodyFormat ?? "TEXT",
      ctaText: starter.ctaText,
      ctaUrl: starter.ctaUrl,
    });
  }

  for (const message of systemMessages ?? []) {
    if (!message.body?.trim()) continue;
    items.push({
      id: `system:${message.templateKey}`,
      group: "system",
      groupLabel: message.moduleLabel || message.module,
      label: message.name,
      subject: message.subject || message.name,
      body: message.body,
      bodyFormat: message.bodyFormat ?? "TEXT",
      ctaText: message.ctaText || undefined,
      ctaUrl: message.ctaUrl || undefined,
    });
  }

  return items;
}

export function groupShellPreviewMessages(messages: ShellPreviewMessage[]) {
  const groups = new Map<string, ShellPreviewMessage[]>();

  for (const message of messages) {
    const key = message.group === "generic"
      ? "Algemeen"
      : message.group === "starter"
        ? "Outreach-starters"
        : message.groupLabel;

    const bucket = groups.get(key) ?? [];
    bucket.push(message);
    groups.set(key, bucket);
  }

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

export function findShellPreviewMessage(
  catalog: ShellPreviewMessage[],
  id: string,
): ShellPreviewMessage {
  return catalog.find((item) => item.id === id) ?? GENERIC_SHELL_PREVIEW_MESSAGE;
}
