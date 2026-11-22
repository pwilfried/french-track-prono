import { describe, expect, it } from "vitest";

import { onUnavailable, UseCaseError } from "@/application/errors";

import { sampleRate, scrub, scrubTransaction, sentryOptions } from "./sentry";

describe("Sentry options (#195)", () => {
  it("never sends an e-mail, a pseudo or cookies", () => {
    const event = scrub({
      type: undefined,
      user: { id: "uuid-1", email: "a@example.test", username: "Pseudo" },
      request: { data: "email=a@example.test", cookies: { sb: "x" }, headers: { cookie: "sb=x" } },
    });
    expect(event.user).toEqual({ id: "uuid-1" });
    expect(event.request).toEqual({ headers: {} });
  });

  it("is off without a DSN and outside production", () => {
    expect(sentryOptions(undefined).enabled).toBe(false);
    expect(sentryOptions("https://key@o1.ingest.de.sentry.io/1").enabled).toBe(false); // tests run in "test"
  });

  it("tags the environment, production by default", () => {
    expect(sentryOptions("dsn", undefined, "preprod").environment).toBe("preprod");
    expect(sentryOptions("dsn", undefined, undefined).environment).toBe("production");
    expect(sentryOptions("dsn", undefined, "").environment).toBe("production");
  });

  it("ignores iPhone network noise but not other TypeErrors", () => {
    const { ignoreErrors } = sentryOptions("dsn");
    expect(ignoreErrors).toContain("Load failed");
    expect(ignoreErrors).toContain("sw.js load failed");
    expect(ignoreErrors.some((text) => "TypeError: x is undefined".includes(text))).toBe(false);
  });

  it("reports a service outage, not a player's mistake", () => {
    const reported: string[] = [];
    onUnavailable((code) => reported.push(code));
    new UseCaseError("EVENTS_UNAVAILABLE");
    new UseCaseError("PSEUDO_TAKEN");
    expect(reported).toEqual(["EVENTS_UNAVAILABLE"]);
  });
});

describe("Sentry server traces (#824)", () => {
  it("traces nothing unless a rate between 0 and 1 is set", () => {
    expect(sentryOptions("dsn", undefined).tracesSampleRate).toBe(0);
    expect(sampleRate("abc")).toBe(0);
    expect(sampleRate("-1")).toBe(0);
    expect(sampleRate("0.2")).toBe(0.2);
    expect(sampleRate("4")).toBe(1);
  });

  it("keeps the paths and timings of a trace, never a query string, cookie or e-mail", () => {
    const event = scrubTransaction({
      type: "transaction",
      transaction: "GET /classement?ligue=abc",
      user: { id: "uuid-1", email: "a@example.test" },
      request: {
        url: "https://site.example.test/classement?ligue=abc",
        query_string: "ligue=abc",
        cookies: { sb: "x" },
        headers: { cookie: "sb=x" },
      },
      spans: [
        {
          span_id: "1",
          trace_id: "t",
          start_timestamp: 0,
          status: "ok",
          description: "GET https://db.example.test/rest/v1/score_events?user_id=eq.uuid-2",
          data: {
            "url.full": "https://db.example.test/rest/v1/profiles?id=eq.uuid-2",
            "http.query": "?id=eq.uuid-2",
          },
        },
      ],
    });

    expect(event.transaction).toBe("GET /classement");
    expect(event.user).toEqual({ id: "uuid-1" });
    expect(event.request).toEqual({ url: "https://site.example.test/classement", headers: {} });
    expect(event.spans?.[0]?.description).toBe("GET https://db.example.test/rest/v1/score_events");
    expect(event.spans?.[0]?.data).toEqual({
      "url.full": "https://db.example.test/rest/v1/profiles",
      "http.query": "",
    });
  });
});
