import type { ManagerBidRepository } from "@/application/manager-bids";
import { bidProblem, type ManagerBid } from "@/domain/manager-bid";

/**
 * Test double of the ManagerBidRepository port: one store of bids, a session per player, who sees
 * their own bids only. `prices` is the catalogue (athlete → reference price); `members` the
 * participants by league.
 */
export function createInMemoryManagerBidStore(input: {
  budget: number;
  prices: Record<string, number>;
  members: Record<string, string[]>;
}) {
  const bids = new Map<string, ManagerBid[]>();
  const open = new Set<string>();
  // A clock that always moves on, like clock_timestamp() in the database.
  let tick = Date.parse("2027-01-01T00:00:00.000Z");
  return {
    openMercato(leagueId: string) {
      open.add(leagueId);
    },
    session(userId: string): ManagerBidRepository {
      const key = (leagueId: string) => `${leagueId}/${userId}`;
      const member = (leagueId: string) => input.members[leagueId]?.includes(userId) ?? false;
      return {
        async mine(leagueId) {
          if (!member(leagueId)) return "not_member";
          return {
            budget: input.budget,
            mercatoOpen: open.has(leagueId),
            bids: structuredClone(bids.get(key(leagueId)) ?? []),
          };
        },
        async place(leagueId, athleteId, amount) {
          if (!member(leagueId)) return "not_member";
          if (!open.has(leagueId)) return "mercato_closed";
          const price = input.prices[athleteId];
          if (price === undefined) return "not_in_catalogue";
          const mine = bids.get(key(leagueId)) ?? [];
          const problem = bidProblem({
            athleteId,
            amount,
            price,
            budget: input.budget,
            bids: mine,
          });
          if (problem === "invalid") throw new Error("the use case checks the amount");
          if (problem) return problem;
          tick += 1;
          bids.set(key(leagueId), [
            ...mine.filter((b) => b.athleteId !== athleteId),
            { athleteId, amount, bidAt: new Date(tick).toISOString() },
          ]);
          return "placed";
        },
        async withdraw(leagueId, athleteId) {
          if (!member(leagueId)) return "not_member";
          if (!open.has(leagueId)) return "mercato_closed";
          const mine = bids.get(key(leagueId)) ?? [];
          bids.set(
            key(leagueId),
            mine.filter((b) => b.athleteId !== athleteId),
          );
          return "withdrawn";
        },
      };
    },
  };
}
