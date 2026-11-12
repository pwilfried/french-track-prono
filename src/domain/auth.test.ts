import { describe, expect, it } from "vitest";

import { codeFromClipboard, validateCode, validateEmail } from "./auth";

describe("codeFromClipboard", () => {
  it("keeps a plain six-digit code", () => {
    expect(codeFromClipboard("123456")).toBe("123456");
  });

  it("finds the digits in a copied sentence, across spaces and hyphens", () => {
    expect(codeFromClipboard("Ton code : 123 456. Il expire dans une heure.")).toBe("123456");
    expect(codeFromClipboard("123-456")).toBe("123456");
  });

  it("keeps only the first six digits found", () => {
    expect(codeFromClipboard("12345678")).toBe("123456");
  });

  it.each(["", "pas de code", "12345", "anna@example.test"])("finds no code in %j", (text) => {
    expect(codeFromClipboard(text)).toBeNull();
  });
});

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

  it("accepts the longer codes a Supabase project can be set to (up to 10 digits)", () => {
    expect(validateCode("12345678")).toEqual({ ok: true, code: "12345678" });
    expect(validateCode("1234 5678 90")).toEqual({ ok: true, code: "1234567890" });
  });

  it.each(["", "12345", "12345678901", "12345a", "abcdef"])("rejects %j", (input) => {
    expect(validateCode(input)).toEqual({ ok: false, code: "CODE_INVALID" });
  });
});
