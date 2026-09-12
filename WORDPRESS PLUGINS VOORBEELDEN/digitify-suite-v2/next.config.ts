import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Strict mode for better development experience
  reactStrictMode: true,

  // Image domains for external logos/avatars
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "utfs.io" }, // UploadThing
    ],
  },

  // Redirect root to first workspace (handled by middleware in production)
  async redirects() {
    return [];
  },
};

export default nextConfig;
