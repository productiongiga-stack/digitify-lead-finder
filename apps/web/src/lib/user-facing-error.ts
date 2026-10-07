type UnknownError = {
  message?: string;
  data?: { zodError?: { fieldErrors?: Record<string, string[]> } };
};

const GENERIC_MESSAGES = new Set([
  "Er ging iets mis. Probeer het opnieuw of neem contact op met je beheerder.",
  "Internal Server Error",
  "Internal server error",
]);

export function userFacingError(error: unknown, fallback: string) {
  const candidate = error as UnknownError | null;
  const message = typeof candidate?.message === "string" ? candidate.message.trim() : "";
  if (message && !GENERIC_MESSAGES.has(message)) return message;
  const fields = candidate?.data?.zodError?.fieldErrors;
  const firstFieldError = fields ? Object.values(fields).flat().find(Boolean) : undefined;
  return firstFieldError || fallback;
}
