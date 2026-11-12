import { describe, expect, it } from "vitest";
import { reportPushFailure } from "./sentry.mjs";

const DSN = "https://public123@o42.ingest.de.sentry.io/7";
const NOW = new Date("2026-11-12T06:00:00Z").getTime();

function fakeFetch(status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(null, { status });
  };
  return { calls, fetch };
}

/** The event item of a Sentry envelope: header line, item header line, event line. */
function eventOf(body: unknown) {
  const [header, item, event] = String(body).trim().split("\n");
  return { header: JSON.parse(header), item: JSON.parse(item), event: JSON.parse(event) };
}

describe("push failure report", () => {
  it("sends nothing without a DSN", async () => {
    const { calls, fetch } = fakeFetch();
    const sent = await reportPushFailure(
      { dsn: "", fetch, now: NOW },
      { failures: [{ kind: "reminder", status: 500 }] },
    );
    expect(sent).toBe(false);
    expect(calls).toEqual([]);
  });

  it("posts an envelope to the project of the DSN with its public key", async () => {
    const { calls, fetch } = fakeFetch();
    const sent = await reportPushFailure(
      { dsn: DSN, fetch, now: NOW },
      { failures: [{ kind: "reminder", status: 500 }] },
    );
    expect(sent).toBe(true);
    expect(calls).toHaveLength(1);
    const url = new URL(calls[0].url);
    expect(url.origin + url.pathname).toBe("https://o42.ingest.de.sentry.io/api/7/envelope/");
    expect(url.searchParams.get("sentry_key")).toBe("public123");
    expect(url.searchParams.get("sentry_version")).toBe("7");
    expect(calls[0].init.method).toBe("POST");
    const { header, item, event } = eventOf(calls[0].init.body);
    expect(header.event_id).toBe(event.event_id);
    expect(event.event_id).toMatch(/^[0-9a-f]{32}$/);
    expect(item.type).toBe("event");
    expect(event.timestamp).toBe(NOW / 1000);
  });

  it("counts the failed sends by notification kind and HTTP code", async () => {
    const { calls, fetch } = fakeFetch();
    await reportPushFailure(
      { dsn: DSN, fetch, now: NOW },
      {
        failures: [
          { kind: "reminder", status: 500 },
          { kind: "reminder", status: 500 },
          { kind: "result", status: "network" },
        ],
      },
    );
    const { event } = eventOf(calls[0].init.body);
    expect(event.level).toBe("error");
    expect(event.message.formatted).toBe("PUSH_SEND_FAILED: 3 failed send(s)");
    expect(event.tags).toMatchObject({
      code: "PUSH_SEND_FAILED",
      function: "push-notifications",
      kind: "reminder,result",
      status: "500,network",
    });
    expect(event.extra.failures).toEqual([
      { kind: "reminder", status: 500, count: 2 },
      { kind: "result", status: "network", count: 1 },
    ]);
  });

  it("reports an exception of the run by its type and message only", async () => {
    const { calls, fetch } = fakeFetch();
    await reportPushFailure(
      { dsn: DSN, fetch, now: NOW },
      { error: new TypeError("connection refused") },
    );
    const { event } = eventOf(calls[0].init.body);
    expect(event.tags.code).toBe("PUSH_RUN_FAILED");
    expect(event.exception.values).toEqual([{ type: "TypeError", value: "connection refused" }]);
  });

  it("never leaks an endpoint, a key or a player", async () => {
    const { calls, fetch } = fakeFetch();
    const failure = {
      kind: "result",
      status: 500,
      endpoint: "https://push.example.test/1",
      p256dh: "k1",
      auth: "a1",
      user_id: "u1",
    };
    await reportPushFailure({ dsn: DSN, fetch, now: NOW }, { failures: [failure] });
    const body = String(calls[0].init.body);
    for (const secret of ["push.example.test", "k1", "a1", "u1"])
      expect(body).not.toContain(secret);
  });

  it("does not throw when Sentry cannot be reached or refuses the event", async () => {
    const failing = async () => {
      throw new Error("offline");
    };
    const report = { failures: [{ kind: "reminder", status: 500 }] };
    await expect(reportPushFailure({ dsn: DSN, fetch: failing, now: NOW }, report)).resolves.toBe(
      false,
    );
    const refused = fakeFetch(429);
    await expect(
      reportPushFailure({ dsn: DSN, fetch: refused.fetch, now: NOW }, report),
    ).resolves.toBe(false);
    await expect(
      reportPushFailure({ dsn: "not a dsn", fetch: refused.fetch, now: NOW }, report),
    ).resolves.toBe(false);
  });
});
