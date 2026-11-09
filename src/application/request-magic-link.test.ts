import { describe, expect, it } from "vitest";

import { UseCaseError } from "./errors";
import { requestMagicLink, type AuthService } from "./request-magic-link";

const authSpy = () => {
  const sent: { email: string; redirectTo: string | undefined; captchaToken?: string }[] = [];
  const auth: AuthService = {
    sendEmailCode: async (email, redirectTo, captchaToken) => {
      sent.push(captchaToken ? { email, redirectTo, captchaToken } : { email, redirectTo });
    },
    verifyEmailCode: async () => null,
  };
  return { auth, sent };
};

describe("requestMagicLink", () => {
  it("passes the captcha token when the sign-in page shows the captcha", async () => {
    const { auth, sent } = authSpy();

    await requestMagicLink({ auth }).execute({ email: "anna@example.test", captchaToken: "tok" });
    await requestMagicLink({ auth }).execute({ email: "bob@example.test", captchaToken: "" });

    expect(sent).toEqual([
      { email: "anna@example.test", redirectTo: undefined, captchaToken: "tok" },
      { email: "bob@example.test", redirectTo: undefined },
    ]);
  });

  it("sends the link and code to the cleaned address", async () => {
    const { auth, sent } = authSpy();

    await requestMagicLink({ auth }).execute({ email: "  Anna@Example.TEST " });

    expect(sent).toEqual([{ email: "anna@example.test", redirectTo: undefined }]);
  });

  it("passes the redirect address to the service", async () => {
    const { auth, sent } = authSpy();

    await requestMagicLink({ auth }).execute({
      email: "anna@example.test",
      redirectTo: "http://localhost:3000/auth/callback",
    });

    expect(sent[0]?.redirectTo).toBe("http://localhost:3000/auth/callback");
  });

  it("fails with EMAIL_INVALID and sends nothing for a bad address", async () => {
    const { auth, sent } = authSpy();

    const promise = requestMagicLink({ auth }).execute({ email: "not an address" });

    await expect(promise).rejects.toEqual(new UseCaseError("EMAIL_INVALID"));
    expect(sent).toEqual([]);
  });

  it("lets AUTH_UNAVAILABLE through when the service is down", async () => {
    const auth: AuthService = {
      sendEmailCode: async () => {
        throw new UseCaseError("AUTH_UNAVAILABLE");
      },
      verifyEmailCode: async () => null,
    };

    const promise = requestMagicLink({ auth }).execute({ email: "anna@example.test" });

    await expect(promise).rejects.toEqual(new UseCaseError("AUTH_UNAVAILABLE"));
  });
});
