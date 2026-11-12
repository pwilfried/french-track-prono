import { describe, expect, it } from "vitest";
import { reportPushFailure } from "./sentry.mjs";

const dsn = "https://publickey@o1.ingest.de.sentry.io/42";

function fakeSentry(status = 200) {
  const requests: { url: string; init: RequestInit }[] = [];
  const send = async (url: string, init: RequestInit) => {
    requests.push({ url, init });
    return new Response(null, { status });
  };
  return { requests, send };
}

/** The event of a Sentry envelope: header, item header, then the event, one JSON per line. */
function eventOf(body: unknown) {
  const [header, item, event] = String(body).split("\n").map((line) => JSON.parse(line));
  return { header, item, event };
}

describe("reporting a failed push run to Sentry", () => {
  it("sends nothing without a DSN", async () => {
    const sentry = fakeSentry();
    const sent = await reportPushFailure(
      "",
      { failures: [{ kind: "reminder", status: 500, count: 1 }] },
      sentry.send,
    );
    expect(sent).toBe(false);
    expect(sentry.requests).toEqual([]);
  });

  it("sends the failed sends with their kind and HTTP status to the DSN's project", async () => {
    const sentry = fakeSentry();
    const sent = await reportPushFailure(
      dsn,
      {
        failures: [
          { kind: "reminder", status: 500, count: 2 },
          { kind: "result", status: "network", count: 1 },
        ],
      },
      sentry.send,
    );
    expect(sent).toBe(true);
    expect(sentry.requests).toHaveLength(1);
    const [{ url, init }] = sentry.requests;
    expect(url).toBe("https://o1.ingest.de.sentry.io/api/42/envelope/");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("x-sentry-auth")).toContain("sentry_key=publickey");
    const { header, item, event } = eventOf(init.body);
    expect(header.event_id).toBe(event.event_id);
    expect(item).toEqual({ type: "event" });
    expect(event).toMatchObject({
      level: "error",
      message: "3 push send(s) failed",
      tags: { function: "push-notifications", kind: "reminder", status: "500" },
      extra: {
        failures: [
          { kind: "reminder", status: 500, count: 2 },
          { kind: "result", status: "network", count: 1 },
        ],
      },
      fingerprint: ["push-notifications", "failed-sends"],
    });
  });

  it("sends an exception of the run with its type and message", async () => {
    const sentry = fakeSentry();
    await reportPushFailure(dsn, { error: new TypeError("connection refused") }, sentry.send);
    const { event } = eventOf(sentry.requests[0].init.body);
    expect(event.exception.values[0]).toMatchObject({
      type: "TypeError",
      value: "connection refused",
    });
    expect(event.tags).toEqual({ function: "push-notifications" });
  });

  it("never carries an endpoint, a key or a player", async () => {
    const sentry = fakeSentry();
    await reportPushFailure(
      dsn,
      {
        failures: [
          // Extra fields slipped into a failure are not sent.
          {
            kind: "result",
            status: 413,
            count: 1,
            endpoint: "https://push.example.test/1",
            p256dh: "k1",
            user_id: "u1",
          } as never,
        ],
      },
      sentry.send,
    );
    const body = String(sentry.requests[0].init.body);
    expect(body).not.toContain("push.example.test");
    expect(body).not.toContain("k1");
    expect(body).not.toContain("u1");
  });

  it("does not throw when Sentry is down", async () => {
    const down = async () => {
      throw new Error("unreachable");
    };
    await expect(reportPushFailure(dsn, { error: new Error("boom") }, down)).resolves.toBe(false);
    const refused = fakeSentry(429);
    await expect(
      reportPushFailure(dsn, { error: new Error("boom") }, refused.send),
    ).resolves.toBe(false);
  });

  it("ignores a malformed DSN", async () => {
    const sentry = fakeSentry();
    await expect(
      reportPushFailure("not a dsn", { error: new Error("boom") }, sentry.send),
    ).resolves.toBe(false);
    expect(sentry.requests).toEqual([]);
  });
});
