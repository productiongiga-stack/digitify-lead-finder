import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@digitify/db";
import { scryptSync, timingSafeEqual } from "crypto";
import { log } from "@digitify/api/src/lib/logger";

function normalizeAbsoluteUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function normalizeVercelHost(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return `https://${trimmed}`;
}

function resolveAuthBaseUrl(): string {
  return (
    normalizeAbsoluteUrl(process.env.NEXTAUTH_URL) ||
    normalizeAbsoluteUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeAbsoluteUrl(process.env.APP_URL) ||
    normalizeAbsoluteUrl(normalizeVercelHost(process.env.VERCEL_URL)) ||
    `http://localhost:${process.env.PORT ?? 3000}`
  );
}

// Guard against empty env values (for example VERCEL_URL="") that cause next-auth URL parsing to crash at build time.
Object.assign(process.env, { NEXTAUTH_URL: resolveAuthBaseUrl() });

function verifyPassword(password: string, storedHash: string): boolean {
  if (storedHash.includes(":")) {
    const [salt, hash] = storedHash.split(":");
    const derivedHash = scryptSync(password, salt!, 64);
    return timingSafeEqual(derivedHash, Buffer.from(hash!, "hex"));
  }
  // Legacy SHA256 — verify only, caller must upgrade hash afterwards
  const { createHash } = require("crypto");
  const legacyHash = createHash("sha256").update(password).digest("hex");
  return legacyHash === storedHash;
}

function hashPassword(password: string): string {
  const { randomBytes } = require("crypto");
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function isLegacyHash(storedHash: string): boolean {
  return !storedHash.includes(":");
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 12,
    updateAge: 60 * 15,
  },
  pages: {
    signIn: "/login",
  },
  jwt: {
    maxAge: 60 * 60 * 12,
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          log.auth.warn("Login attempt with missing credentials");
          return null;
        }

        const email = credentials.email.toLowerCase().trim();
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user || !user.passwordHash) {
          log.auth.warn("Login failed: unknown user", { email });
          return null;
        }

        if (!verifyPassword(credentials.password, user.passwordHash)) {
          log.auth.warn("Login failed: bad password", { email, userId: user.id });
          return null;
        }

        if (!user.emailVerified) {
          if (user.role === "OWNER" || user.role === "ADMIN") {
            await prisma.user.update({
              where: { id: user.id },
              data: { emailVerified: new Date() },
            });
            log.auth.info("Backfilled emailVerified for privileged account", { userId: user.id });
          } else {
            log.auth.warn("Login blocked: email not verified", { email, userId: user.id });
            return null;
          }
        }

        // Transparently upgrade legacy SHA256 hashes to scrypt on successful login
        if (isLegacyHash(user.passwordHash)) {
          const upgraded = hashPassword(credentials.password);
          await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: upgraded },
          });
          log.auth.info("Password hash upgraded to scrypt", { userId: user.id });
        }

        log.auth.info("Login success", { userId: user.id, email });
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = (user as any).role;
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
};
