import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { TrackBackground } from "@/components/home/track-background";
import { SiteFooter } from "@/components/legal/site-footer";
import { BottomNav } from "@/components/shell/bottom-nav";
import { ServiceWorker } from "@/components/shell/service-worker";
import { PlayerOnly } from "@/components/shell/player-only";
import { SiteHeader } from "@/components/shell/site-header";

import { messages } from "./messages.fr";
import "./globals.css";

// Self-hosted variable fonts (npm packages @fontsource-variable/*): no request to Google at runtime.
const display = localFont({
  src: "../../node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2",
  variable: "--font-bricolage",
  weight: "200 800",
});

const inter = localFont({
  src: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  variable: "--font-inter",
  weight: "100 900",
});

const mono = localFont({
  src: "../../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2",
  variable: "--font-jetbrains",
  weight: "100 800",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: messages.app.name,
  description: messages.app.description,
  robots: { index: true, follow: true },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: messages.app.short, statusBarStyle: "default" },
  openGraph: {
    title: messages.app.name,
    description: messages.app.description,
    locale: "fr_FR",
    type: "website",
    siteName: messages.app.name,
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512 }],
  },
  twitter: {
    card: "summary",
    title: messages.app.name,
    description: messages.app.description,
    images: ["/icons/icon-512.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfbf5" },
    { media: "(prefers-color-scheme: dark)", color: "#052b5c" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      className={`${display.variable} ${inter.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="relative isolate min-h-full flex flex-col pb-16 md:pb-0">
        <TrackBackground />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:font-semibold focus:text-card-foreground focus:ring-2 focus:ring-ring"
        >
          {messages.app.skipToContent}
        </a>
        <PlayerOnly>
          <SiteHeader />
        </PlayerOnly>
        {children}
        <PlayerOnly>
          <SiteFooter />
          <BottomNav />
        </PlayerOnly>
        <ServiceWorker />
      </body>
    </html>
  );
}
