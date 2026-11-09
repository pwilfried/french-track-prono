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

const isDev = process.env.NODE_ENV !== "production";
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

// Next.js injects inline scripts and styles, hence 'unsafe-inline' (a nonce-based policy would
// force dynamic rendering everywhere). The browser only talks to this site and Supabase, plus
// Cloudflare Turnstile for the captcha of the sign-in page (#331).
const turnstile = "https://challenges.cloudflare.com";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${turnstile}${isDev ? " 'unsafe-eval'" : ""}`,
  `frame-src ${turnstile}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${turnstile}${isDev ? " ws:" : ""}`.trim(),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** Security headers on every response. */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: devOrigins,
  poweredByHeader: false,
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
