import { describe, expect, it } from "vitest";

import { onUnavailable, UseCaseError } from "@/application/errors";

import { scrub, sentryOptions } from "./sentry";

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

  it("reports a service outage, not a player's mistake", () => {
    const reported: string[] = [];
    onUnavailable((code) => reported.push(code));
    new UseCaseError("EVENTS_UNAVAILABLE");
    new UseCaseError("PSEUDO_TAKEN");
    expect(reported).toEqual(["EVENTS_UNAVAILABLE"]);
  });
});
