import type { ManagerBidRepository, WonAthlete } from "@/application/manager-bids";
import { bidProblem, type ManagerBid } from "@/domain/manager-bid";
import { awardBids, roundEndsAt, type RoundRules } from "@/domain/manager-round";

const ROUNDS: RoundRules = { firstHours: 48, longRounds: 2, nextHours: 24 };

/**
 * Test double of the ManagerBidRepository port: one store of bids, a session per player, who sees
 * their own bids only. `prices` is the catalogue (athlete → reference price); `members` the
 * participants by league. `closeRound` does what the scheduled job does in the database (#423).
 */
export function createInMemoryManagerBidStore(input: {
  budget: number;
  prices: Record<string, number>;
  members: Record<string, string[]>;
}) {
  const bids = new Map<string, ManagerBid[]>();
  /** League → athlete → its owner and what it cost. */
  const awards = new Map<string, Map<string, WonAthlete & { userId: string }>>();
  /** League → when its mercato opened and how many rounds are closed. */
  const mercato = new Map<string, { openedAt: string; closed: number }>();
  // A clock that always moves on, like clock_timestamp() in the database.
  let tick = Date.parse("2027-01-01T00:00:00.000Z");
  const key = (leagueId: string, userId: string) => `${leagueId}/${userId}`;
  const wonBy = (leagueId: string, userId: string) =>
    [...(awards.get(leagueId)?.values() ?? [])]
      .filter((a) => a.userId === userId)
      .map(({ athleteId, amount, round }) => ({ athleteId, amount, round }));
  return {
    openMercato(leagueId: string) {
      mercato.set(leagueId, { openedAt: new Date(tick).toISOString(), closed: 0 });
      awards.set(leagueId, new Map());
    },
    /** Closes the open round of a league: the highest bid wins, the other bids are freed. */
    closeRound(leagueId: string) {
      const state = mercato.get(leagueId);
      const won = awards.get(leagueId);
      if (!state || !won) throw new Error("the mercato of the league is not open");
      state.closed += 1;
      const all = (input.members[leagueId] ?? []).flatMap((userId) =>
        (bids.get(key(leagueId, userId)) ?? []).map((b) => ({ ...b, userId })),
      );
      for (const award of awardBids(all)) {
        won.set(award.athleteId, { ...award, round: state.closed });
      }
      for (const userId of input.members[leagueId] ?? []) bids.delete(key(leagueId, userId));
    },
    session(userId: string): ManagerBidRepository {
      const member = (leagueId: string) => input.members[leagueId]?.includes(userId) ?? false;
      return {
        async mine(leagueId) {
          if (!member(leagueId)) return "not_member";
          const state = mercato.get(leagueId);
          return {
            budget: input.budget,
            mercatoOpen: state !== undefined,
            roundEndsAt: state ? roundEndsAt(state.openedAt, ROUNDS, state.closed + 1) : null,
            team: wonBy(leagueId, userId),
            bids: structuredClone(bids.get(key(leagueId, userId)) ?? []),
          };
        },
        async place(leagueId, athleteId, amount) {
          if (!member(leagueId)) return "not_member";
          if (!mercato.has(leagueId)) return "mercato_closed";
          const price = input.prices[athleteId];
          if (price === undefined) return "not_in_catalogue";
          if (awards.get(leagueId)?.has(athleteId)) return "taken";
          const mine = bids.get(key(leagueId, userId)) ?? [];
          const spent = wonBy(leagueId, userId).reduce((sum, a) => sum + a.amount, 0);
          const problem = bidProblem({
            athleteId,
            amount,
            price,
            budget: input.budget - spent,
            bids: mine,
          });
          if (problem === "invalid") throw new Error("the use case checks the amount");
          if (problem) return problem;
          tick += 1;
          bids.set(key(leagueId, userId), [
            ...mine.filter((b) => b.athleteId !== athleteId),
            { athleteId, amount, bidAt: new Date(tick).toISOString() },
          ]);
          return "placed";
        },
        async withdraw(leagueId, athleteId) {
          if (!member(leagueId)) return "not_member";
          if (!mercato.has(leagueId)) return "mercato_closed";
          const mine = bids.get(key(leagueId, userId)) ?? [];
          bids.set(
            key(leagueId, userId),
            mine.filter((b) => b.athleteId !== athleteId),
          );
          return "withdrawn";
        },
      };
    },
  };
}
