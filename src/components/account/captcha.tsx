"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

import { messages } from "@/app/messages.fr";

type Turnstile = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/**
 * The Cloudflare Turnstile widget of the sign-in form (#331). It adds its token to the form as
 * `cf-turnstile-response`. Without a site key (local, CI) there is no captcha.
 */
export function Captcha() {
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(() => typeof window !== "undefined" && !!window.turnstile);

  useEffect(() => {
    if (!SITE_KEY || !ready || !box.current || !window.turnstile) return;
    const id = window.turnstile.render(box.current, {
      sitekey: SITE_KEY,
      language: "fr",
      appearance: "interaction-only",
    });
    return () => window.turnstile?.remove(id);
  }, [ready]);

  if (!SITE_KEY) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
      />
      <div ref={box} aria-label={messages.captcha.label} className="min-h-0" />
    </>
  );
}
