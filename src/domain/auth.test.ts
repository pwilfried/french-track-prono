import { describe, expect, it } from "vitest";

import { validateCode, validateEmail } from "./auth";

describe("validateEmail", () => {
  it("accepts an address and lowercases it", () => {
    expect(validateEmail("Anna@Example.TEST")).toEqual({ ok: true, email: "anna@example.test" });
  });

  it("trims spaces around the address", () => {
    expect(validateEmail("  anna@example.test ")).toEqual({ ok: true, email: "anna@example.test" });
  });

  it.each([
    "",
    "anna",
    "anna@",
    "@example.test",
    "anna@example",
    "an na@example.test",
    "a@b@c.test",
  ])("rejects %j", (input) => {
    expect(validateEmail(input)).toEqual({ ok: false, code: "EMAIL_INVALID" });
  });

  it("rejects an address longer than 254 characters", () => {
    expect(validateEmail(`${"a".repeat(250)}@example.test`)).toEqual({
      ok: false,
      code: "EMAIL_INVALID",
    });
  });
});

describe("validateCode", () => {
  it("accepts six digits", () => {
    expect(validateCode("123456")).toEqual({ ok: true, code: "123456" });
  });

  it("ignores spaces and hyphens typed or pasted around the digits", () => {
    expect(validateCode(" 123 456 ")).toEqual({ ok: true, code: "123456" });
    expect(validateCode("123-456")).toEqual({ ok: true, code: "123456" });
  });

  it.each(["", "12345", "1234567", "12345a", "abcdef"])("rejects %j", (input) => {
    expect(validateCode(input)).toEqual({ ok: false, code: "CODE_INVALID" });
  });
});
