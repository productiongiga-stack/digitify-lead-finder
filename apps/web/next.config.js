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
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "scontent.**.fbcdn.net" },
      { protocol: "https", hostname: "**.cdninstagram.com" },
    ],
  },
  experimental: {
    optimizePackageImports: [
      "@digitify/ui",
      "lucide-react",
      "recharts",
      "@tanstack/react-table",
      "date-fns",
      "@tanstack/react-query",
      "zustand",
      "@digitify/media-studio",
    ],
    serverActions: {
      bodySizeLimit: "10mb",
    },
    middlewareClientMaxBodySize: "100mb",
  },
  outputFileTracingRoot: workspaceRoot,
  outputFileTracingIncludes: {
    "/api/internal/fix-production-db": ["./packages/db/prisma/manual/**/*.sql"],
    "/api/trpc/[trpc]": ["./node_modules/sharp/**", "./node_modules/@img/**"],
    "/api/cron/social-publish": ["./node_modules/sharp/**", "./node_modules/@img/**"],
  },
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
    "sharp",
  ],
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
      {
        key: "Content-Security-Policy-Report-Only",
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data:",
          "connect-src 'self' https: wss:",
          "frame-src 'self'",
          "frame-ancestors 'self'",
        ].join("; "),
      },
    ];
    if (process.env.NODE_ENV === "production") {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }
    return [
      {
        source: "/((?!embed).*)",
        headers: securityHeaders,
      },
      {
        source: "/embed/:path*",
        headers: securityHeaders.filter((h) => h.key !== "X-Frame-Options"),
      },
    ];
  },
};

module.exports = nextConfig;
