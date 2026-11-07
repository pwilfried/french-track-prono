import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/auth/",
        "/admin",
        "/profil",
        "/bienvenue",
        "/mes-points",
        "/ligues",
        "/au-revoir",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
