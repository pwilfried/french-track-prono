import { describe, expect, it } from "vitest";

import type { ClubNoticeRepository } from "@/application/club-notices";

export type ClubNoticeWorld = {
  player: ClubNoticeRepository;
  other: ClubNoticeRepository;
  /** The admin validates the club the player typed, then renames it. */
  validateThenRename(name: string, newName: string): Promise<void>;
};

/** Contract of the ClubNoticeRepository port (#372), run against the fake AND Supabase. */
export function clubNoticeContract(name: string, world: () => Promise<ClubNoticeWorld>) {
  describe(`ClubNoticeRepository contract: ${name}`, () => {
    it("tells the player once, and only them", async () => {
      const w = await world();
      const club = `Foulées ${crypto.randomUUID().slice(0, 6)}`;
      await w.validateThenRename(club, `${club} renommé`);

      const notices = await w.player.listUnseen();
      expect(notices.map((n) => n.kind).sort()).toEqual(["renamed", "validated"]);
      expect(notices.find((n) => n.kind === "renamed")).toMatchObject({
        clubName: club,
        newName: `${club} renommé`,
      });
      expect(await w.other.listUnseen()).toEqual([]);

      for (const notice of notices) await w.player.dismiss(notice.id);
      expect(await w.player.listUnseen()).toEqual([]);
    });
  });
}
