"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import { messages } from "./messages.fr";
import "./globals.css";

const text = messages.globalError;

/** Last resort when even the layout fails: the error goes to Sentry (#195), the player can retry. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold">{text.title}</h1>
        <p className="text-muted-foreground">{text.body}</p>
        <button
          type="button"
          onClick={reset}
          className="min-h-11 rounded-full bg-primary px-6 font-semibold text-primary-foreground"
        >
          {text.retry}
        </button>
      </body>
    </html>
  );
}
