import * as Sentry from "@sentry/nextjs";
import { describe, expect, it, vi } from "vitest";

import { UseCaseError } from "@/application/errors";

import { reportError } from "./report-error";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

describe("reportError (#195)", () => {
  it("reports an unexpected error with where it happened", () => {
    const error = new Error("boom");
    reportError(error, "admin-list");
    expect(Sentry.captureException).toHaveBeenCalledWith(error, { tags: { where: "admin-list" } });
  });

  it("leaves out a player's mistake, a known outage and a cancelled share", () => {
    vi.mocked(Sentry.captureException).mockClear();
    reportError(new UseCaseError("PSEUDO_TAKEN"), "x");
    reportError(new DOMException("cancelled", "AbortError"), "x");
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
