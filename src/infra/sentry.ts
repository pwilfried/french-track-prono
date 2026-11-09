import type { ErrorEvent } from "@sentry/nextjs";

/**
 * Sentry (#195), EU region, errors only (no tracing, no replay). Off without a DSN, in development
 * and in fake mode. An event never carries an e-mail or a pseudo: only the Supabase user id.
 */
export function sentryOptions(dsn = process.env.NEXT_PUBLIC_SENTRY_DSN) {
  return {
    dsn,
    enabled:
      Boolean(dsn) && process.env.NODE_ENV === "production" && process.env.FTP_FAKE_DB !== "1",
    sendDefaultPii: false,
    beforeSend: scrub,
  };
}

/** Keeps only the user id, and drops what could hold an e-mail (request body, cookies). */
export function scrub(event: ErrorEvent): ErrorEvent {
  if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    if (event.request.headers) delete event.request.headers.cookie;
  }
  return event;
}
