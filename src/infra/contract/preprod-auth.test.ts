import { describe, expect, it, vi } from "vitest";

import { PREPROD_EMAIL_RATE_LIMIT, raisePreprodEmailRateLimit } from "./preprod-auth";

const preprod = {
  E2E_BASE_URL: "https://preprod.example.test",
  SUPABASE_ACCESS_TOKEN: "token",
  SUPABASE_PROJECT_REF: "preprodref",
  PREPROD_PROJECT_REF: "preprodref",
};

function api(current: unknown, patchStatus = 200) {
  return vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "PATCH") return new Response("{}", { status: patchStatus });
    return new Response(JSON.stringify({ rate_limit_email_sent: current }), { status: 200 });
  });
}

describe("raisePreprodEmailRateLimit", () => {
  it("raises the hourly e-mail limit of pre-production when it is below one suite's sign-ups", async () => {
    const fetcher = api(30);

    const outcome = await raisePreprodEmailRateLimit(preprod, fetcher);

    expect(outcome).toEqual({ kind: "raised", from: 30, to: PREPROD_EMAIL_RATE_LIMIT });
    const [url, init] = fetcher.mock.calls[1]!;
    expect(url).toBe("https://api.supabase.com/v1/projects/preprodref/config/auth");
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toEqual({
      rate_limit_email_sent: PREPROD_EMAIL_RATE_LIMIT,
    });
  });

  it("leaves a limit already high enough as it is", async () => {
    const fetcher = api(PREPROD_EMAIL_RATE_LIMIT + 100);

    const outcome = await raisePreprodEmailRateLimit(preprod, fetcher);

    expect(outcome).toEqual({ kind: "kept", current: PREPROD_EMAIL_RATE_LIMIT + 100 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does nothing outside pre-production", async () => {
    const fetcher = api(30);

    expect(await raisePreprodEmailRateLimit({}, fetcher)).toEqual({ kind: "skipped" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("never touches a project other than the pre-production one", async () => {
    const fetcher = api(30);

    const outcome = await raisePreprodEmailRateLimit(
      { ...preprod, SUPABASE_PROJECT_REF: "productionref" },
      fetcher,
    );

    expect(outcome).toEqual({ kind: "skipped" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reports a refused change instead of stopping the run", async () => {
    const outcome = await raisePreprodEmailRateLimit(preprod, api(30, 400));

    expect(outcome).toEqual({ kind: "failed", reason: expect.stringContaining("400") });
  });
});
