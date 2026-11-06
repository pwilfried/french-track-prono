import { describe, expect, it } from "vitest";

import type { AuthService } from "@/application/request-magic-link";

/**
 * Contract of the AuthService port, run against the in-memory fake AND the real Supabase adapter.
 * `latestCode(email)` gives the code that was sent to an address: the fake keeps it, the Supabase
 * test reads it from the local test mailbox.
 */
export function authServiceContract(
  name: string,
  create: () => { auth: AuthService; latestCode(email: string): Promise<string> },
) {
  const newAddress = () => `player-${crypto.randomUUID()}@example.test`;

  describe(`AuthService contract: ${name}`, () => {
    it("sends a 6-digit code to the address", async () => {
      const { auth, latestCode } = create();
      const email = newAddress();

      await auth.sendEmailCode(email);

      expect(await latestCode(email)).toMatch(/^\d{6}$/);
    });

    it("signs in with the code that was sent", async () => {
      const { auth, latestCode } = create();
      const email = newAddress();
      await auth.sendEmailCode(email);

      const session = await auth.verifyEmailCode(email, await latestCode(email));

      expect(session?.userId).toBeTruthy();
    });

    it("refuses a wrong code", async () => {
      const { auth, latestCode } = create();
      const email = newAddress();
      await auth.sendEmailCode(email);
      const right = await latestCode(email);
      const wrong = right === "000000" ? "111111" : "000000";

      expect(await auth.verifyEmailCode(email, wrong)).toBeNull();
    });

    it("refuses a code that was already used", async () => {
      const { auth, latestCode } = create();
      const email = newAddress();
      await auth.sendEmailCode(email);
      const code = await latestCode(email);
      await auth.verifyEmailCode(email, code);

      expect(await auth.verifyEmailCode(email, code)).toBeNull();
    });

    it("gives the same player back when the same address signs in again", async () => {
      const first = create();
      const email = newAddress();
      await first.auth.sendEmailCode(email);
      const one = await first.auth.verifyEmailCode(email, await first.latestCode(email));

      // The auth service asks for one second between two messages to the same address.
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const second = create();
      await second.auth.sendEmailCode(email);
      const two = await second.auth.verifyEmailCode(email, await second.latestCode(email));

      expect(two?.userId).toBe(one?.userId);
    });
  });
}
