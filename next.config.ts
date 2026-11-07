import type { NextConfig } from "next";

/**
 * In development, Next.js only serves its scripts to `localhost`. To test on a phone on the same
 * Wi-Fi (the app opened with the computer's local address), the private network ranges are
 * allowed too; DEV_ALLOWED_ORIGINS adds other hostnames (comma separated). No effect in production.
 */
const devOrigins = [
  "192.168.*.*",
  "10.*.*.*",
  "172.*.*.*",
  "*.local",
  ...(process.env.DEV_ALLOWED_ORIGINS?.split(",")
    .map((h) => h.trim())
    .filter(Boolean) ?? []),
];

/** Basic security headers on every response; a Content-Security-Policy comes with the production origins. */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: devOrigins,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
