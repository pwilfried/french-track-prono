import { describe, expect, it } from "vitest";

import { forwardedHeaders, readProxiedSession, SESSION_HEADER } from "./proxied-session";

describe("proxied session", () => {
  it("is absent when the proxy did not set it, so the page checks with the auth server", () => {
    expect(readProxiedSession(new Headers())).toBeUndefined();
  });

  it("is absent when the header cannot be read", () => {
    expect(readProxiedSession(new Headers({ [SESSION_HEADER]: "%E0%A4%A" }))).toBeUndefined();
  });

  it("keeps the other request headers", () => {
    const headers = forwardedHeaders(new Headers({ cookie: "a=b" }), "GET", { user: null });

    expect(headers.get("cookie")).toBe("a=b");
  });
});
