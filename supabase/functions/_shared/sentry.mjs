// #527: tells Sentry that a run of the Edge Function `push-notifications` failed, as the site's
// errors are (docs/sentry.md). One HTTP request to Sentry's envelope endpoint, no SDK. The event
// says how many sends failed, of which kind and with which HTTP status, or which exception broke
// the run: never an endpoint, a key or a player.
// Plain JavaScript with no import, so that Deno and Node both load it.

/**
 * Sends one event to the Sentry project of `dsn`. Without a DSN (or with a malformed one) it sends
 * nothing; it never throws, so a Sentry outage cannot break the sending of notifications.
 * @param {string} dsn `https://<key>@<host>/<project>`, the secret SENTRY_DSN of the function.
 * @param {{ error: unknown } | { failures: { kind: string, status: number | "network", count: number }[] }} problem
 * @param {(url: string, init: RequestInit) => Promise<Response>} [send]
 * @returns {Promise<boolean>} whether Sentry accepted the event.
 */
export async function reportPushFailure(dsn, problem, send = fetch) {
  /** @type {URL} */
  let parsed;
  try {
    parsed = new URL(dsn);
  } catch {
    return false;
  }
  const project = parsed.pathname.replace(/^\/+|\/+$/g, "");
  if (!parsed.username || !project) return false;

  const eventId = crypto.randomUUID().replaceAll("-", "");
  const tags = { function: "push-notifications" };
  /** @type {Record<string, unknown>} */
  let details;
  if ("error" in problem) {
    const { error } = problem;
    details = {
      exception: {
        values: [
          {
            type: error instanceof Error ? error.name : "Error",
            value: error instanceof Error ? error.message : String(error),
          },
        ],
      },
    };
  } else {
    // Only the three known fields of each failure: nothing else can slip in.
    const failures = problem.failures.map(({ kind, status, count }) => ({ kind, status, count }));
    const total = failures.reduce((sum, { count }) => sum + count, 0);
    const [first] = failures;
    details = {
      message: `${total} push send(s) failed`,
      // The most frequent case first in the tags, the whole list in `extra`.
      tags: first ? { ...tags, kind: first.kind, status: String(first.status) } : tags,
      extra: { failures },
      // One Sentry issue for every run with failed sends, whatever the counts.
      fingerprint: ["push-notifications", "failed-sends"],
    };
  }
  const event = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: "javascript",
    level: "error",
    logger: "push-notifications",
    tags,
    ...details,
  };
  const envelope = [
    JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n");

  try {
    const response = await send(`${parsed.protocol}//${parsed.host}/api/${project}/envelope/`, {
      method: "POST",
      headers: {
        "content-type": "application/x-sentry-envelope",
        "x-sentry-auth": `Sentry sentry_version=7, sentry_key=${parsed.username}, sentry_client=push-notifications/1`,
      },
      body: envelope,
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) console.error(`sentry refused the event (${response.status})`);
    return response.ok;
  } catch (error) {
    console.error(`sentry unreachable: ${error}`);
    return false;
  }
}
