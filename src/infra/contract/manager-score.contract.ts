import { describe, expect, it } from "vitest";

import type { ManagerScoreLine, ManagerScoreRepository } from "@/application/manager-scores";
import { managerCompetitionScore, type ManagerCompetitionScore } from "@/domain/manager-score";

/**
 * A started competition of its own, a Manager league (mercato closed) where `player` lined up the
 * first two athletes on the 100 m, the third one on the bench, designated for the second one; a
 * performance entered for the first one (10.90, 1st, PB) and the third one (11.20), none for the
 * second one.
 */
export type ManagerScoreWorld = {
  competitionSlug: string;
  competitionId: string;
  leagueId: string;
  playerId: string;
  athleteIds: string[];
  /** Name of each athlete id. */
  names: Record<string, string>;
  admin: ManagerScoreRepository;
  player: ManagerScoreRepository;
  /** A player who is in no Manager league. */
  outsider: ManagerScoreRepository;
};

/** A stored score of the player, worth `total`. */
const line = (w: ManagerScoreWorld, total: number): ManagerScoreLine => ({
  leagueId: w.leagueId,
  userId: w.playerId,
  ...score(w, total),
});

const score = (w: ManagerScoreWorld, total: number): ManagerCompetitionScore => ({
  linedUp: true,
  total,
  hungarian: total - 50,
  bonus: 50,
  athletes: [
    {
      athleteId: w.athleteIds[0]!,
      discipline: "100 m",
      mark: "10.90",
      status: "ok",
      tablePoints: (total - 50) * 10 + 4,
      points: total - 50,
      bonuses: [{ bonus: "first", points: 50 }],
      bonusPoints: 50,
      total,
    },
    {
      athleteId: w.athleteIds[2]!,
      discipline: "100 m",
      mark: "11.20",
      status: "ok",
      points: 0,
      bonuses: [],
      bonusPoints: 0,
      total: 0,
      substitution: {
        starterId: w.athleteIds[1]!,
        reason: "forfeit",
        starter: { mark: null, status: null, total: 0, threshold: null },
      },
    },
  ],
});

/** Contract of the ManagerScoreRepository port, run against the in-memory fake AND Supabase. */
export function managerScoreContract(name: string, world: () => Promise<ManagerScoreWorld>) {
  describe(`ManagerScoreRepository contract: ${name}`, () => {
    it("gives the admin the sheet of the competition: lineups, divisor, performances", async () => {
      const w = await world();

      const sheet = await w.admin.sheet(w.competitionSlug);

      expect(sheet).toMatchObject({
        competitionId: w.competitionId,
        indoor: false,
        participants: [
          {
            leagueId: w.leagueId,
            userId: w.playerId,
            tablesDivisor: 10,
            lineup: {
              starters: [
                {
                  athleteId: w.athleteIds[0],
                  family: "sprint",
                  discipline: "100 m",
                  substituteId: null,
                  threshold: null,
                },
                {
                  athleteId: w.athleteIds[1],
                  family: "sprint",
                  discipline: "100 m",
                  substituteId: w.athleteIds[2],
                  threshold: 10.5,
                },
              ],
              bench: [{ athleteId: w.athleteIds[2], family: "sprint", discipline: "100 m" }],
            },
          },
        ],
        performances: [
          {
            athleteId: w.athleteIds[0],
            discipline: "100 m",
            sex: "F",
            unit: "time",
            round: "final",
            status: "ok",
            place: 1,
            mark: "10.90",
            records: ["pb"],
          },
          { athleteId: w.athleteIds[2], status: "ok", mark: "11.20", records: [] },
        ],
      });
      if (sheet && sheet !== "not_admin") {
        expect(sheet.participants[0]!.bonuses.first).toBeGreaterThanOrEqual(0);
        expect(Date.parse(sheet.lockAt)).toBeLessThan(Date.now());
      }
    });

    it("gives the core what it needs to bring the substitute in for a starter without a mark", async () => {
      const w = await world();
      const sheet = await w.admin.sheet(w.competitionSlug);
      if (!sheet || sheet === "not_admin") throw new Error("no sheet");
      const p = sheet.participants[0]!;

      const score = managerCompetitionScore({
        ...p,
        indoor: sheet.indoor,
        performances: sheet.performances,
      });

      expect(score.athletes.map((a) => [a.athleteId, a.substitution ?? null])).toEqual([
        [w.athleteIds[0], null],
        [
          w.athleteIds[2],
          expect.objectContaining({ starterId: w.athleteIds[1], reason: "forfeit" }),
        ],
      ]);
    });

    it("knows no sheet of an unknown competition", async () => {
      const w = await world();
      expect(await w.admin.sheet(`unknown-${crypto.randomUUID()}`)).toBeNull();
    });

    it("refuses the sheet and the scores to a player who is not admin", async () => {
      const w = await world();
      expect(await w.player.sheet(w.competitionSlug)).toBe("not_admin");
      expect(await w.player.replace(w.competitionId, [line(w, 900)])).toBe("not_admin");
      expect(await w.player.mine(w.leagueId, w.competitionId)).toBeNull();
    });

    it("lets the participant read the score the admin stored, with the athletes' names", async () => {
      const w = await world();
      expect(await w.player.mine(w.leagueId, w.competitionId)).toBeNull();

      expect(await w.admin.replace(w.competitionId, [line(w, 900)])).toBe("saved");

      const stored = score(w, 900);
      expect(await w.player.mine(w.leagueId, w.competitionId)).toEqual({
        ...stored,
        athletes: stored.athletes.map((a) => ({ ...a, name: w.names[a.athleteId] })),
        jokers: 0,
        jokerEffects: [],
      });
    });

    it("keeps what the jokers changed, with the name of their target (#1091)", async () => {
      const w = await world();
      const captain = w.athleteIds[0]!;
      const played: ManagerScoreLine = {
        ...line(w, 900),
        total: 1800,
        jokers: 900,
        jokerEffects: [{ kind: "captain", by: "me", athleteId: captain, points: 900 }],
      };

      expect(await w.admin.replace(w.competitionId, [played])).toBe("saved");

      expect(await w.player.mine(w.leagueId, w.competitionId)).toMatchObject({
        total: 1800,
        hungarian: 850,
        bonus: 50,
        jokers: 900,
        jokerEffects: [
          { kind: "captain", by: "me", athleteId: captain, points: 900, name: w.names[captain] },
        ],
      });
    });

    it("replaces the scores of the competition when computed again", async () => {
      const w = await world();
      await w.admin.replace(w.competitionId, [line(w, 900)]);

      await w.admin.replace(w.competitionId, [line(w, 700)]);

      expect((await w.player.mine(w.leagueId, w.competitionId)) as { total: number }).toMatchObject(
        { total: 700 },
      );
    });

    it("does not show the scores of a league to a player outside it", async () => {
      const w = await world();
      await w.admin.replace(w.competitionId, [line(w, 900)]);

      expect(await w.outsider.mine(w.leagueId, w.competitionId)).toBe("not_member");
    });
  });
}
