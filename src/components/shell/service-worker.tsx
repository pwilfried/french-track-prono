"use client";

import { useEffect } from "react";

/** Registers the service worker (offline pages), in production builds only. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Without a service worker the app works the same, online only.
    });
  }, []);
  return null;
}
