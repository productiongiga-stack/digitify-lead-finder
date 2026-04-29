const required = [
  "DATABASE_URL",
  "NEXTAUTH_URL",
  "NEXTAUTH_SECRET",
] as const;

export function assertServerEnv() {
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0 && process.env.NODE_ENV !== "test") {
    throw new Error(
      `Ontbrekende verplichte omgevingsvariabelen:\n${missing.map((k) => `  - ${k}`).join("\n")}\n\nKopieer .env.example naar .env.local en vul de waarden in.`
    );
  }
}
