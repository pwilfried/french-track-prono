import type { Viewport } from "next";

/**
 * Root viewport. `viewportFit: "cover"` makes the page fill the whole screen in the iOS
 * home-screen app: without it, WebKit lets `fixed` bars (the bottom nav) drift while scrolling
 * and `env(safe-area-inset-*)` stays 0 (#1102).
 */
export const appViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfbf5" },
    { media: "(prefers-color-scheme: dark)", color: "#052b5c" },
  ],
};
