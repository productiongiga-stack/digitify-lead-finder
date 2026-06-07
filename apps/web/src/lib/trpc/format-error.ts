type ZodIssueLike = {
  message?: string;
};

/** Formats tRPC / Zod validation messages for UI (also parses legacy JSON issue arrays). */
export function formatTrpcErrorMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return message;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return message;
    }

    const messages = parsed
      .map((item) => (typeof item === "object" && item !== null ? (item as ZodIssueLike).message : undefined))
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0);

    if (messages.length === 0) {
      return message;
    }

    if (messages.length === 1) {
      return messages[0]!;
    }

    return messages.map((value) => `• ${value}`).join("\n");
  } catch {
    return message;
  }
}

export function describeTrpcError(error: { message: string }): string {
  return formatTrpcErrorMessage(error.message);
}
