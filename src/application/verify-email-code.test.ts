import { describe, expect, it } from "vitest";

import { UseCaseError } from "./errors";
import type { AuthService } from "./request-magic-link";
import { verifyEmailCode } from "./verify-email-code";

const authAccepting = (email: string, code: string): AuthService => ({
  sendEmailCode: async () => {},
  verifyEmailCode: async (e, c) => (e === email && c === code ? { userId: "user-1" } : null),
});

describe("verifyEmailCode", () => {
  it("returns the session of the player when the code is right", async () => {
    const auth = authAccepting("anna@example.test", "123456");

    const session = await verifyEmailCode({ auth }).execute({
      email: "Anna@example.test",
      code: "123 456",
    });

    expect(session).toEqual({ userId: "user-1" });
  });

  it("fails with CODE_INVALID when the service refuses the code", async () => {
    const auth = authAccepting("anna@example.test", "123456");

    const promise = verifyEmailCode({ auth }).execute({
      email: "anna@example.test",
      code: "654321",
    });

    await expect(promise).rejects.toEqual(new UseCaseError("CODE_INVALID"));
  });

  it("fails with CODE_INVALID without asking the service when the code has the wrong shape", async () => {
    let asked = false;
    const auth: AuthService = {
      sendEmailCode: async () => {},
      verifyEmailCode: async () => {
        asked = true;
        return null;
      },
    };

    const promise = verifyEmailCode({ auth }).execute({ email: "anna@example.test", code: "12ab" });

    await expect(promise).rejects.toEqual(new UseCaseError("CODE_INVALID"));
    expect(asked).toBe(false);
  });

  it("fails with EMAIL_INVALID for a bad address", async () => {
    const auth = authAccepting("anna@example.test", "123456");

    const promise = verifyEmailCode({ auth }).execute({ email: "nope", code: "123456" });

    await expect(promise).rejects.toEqual(new UseCaseError("EMAIL_INVALID"));
  });
});
