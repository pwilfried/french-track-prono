import { describe, expect, it } from "vitest";

import { confirmEmailChange, requestEmailChange, type EmailChangeService } from "./change-email";
import { UseCaseError } from "./errors";

// Application tests do not import the infra layer: a few lines of fake are enough here.
function fakeEmails() {
  let current = "anna@example.test";
  const sent = new Map<string, string>();
  const emails: EmailChangeService = {
    async request(email) {
      if (email === "bob@example.test") return "taken";
      sent.set(email, "123456");
      return "sent";
    },
    async confirm(email, code) {
      if (sent.get(email) !== code) return false;
      current = email;
      return true;
    },
  };
  return { emails, current: () => current };
}

describe("a player changes their sign-in address", () => {
  it("signs in with the new address once the code sent there is typed", async () => {
    // given a player signed in as anna@example.test
    const world = fakeEmails();
    // when they ask for Anna.New@example.test and type the code received there
    const email = await requestEmailChange(world).execute({
      newEmail: " Anna.New@Example.test ",
      currentEmail: "anna@example.test",
    });
    expect(world.current()).toBe("anna@example.test");
    await confirmEmailChange(world).execute({ newEmail: email, code: "123 456" });
    // then the new address is theirs
    expect(world.current()).toBe("anna.new@example.test");
  });

  it.each([
    ["anna", "EMAIL_INVALID"],
    ["ANNA@example.test", "EMAIL_UNCHANGED"],
    ["bob@example.test", "EMAIL_TAKEN"],
  ])("refuses %j with %s", async (newEmail, code) => {
    await expect(
      requestEmailChange(fakeEmails()).execute({ newEmail, currentEmail: "anna@example.test" }),
    ).rejects.toEqual(new UseCaseError(code as never));
  });

  it("refuses a wrong code", async () => {
    const world = fakeEmails();
    await requestEmailChange(world).execute({
      newEmail: "new@example.test",
      currentEmail: "anna@example.test",
    });
    await expect(
      confirmEmailChange(world).execute({ newEmail: "new@example.test", code: "654321" }),
    ).rejects.toEqual(new UseCaseError("CODE_INVALID"));
    expect(world.current()).toBe("anna@example.test");
  });
});
