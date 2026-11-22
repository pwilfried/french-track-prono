import type { ErrorEvent, init } from "@sentry/nextjs";

type Options = NonNullable<Parameters<typeof init>[0]>;
type TransactionEvent = Parameters<NonNullable<Options["beforeSendTransaction"]>>[0];

/**
 * iPhone network noise the app cannot fix: a dropped connection ("Load failed") and a service
 * worker script that failed to load (retried on the next page load, see service-worker.tsx).
 * Strings match as substrings of the message.
 */
export const IGNORED_ERRORS = ["Load failed", "sw.js load failed"];

/**
 * Sentry (#195), EU region, errors only, no replay. Off without a DSN, in development and in fake
 * mode. An event never carries an e-mail or a pseudo: only the Supabase user id.
 *
 * Server traces (#824) only when SENTRY_TRACES_SAMPLE_RATE is set (a rate between 0 and 1): the
 * time of each page and its Supabase requests, to measure them. The browser never reads that
 * variable (no NEXT_PUBLIC_ prefix), so it never traces.
 */
export function sentryOptions(
  dsn = process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesRate = process.env.SENTRY_TRACES_SAMPLE_RATE,
  environment = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
) {
  return {
    dsn,
    environment: environment || "production",
    ignoreErrors: IGNORED_ERRORS,
    enabled:
      Boolean(dsn) && process.env.NODE_ENV === "production" && process.env.FTP_FAKE_DB !== "1",
    sendDefaultPii: false,
    tracesSampleRate: sampleRate(tracesRate),
    beforeSend: scrub,
    beforeSendTransaction: scrubTransaction,
  };
}

/** A rate between 0 and 1; anything else (absent, not a number) traces nothing. */
export function sampleRate(text: string | undefined): number {
  const rate = Number(text);
  return Number.isFinite(rate) && rate > 0 ? Math.min(rate, 1) : 0;
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

const withoutQuery = (text: string) => text.split("?")[0]!;

/**
 * A trace keeps the paths and timings only: no cookie, no body, and no query string, which holds
 * the ids and filters of each Supabase request (and the e-mail of a sign-in link).
 */
export function scrubTransaction(event: TransactionEvent): TransactionEvent {
  if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.query_string;
    if (event.request.url) event.request.url = withoutQuery(event.request.url);
    if (event.request.headers) delete event.request.headers.cookie;
  }
  if (event.transaction) event.transaction = withoutQuery(event.transaction);
  for (const span of event.spans ?? []) {
    if (span.description) span.description = withoutQuery(span.description);
    for (const key of ["url", "http.url", "http.query", "url.full", "url.query", "http.target"])
      if (typeof span.data?.[key] === "string")
        span.data[key] = key.endsWith("query") ? "" : withoutQuery(span.data[key] as string);
  }
  return event;
}
