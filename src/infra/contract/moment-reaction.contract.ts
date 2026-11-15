import { describe, expect, it } from "vitest";

import type { MomentReactionRepository } from "@/application/moment-reactions";

/**
 * A league `leagueId` (named `leagueName`) with two members, and one perfect podium moment
 * (`momentKey`). `admin` acts as an admin, `member` and `friend` as the members, `outsider` as a
 * player outside the league. `friendPseudo` names the friend.
 */
export type MomentReactionWorld = {
  admin: MomentReactionRepository;
  member: MomentReactionRepository;
  friend: MomentReactionRepository;
  outsider: MomentReactionRepository;
  leagueId: string;
  leagueName: string;
  momentKey: string;
  friendPseudo: string;
};

/** Contract of the MomentReactionRepository port, run against the in-memory fake AND Supabase. */
export function momentReactionContract(name: string, world: () => Promise<MomentReactionWorld>) {
  describe(`MomentReactionRepository contract: ${name}`, () => {
    it("adds an emoji once per sort and player, then removes it", async () => {
      const w = await world();
      expect(await w.friend.addEmoji(w.leagueId, w.momentKey, "fire")).toBe("done");
      expect(await w.friend.addEmoji(w.leagueId, w.momentKey, "fire")).toBe("done");
      expect(await w.friend.addEmoji(w.leagueId, w.momentKey, "clap")).toBe("done");
      const listed = await w.member.list(w.leagueId);
      expect(listed.map((r) => [r.kind, r.code, r.mine]).sort()).toEqual([
        ["emoji", "clap", false],
        ["emoji", "fire", false],
      ]);
      expect(listed[0]).toMatchObject({ momentKey: w.momentKey, pseudo: w.friendPseudo });

      expect(await w.friend.removeEmoji(w.leagueId, w.momentKey, "fire")).toBe("done");
      expect((await w.friend.list(w.leagueId)).map((r) => [r.code, r.mine])).toEqual([
        ["clap", true],
      ]);
    });

    it("keeps one preset message per player and moment: the second replaces the first", async () => {
      const w = await world();
      await w.friend.sendMessage(w.leagueId, w.momentKey, "well_played");
      await w.friend.sendMessage(w.leagueId, w.momentKey, "rematch");
      const listed = await w.member.list(w.leagueId);
      expect(listed.map((r) => [r.kind, r.code])).toEqual([["message", "rematch"]]);
    });

    it("refuses a player outside the league, and shows them nothing", async () => {
      const w = await world();
      await w.friend.addEmoji(w.leagueId, w.momentKey, "wow");
      expect(await w.outsider.addEmoji(w.leagueId, w.momentKey, "fire")).toBe("refused");
      expect(await w.outsider.sendMessage(w.leagueId, w.momentKey, "bad_luck")).toBe("refused");
      expect(await w.outsider.list(w.leagueId)).toEqual([]);
    });

    it("refuses a moment that does not exist", async () => {
      const w = await world();
      expect(await w.friend.addEmoji(w.leagueId, "streak:nobody:5:x", "fire")).toBe("refused");
    });

    it("takes one report per player and item; the admin hides it for everyone", async () => {
      const w = await world();
      await w.friend.sendMessage(w.leagueId, w.momentKey, "catching_up");
      const [message] = await w.member.list(w.leagueId);
      expect(await w.member.report(message.id)).toBe("done");
      expect(await w.member.report(message.id)).toBe("done");
      expect((await w.member.list(w.leagueId))[0].reported).toBe(true);

      const reports = await w.admin.reports();
      expect(reports).not.toBe("not_admin");
      const report = (reports as Exclude<typeof reports, "not_admin">).find(
        (r) => r.id === message.id,
      );
      expect(report).toMatchObject({
        kind: "message",
        code: "catching_up",
        pseudo: w.friendPseudo,
        leagueId: w.leagueId,
        leagueName: w.leagueName,
        momentKind: "perfect_podium",
        reports: 1,
      });

      expect(await w.member.hide(message.id)).toBe("not_admin");
      expect(await w.admin.hide(message.id)).toBe("done");
      expect(await w.member.list(w.leagueId)).toEqual([]);
      expect(await w.friend.list(w.leagueId)).toEqual([]);
      const after = await w.admin.reports();
      expect((after as Exclude<typeof after, "not_admin">).some((r) => r.id === message.id)).toBe(
        false,
      );
      expect(await w.member.report(message.id)).toBe("unknown");
    });

    it("dismisses the reports of an item: it stays in the feed", async () => {
      const w = await world();
      await w.friend.sendMessage(w.leagueId, w.momentKey, "what_flair");
      const [message] = await w.member.list(w.leagueId);
      await w.member.report(message.id);
      expect(await w.member.dismiss(message.id)).toBe("not_admin");
      expect(await w.admin.dismiss(message.id)).toBe("done");
      const after = await w.admin.reports();
      expect((after as Exclude<typeof after, "not_admin">).some((r) => r.id === message.id)).toBe(
        false,
      );
      expect(await w.member.list(w.leagueId)).toHaveLength(1);
    });

    it("keeps the reports for the admin only", async () => {
      const w = await world();
      expect(await w.member.reports()).toBe("not_admin");
    });
  });
}
