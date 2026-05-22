const path = require("path");

const workspaceRoot = path.join(__dirname, "../../");

function resolveAppUrl() {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
  outputFileTracingRoot: workspaceRoot,
  turbopack: {
    root: workspaceRoot,
  },
  env: {
    NEXTAUTH_URL: resolveAppUrl(),
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  transpilePackages: [
    "@digitify/api",
    "@digitify/db",
    "@digitify/ui",
    "@digitify/email",
    "@digitify/openclaw",
    "@digitify/scoring",
    "@digitify/connectors",
  ],
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
    "bcryptjs",
    "@sentry/node",
    "@sentry/nextjs",
  ],
};

module.exports = nextConfig;
