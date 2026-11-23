"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

import { messages } from "@/app/messages.fr";
import { buttonVariants } from "@/components/ui/button";
import { reportError } from "@/lib/report-error";

export type Turnstile = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/** Sentry hears of a captcha error once per page load, not once per try (#1145). */
let reported = false;

/**
 * The Cloudflare Turnstile widget of the sign-in form (#331). It adds its token to the form as
 * `cf-turnstile-response`. Without a site key (local, CI) there is no captcha.
 *
 * On an error (#1145: 110200, the address is not allowed for the widget), the widget does not try
 * again on its own: the form says so and offers « Réessayer ».
 */
export function Captcha({ siteKey = SITE_KEY }: { siteKey?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [ready, setReady] = useState(() => typeof window !== "undefined" && !!window.turnstile);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!siteKey || !ready || !box.current || !window.turnstile) return;
    const id = window.turnstile.render(box.current, {
      sitekey: siteKey,
      language: "fr",
      appearance: "always",
      retry: "never",
      "error-callback": (code: string) => {
        setFailed(true);
        if (!reported) {
          reported = true;
          reportError(new Error(`Turnstile error ${code}`), "captcha");
        }
        // Handled: Turnstile does not throw.
        return true;
      },
      callback: () => setFailed(false),
    });
    widget.current = id;
    return () => {
      widget.current = null;
      window.turnstile?.remove(id);
    };
  }, [ready, siteKey]);

  function retry() {
    setFailed(false);
    if (widget.current) window.turnstile?.reset(widget.current);
  }

  if (!siteKey) return null;
  return (
    <>
      {ready ? null : (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onReady={() => setReady(true)}
        />
      )}
      <div ref={box} aria-label={messages.captcha.label} className="min-h-0" />
      {failed ? (
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-sm font-semibold text-accent-text">
            {messages.errors.CAPTCHA_UNAVAILABLE}
          </p>
          <button type="button" className={buttonVariants({ variant: "outline" })} onClick={retry}>
            {messages.captcha.retry}
          </button>
        </div>
      ) : null}
    </>
  );
}
