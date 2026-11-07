import type { MetadataRoute } from "next";

// Public static pages only: event pages need Supabase at runtime.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return ["/", "/epreuves", "/connexion"].map((path) => ({ url: `${base}${path}` }));
}
