// #527: tells Sentry when a run of the Edge Function `push-notifications` fails, as the site does
// for its own errors (docs/sentry.md). One HTTP POST of a Sentry envelope, no SDK. The event
// carries counts, notification kinds, HTTP codes or the type and message of an exception: never
// an endpoint, a key or a player. Plain JavaScript with no import, so that Deno and Node load it.

/**
 * The envelope endpoint of a DSN (`https://<key>@<host>/<project>`), or null if it is not one.
 * @param {string} dsn
 */
function envelopeUrl(dsn) {
  try {
    const { protocol, username, host, pathname } = new URL(dsn);
    const project = pathname.split("/").filter(Boolean).pop();
    if (!username || !project) return null;
    const query = `sentry_version=7&sentry_key=${encodeURIComponent(username)}`;
    return `${protocol}//${host}/api/${project}/envelope/?${query}`;
  } catch {
    return null;
  }
}

/**
 * The failed sends grouped by notification kind and HTTP code. Only those two fields are read.
 * @param {{ kind: string, status: number | string }[]} failures
 */
function grouped(failures) {
  /** @type {Map<string, { kind: string, status: number | string, count: number }>} */
  const groups = new Map();
  for (const { kind, status } of failures) {
    const key = `${kind} ${status}`;
    const group = groups.get(key) ?? { kind, status, count: 0 };
    group.count += 1;
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** @param {unknown[]} values */
const distinct = (values) => [...new Set(values.map(String))].join(",");

/**
 * The Sentry event of a failed run: failed sends (`failures`) or an exception (`error`).
 * @param {{ failures?: { kind: string, status: number | string }[], error?: unknown }} failure
 * @param {number} now
 */
function eventOf({ failures = [], error }, now) {
  const base = {
    event_id: crypto.randomUUID().replaceAll("-", ""),
    timestamp: now / 1000,
    platform: "javascript",
    level: "error",
    logger: "push-notifications",
    environment: "production",
  };
  if (error !== undefined) {
    const { name, message } = error instanceof Error ? error : { name: "Error", message: String(error) };
    return {
      ...base,
      tags: { code: "PUSH_RUN_FAILED", function: "push-notifications" },
      exception: { values: [{ type: name, value: message.slice(0, 500) }] },
    };
  }
  const groups = grouped(failures);
  return {
    ...base,
    message: { formatted: `PUSH_SEND_FAILED: ${failures.length} failed send(s)` },
    tags: {
      code: "PUSH_SEND_FAILED",
      function: "push-notifications",
      kind: distinct(groups.map((group) => group.kind)),
      status: distinct(groups.map((group) => group.status)),
    },
    fingerprint: ["PUSH_SEND_FAILED"],
    extra: { failures: groups },
  };
}

/**
 * Sends a failed run to Sentry. Without a DSN, does nothing. Never throws: a Sentry outage must not
 * hide the run's own result. Returns whether Sentry accepted the event.
 * @param {{ dsn: string, fetch: (url: string, init: RequestInit) => Promise<Response>,
 *           now?: number }} sentry
 * @param {{ failures?: { kind: string, status: number | string }[], error?: unknown }} failure
 */
export async function reportPushFailure({ dsn, fetch, now = Date.now() }, failure) {
  if (!dsn) return false;
  const url = envelopeUrl(dsn);
  if (!url) {
    console.error("SENTRY_DSN is not a DSN: nothing reported.");
    return false;
  }
  const event = eventOf(failure, now);
  const body = [
    JSON.stringify({ event_id: event.event_id, sent_at: new Date(now).toISOString() }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n");
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope" },
      body: `${body}\n`,
    });
    if (!response.ok) console.error(`Sentry refused the report (${response.status}).`);
    return response.ok;
  } catch (error) {
    console.error(`Sentry unreachable: ${error}`);
    return false;
  }
}
