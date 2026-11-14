import type { DemoAccounts, DemoPlayer } from "@/application/demo-login";
import { isDemoEmail } from "@/domain/demo-player";

/** Test double of the DemoAccounts port; `add` creates an account, `openSession` spends a token. */
export function createInMemoryDemoAccounts(): DemoAccounts & {
  add(player: DemoPlayer): void;
  openSession(token: string): string | null;
} {
  const accounts = new Map<string, DemoPlayer>();
  const tokens = new Map<string, string>(); // token -> account id, until spent
  return {
    add(player) {
      accounts.set(player.userId, { ...player });
    },
    async listDemoPlayers() {
      return [...accounts.values()]
        .filter((p) => isDemoEmail(p.email))
        .sort((a, b) => a.pseudo.localeCompare(b.pseudo, "fr"))
        .map((p) => ({ ...p }));
    },
    async find(userId) {
      const player = accounts.get(userId);
      return player ? { ...player } : null;
    },
    async signInToken(userId) {
      if (!accounts.has(userId)) return null;
      const token = crypto.randomUUID();
      tokens.set(token, userId);
      return token;
    },
    openSession(token) {
      const userId = tokens.get(token) ?? null;
      tokens.delete(token);
      return userId;
    },
  };
}
