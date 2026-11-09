import { describe, expect, it } from "vitest";

import type { EmailChangeService } from "@/application/change-email";

export type EmailChangeWorld = {
  emails: EmailChangeService;
  /** The code sent to an address. */
  latestCode(email: string): Promise<string>;
  /** The address the player now signs in with. */
  currentEmail(): Promise<string>;
  /** An address another player already uses. */
  takenEmail: string;
};

const newAddress = () => `moved-${crypto.randomUUID()}@example.test`;

/** Contract of the EmailChangeService port (#341), run against the fake AND Supabase. */
export function emailChangeContract(name: string, world: () => Promise<EmailChangeWorld>) {
  describe(`EmailChangeService contract: ${name}`, () => {
    it("moves the player to the new address once the code is typed", async () => {
      const w = await world();
      const email = newAddress();
      const before = await w.currentEmail();

      expect(await w.emails.request(email)).toBe("sent");
      expect(await w.currentEmail()).toBe(before);

      expect(await w.emails.confirm(email, await w.latestCode(email))).toBe(true);
      expect(await w.currentEmail()).toBe(email);
    });

    it("refuses a wrong code", async () => {
      const w = await world();
      const email = newAddress();
      await w.emails.request(email);
      const right = await w.latestCode(email);

      expect(await w.emails.confirm(email, right === "000000" ? "111111" : "000000")).toBe(false);
    });

    it("refuses an address another player uses", async () => {
      const w = await world();
      expect(await w.emails.request(w.takenEmail)).toBe("taken");
    });
  });
}
