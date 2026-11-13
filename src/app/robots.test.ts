import { afterEach, describe, expect, it, vi } from "vitest";

import robots from "./robots";
import { robotsMeta } from "./indexing";

afterEach(() => vi.unstubAllEnvs());

describe("search engines", () => {
  it("lets search engines index the production site", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_NOINDEX", "");

    expect(robotsMeta()).toEqual({ index: true, follow: true });
    expect(robots().rules).toMatchObject({ allow: "/" });
  });

  it("keeps search engines away from the pre-production site (#634)", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_NOINDEX", "1");

    expect(robotsMeta()).toEqual({ index: false, follow: false });
    expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });
});
