import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

// Basic CSP: Next injects inline scripts/styles, hence 'unsafe-inline' (a nonce-based CSP would force dynamic rendering everywhere).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin}${isDev ? " ws:" : ""}`.trim(),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: csp },
];

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

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: devOrigins,
  headers: async () => [{ source: "/:path*", headers: securityHeaders }],
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
