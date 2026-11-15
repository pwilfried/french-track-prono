import { describe, expect, it } from "vitest";

import type { CommunityRepository } from "@/application/community";

/** `admin` acts as an admin; `voter` and `other` as two players. */
export type CommunityWorld = {
  admin: CommunityRepository;
  voter: CommunityRepository;
  other: CommunityRepository;
};

const tomorrow = () => new Date(Date.now() + 86400000).toISOString();

/** Contract of the CommunityRepository port, run against the in-memory fake AND Supabase. */
export function communityContract(name: string, world: () => Promise<CommunityWorld>) {
  describe(`CommunityRepository contract: ${name}`, () => {
    it("publishes an announcement a player reads, until the admin removes it", async () => {
      const w = await world();
      const title = `Épisode ${crypto.randomUUID().slice(0, 8)}`;
      const id = await w.admin.publishAnnouncement({
        kind: "episode",
        title,
        subtitle: "Les finales",
        link: "https://example.test/episode",
      });
      expect(id).not.toBe("not_admin");
      expect((await w.voter.announcements()).find((a) => a.id === id)).toMatchObject({
        kind: "episode",
        title,
        subtitle: "Les finales",
        link: "https://example.test/episode",
      });

      expect(await w.admin.removeAnnouncement(id as string)).toBe("removed");
      expect((await w.voter.announcements()).some((a) => a.id === id)).toBe(false);
    });

    it("takes one vote per player and shows the results only after it", async () => {
      const w = await world();
      const id = (await w.admin.createPoll({
        question: "Qui gagne ?",
        options: ["Alpha", "Bravo"],
        closesAt: tomorrow(),
      })) as string;
      const pollOf = async (repository: CommunityRepository) =>
        (await repository.polls()).find((p) => p.id === id);

      expect(await pollOf(w.voter)).toMatchObject({ myChoice: null, votes: null });
      expect(await w.voter.vote(id, 1)).toBe("voted");
      expect(await w.voter.vote(id, 0)).toBe("already_voted");
      expect(await w.other.vote(id, 5)).toBe("invalid");
      expect(await pollOf(w.voter)).toMatchObject({ myChoice: 1, votes: [0, 1] });
      expect(await pollOf(w.other)).toMatchObject({ myChoice: null, votes: null });

      expect(await w.admin.removePoll(id)).toBe("removed");
      expect(await pollOf(w.voter)).toBeUndefined();
      expect(await w.voter.vote(id, 0)).toBe("not_found");
    });

    it("refuses a player who is not an admin", async () => {
      const w = await world();
      expect(
        await w.voter.publishAnnouncement({
          kind: "schedule",
          title: "Programme",
          subtitle: null,
          link: null,
        }),
      ).toBe("not_admin");
      expect(
        await w.voter.createPoll({ question: "Qui ?", options: ["A", "B"], closesAt: tomorrow() }),
      ).toBe("not_admin");
    });
  });
}
