import { describe, expect, it } from "vitest";

import { isTransientPreprodError } from "./database";

describe("isTransientPreprodError", () => {
  it.each([502, 503, 504])("retries a gateway error %i", (status) => {
    expect(isTransientPreprodError(status, "")).toBe(true);
  });

  it.each([
    [500, '{"message":"Failed to check user auth status"}'],
    [401, '{"message":"Invalid access token"}'],
  ])("retries a passing failure of the token check (%i, #888)", (status, body) => {
    expect(isTransientPreprodError(status, body)).toBe(true);
  });

  it.each([
    [400, '{"message":"Failed to run sql query: ERROR:  syntax error"}'],
    [500, '{"message":"Failed to run sql query"}'],
    [403, '{"message":"Forbidden"}'],
    [200, "[]"],
  ])("does not retry any other answer (%i)", (status, body) => {
    expect(isTransientPreprodError(status, body)).toBe(false);
  });
});
