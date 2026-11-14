import { describe, expect, it } from "vitest";

import type { DemoAccounts } from "@/application/demo-login";

/**
 * Contract of the DemoAccounts port (#637), run against the in-memory fake AND the Supabase
 * adapter. `addAccount` creates an account with a profile; `openSession` spends a sign-in token
 * and gives the id of the account it opened, or null.
 */
export function demoAccountsContract(
  name: string,
  create: () => {
    demo: DemoAccounts;
    addAccount(email: string, pseudo: string): Promise<string>;
    openSession(token: string): Promise<string | null>;
  },
) {
  const tag = () => crypto.randomUUID().slice(0, 8);

  describe(`DemoAccounts contract: ${name}`, () => {
    it("lists an invented account with its pseudo, and not an account on another domain", async () => {
      const { demo, addAccount } = create();
      const t = tag();
      const demoId = await addAccount(`demo-${t}@example.test`, `Démo ${t}`);
      const otherId = await addAccount(`other-${t}@example.org`, `Autre ${t}`);

      const players = await demo.listDemoPlayers();

      expect(players).toContainEqual({
        userId: demoId,
        pseudo: `Démo ${t}`,
        email: `demo-${t}@example.test`,
      });
      expect(players.map((p) => p.userId)).not.toContain(otherId);
    });

    it("finds an account by id, and nothing for an unknown id", async () => {
      const { demo, addAccount } = create();
      const t = tag();
      const id = await addAccount(`other-${t}@example.org`, `Autre ${t}`);

      expect(await demo.find(id)).toEqual({
        userId: id,
        pseudo: `Autre ${t}`,
        email: `other-${t}@example.org`,
      });
      expect(await demo.find(crypto.randomUUID())).toBeNull();
    });

    it("gives a sign-in token that opens the account's session once", async () => {
      const { demo, addAccount, openSession } = create();
      const t = tag();
      const id = await addAccount(`demo-${t}@example.test`, `Démo ${t}`);

      const token = await demo.signInToken(id);

      expect(token).toBeTruthy();
      expect(await openSession(token!)).toBe(id);
      expect(await openSession(token!)).toBeNull();
    });

    it("gives no token for an unknown account", async () => {
      const { demo } = create();

      expect(await demo.signInToken(crypto.randomUUID())).toBeNull();
    });
  });
}
