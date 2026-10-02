import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@digitify/db";
import { authRateLimit, finishLogin } from "@digitify/api/src/lib/two-factor";
import { LOGIN_COOKIE } from "./two-factor-http";
import { log } from "@digitify/api/src/lib/logger";
import { resolveWorkspaceContext } from "@digitify/api/src/lib/workspace-registry";
import { resolveSessionIdentity } from "@digitify/api/src/lib/session-identity";

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
      credentials: { code: { label: "Code", type: "text" }, method: { label: "Method", type: "text" } },
      async authorize(credentials, request) {
        try {
          const cookie = String(request.headers?.cookie ?? "").split(";").map((part) => part.trim()).find((part) => part.startsWith(LOGIN_COOKIE + "="));
          const challenge = cookie ? decodeURIComponent(cookie.slice(LOGIN_COOKIE.length + 1)) : undefined;
          if (!challenge) return null;
          const ip = String(request.headers?.["x-forwarded-for"] || "unknown").split(",")[0];
          await authRateLimit(prisma, "login-finish-ip:" + ip, 30);
          const user = await finishLogin(prisma, challenge, credentials?.code, credentials?.method === "recovery" ? "recovery" : "totp");
          const workspace = await resolveWorkspaceContext(prisma, user.id);
          return { id: user.id, email: user.email, name: user.name, role: user.role, workspaceId: workspace.workspaceId, workspaceRole: workspace.workspaceRole, isPersonalWorkspace: workspace.isPersonalWorkspace, sessionVersion: user.sessionVersion, twoFactorVerified: user.twoFactorEnabled };
        } catch {
          log.auth.warn("Login security challenge rejected");
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = (user as { role?: string }).role;
        token.name = user.name;
        token.email = user.email;
        token.workspaceId = (user as { workspaceId?: string }).workspaceId;
        token.workspaceRole = (user as { workspaceRole?: string }).workspaceRole;
        token.isPersonalWorkspace = (user as { isPersonalWorkspace?: boolean }).isPersonalWorkspace;
        token.sessionVersion = (user as { sessionVersion?: number }).sessionVersion;
        token.twoFactorVerified = (user as { twoFactorVerified?: boolean }).twoFactorVerified === true;
        return token;
      }

      const identity = token.sub
        ? await resolveSessionIdentity(prisma, token.sub, token.sessionVersion, token.twoFactorVerified)
        : null;
      if (!identity) return {};
      return { ...token, ...identity, sub: identity.id };
    },
    async session({ session, token }) {
      if (!token.sub) return { ...session, user: undefined };
      if (session.user) {
        const sessionUser = session.user as {
          id?: string;
          role?: string;
          workspaceId?: string;
          workspaceRole?: string;
          isPersonalWorkspace?: boolean;
          disabledModules?: string[];
        };
        sessionUser.id = token.sub;
        sessionUser.disabledModules = Array.isArray(token.disabledModules) ? token.disabledModules as string[] : [];
        sessionUser.role = token.role as string | undefined;
        sessionUser.workspaceId =
          typeof token.workspaceId === "string" ? token.workspaceId : undefined;
        sessionUser.workspaceRole =
          typeof token.workspaceRole === "string" ? token.workspaceRole : undefined;
        sessionUser.isPersonalWorkspace =
          typeof token.isPersonalWorkspace === "boolean" ? token.isPersonalWorkspace : undefined;
      }
      return session;
    },
  },
};
