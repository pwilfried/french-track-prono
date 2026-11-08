import { describe, expect, it } from "vitest";

import type { AdminLogRepository } from "@/application/list-admin-actions";

/**
 * Two events of their own; `act` makes the admin enter the start list of one of them (a real
 * back-office action, which the log must record).
 */
export type AdminLogWorld = {
  adminId: string;
  adminPseudo: string;
  eventIds: [string, string];
  act: (eventId: string) => Promise<void>;
  admin: AdminLogRepository;
  player: AdminLogRepository;
};

/** Contract of the AdminLogRepository port, run against the in-memory fake AND Supabase. */
export function adminLogRepositoryContract(name: string, world: () => Promise<AdminLogWorld>) {
  describe(`AdminLogRepository contract: ${name}`, () => {
    it("shows an admin who did what on which event, newest first", async () => {
      const w = await world();
      await w.act(w.eventIds[0]);
      await w.act(w.eventIds[1]);

      const lines = await w.admin.list({ adminId: w.adminId }, 50);

      expect(lines.map((l) => l.event?.id)).toEqual([w.eventIds[1], w.eventIds[0]]);
      expect(lines[0]).toMatchObject({
        kind: "set_start_list",
        admin: { id: w.adminId, pseudo: w.adminPseudo },
        size: 4,
      });
    });

    it("filters by event and by date", async () => {
      const w = await world();
      await w.act(w.eventIds[0]);
      await w.act(w.eventIds[1]);

      const one = await w.admin.list({ adminId: w.adminId, eventId: w.eventIds[0] }, 50);
      const future = await w.admin.list({ adminId: w.adminId, since: "2999-01-01" }, 50);

      expect(one.map((l) => l.event?.id)).toEqual([w.eventIds[0]]);
      expect(future).toEqual([]);
    });

    it("shows nothing to a player who is not admin", async () => {
      const w = await world();
      await w.act(w.eventIds[0]);

      expect(await w.player.list({ adminId: w.adminId }, 50)).toEqual([]);
    });
  });
}
