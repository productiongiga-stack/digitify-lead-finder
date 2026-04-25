const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../../"),
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
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
  serverExternalPackages: ["@prisma/client", "prisma", "bcryptjs"],
};

module.exports = nextConfig;
