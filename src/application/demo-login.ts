import { isDemoEmail } from "@/domain/demo-player";

import type { ProfileRepository } from "./create-profile";
import { UseCaseError } from "./errors";
import { requireAdmin } from "./require-admin";

/** An invented account with a profile. The e-mail never leaves the server (#341). */
export type DemoPlayer = { userId: string; pseudo: string; email: string };

/**
 * Port: the accounts a pre-production admin may sign in as (#637). Supabase (service role, server
 * only) in the app, memory in tests.
 */
export interface DemoAccounts {
  /** The accounts with a profile whose e-mail is on example.test, by pseudo. */
  listDemoPlayers(): Promise<DemoPlayer[]>;
  /** One account with a profile, or null. */
  find(userId: string): Promise<DemoPlayer | null>;
  /** A one-time token that opens a session for the account; null if it cannot be made. */
  signInToken(userId: string): Promise<string | null>;
}

type Ports = {
  /** True only in pre-production (a server-side variable): elsewhere the feature does not exist. */
  enabled: boolean;
  profiles: ProfileRepository;
  demo: DemoAccounts;
};

async function allowed(ports: Ports, userId: string): Promise<void> {
  if (!ports.enabled) throw new UseCaseError("DEMO_LOGIN_DISABLED");
  await requireAdmin(ports).execute({ userId });
}

/** An invented account that is not an admin: the only kind of account one may sign in as. */
async function isTarget(ports: Ports, player: DemoPlayer | null): Promise<boolean> {
  return !!player && isDemoEmail(player.email) && !(await ports.profiles.isAdmin(player.userId));
}

/** The demo players listed in the pre-production back-office, for an admin only. */
export function listDemoPlayers(ports: Ports) {
  return {
    async execute(input: { userId: string }): Promise<Omit<DemoPlayer, "email">[]> {
      await allowed(ports, input.userId);
      const players = await ports.demo.listDemoPlayers();
      const targets: Omit<DemoPlayer, "email">[] = [];
      for (const player of players) {
        if (await isTarget(ports, player)) {
          targets.push({ userId: player.userId, pseudo: player.pseudo });
        }
      }
      return targets;
    },
  };
}

/**
 * Gives a pre-production admin a one-time token to sign in as a demo player; the app turns it
 * into the session and keeps the admin's own session to come back to.
 */
export function signInAsDemoPlayer(ports: Ports) {
  return {
    async execute(input: {
      userId: string;
      targetId: string;
    }): Promise<{ token: string; pseudo: string }> {
      await allowed(ports, input.userId);
      const target = await ports.demo.find(input.targetId);
      if (!target || !(await isTarget(ports, target))) throw new UseCaseError("DEMO_PLAYER_ONLY");
      const token = await ports.demo.signInToken(target.userId);
      if (!token) throw new UseCaseError("AUTH_UNAVAILABLE");
      return { token, pseudo: target.pseudo };
    },
  };
}
