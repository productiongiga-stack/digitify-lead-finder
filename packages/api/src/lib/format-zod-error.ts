import { type ZodError } from "zod";

/** Turns Zod validation issues into a short, user-facing message (Dutch-friendly). */
export function formatZodErrorMessage(error: ZodError): string {
  const messages = error.issues
    .map((issue) => issue.message?.trim())
    .filter((message): message is string => Boolean(message));

  if (messages.length === 0) {
    return "Controleer je invoer en probeer opnieuw.";
  }

  if (messages.length === 1) {
    return messages[0]!;
  }

  return messages.map((message) => `• ${message}`).join("\n");
}
