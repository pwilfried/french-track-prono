import { describe, expect, it } from "vitest";

import type { LeagueMomentRepository } from "@/application/league-moments";

/**
 * A league counting the competition `competitionSlug`, with its member `memberId`; an event of it
 * (`eventId`, a women's 100 m). `admin` acts as an admin, `member` as the member, `outsider` as a
 * player outside the league.
 */
export type LeagueMomentWorld = {
  admin: LeagueMomentRepository;
  member: LeagueMomentRepository;
  outsider: LeagueMomentRepository;
  leagueId: string;
  competitionSlug: string;
  competitionName: string;
  memberId: string;
  memberPseudo: string;
  eventId: string;
};

/** Contract of the LeagueMomentRepository port, run against the in-memory fake AND Supabase. */
export function leagueMomentContract(name: string, world: () => Promise<LeagueMomentWorld>) {
  describe(`LeagueMomentRepository contract: ${name}`, () => {
    const perfect = (w: LeagueMomentWorld) => ({
      key: `perfect_podium:${w.eventId}:${w.memberId}`,
      kind: "perfect_podium" as const,
      userId: w.memberId,
      eventId: w.eventId,
    });

    it("lists the leagues counting a competition to an admin, with their members", async () => {
      const w = await world();
      const leagues = await w.admin.leaguesOf(w.competitionSlug);
      expect(leagues).not.toBe("not_admin");
      const league = (leagues as Exclude<typeof leagues, "not_admin">).find(
        (l) => l.id === w.leagueId,
      );
      expect(league?.competitionSlugs).toContain(w.competitionSlug);
      expect(league?.members.map((m) => m.userId)).toContain(w.memberId);
    });

    it("publishes a fact once, and the member reads it in the feed", async () => {
      const w = await world();
      expect(await w.admin.publish(w.leagueId, [perfect(w)])).toBe(1);
      expect(await w.admin.publish(w.leagueId, [perfect(w)])).toBe(0);

      const feed = await w.member.feed(w.leagueId);
      expect(feed).toHaveLength(1);
      expect(feed[0]).toMatchObject({
        key: perfect(w).key,
        kind: "perfect_podium",
        pseudo: w.memberPseudo,
        competitionName: w.competitionName,
        event: { discipline: "100 m", gender: "F" },
      });
    });

    it("leaves out a player who is not a member", async () => {
      const w = await world();
      const stranger = {
        ...perfect(w),
        key: "perfect_podium:x:stranger",
        userId: crypto.randomUUID(),
      };
      expect(await w.admin.publish(w.leagueId, [stranger])).toBe(0);
    });

    it("refuses a player who is not an admin, and shows nothing outside the league", async () => {
      const w = await world();
      expect(await w.member.leaguesOf(w.competitionSlug)).toBe("not_admin");
      expect(await w.member.publish(w.leagueId, [perfect(w)])).toBe("not_admin");
      await w.admin.publish(w.leagueId, [perfect(w)]);
      expect(await w.outsider.feed(w.leagueId)).toEqual([]);
    });
  });
}
