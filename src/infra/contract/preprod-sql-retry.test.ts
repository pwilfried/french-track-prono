import { describe, expect, it } from "vitest";

import { isTransientPreprodError } from "./database";

describe("isTransientPreprodError", () => {
  it.each([502, 503, 504, 544])("retries a gateway error %i (#871, #1051)", (status) => {
    expect(isTransientPreprodError(status, "")).toBe(true);
  });

  it.each([
    [500, '{"message":"Failed to check user auth status"}'],
    [401, '{"message":"Invalid access token"}'],
  ])("retries a passing failure of the token check (%i, #888)", (status, body) => {
    expect(isTransientPreprodError(status, body)).toBe(true);
  });

  it("retries an isolated 403 of a valid token (#1051)", () => {
    expect(isTransientPreprodError(403, '{"message":"Forbidden"}')).toBe(true);
  });

  it.each([
    [400, '{"message":"Failed to run sql query: ERROR:  syntax error"}'],
    [500, '{"message":"Failed to run sql query"}'],
    [200, "[]"],
  ])("does not retry any other answer (%i)", (status, body) => {
    expect(isTransientPreprodError(status, body)).toBe(false);
  });
});
