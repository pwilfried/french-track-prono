import type { MetadataRoute } from "next";

import { messages } from "./messages.fr";

// Icons in public/icons come from the FrenchTrack logo on the cream page colour; the maskable one
// keeps the logo inside the 80 % safe zone.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: messages.app.name,
    short_name: messages.app.short,
    description: messages.app.description,
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    categories: ["sports"],
    theme_color: "#fdfbf5",
    background_color: "#fdfbf5",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
