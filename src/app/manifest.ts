import type { MetadataRoute } from "next";

import { messages } from "./messages.fr";

// Icons in public/icons are placeholders (FTP badge on the brand gradient) until the real logo is exported.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: messages.app.name,
    short_name: messages.app.short,
    description: messages.app.description,
    lang: "fr",
    start_url: "/",
    display: "standalone",
    theme_color: "#084595",
    background_color: "#052b5c",
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
