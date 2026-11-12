import type { ManagerBidRepository, WonAthlete } from "@/application/manager-bids";
import { bidProblem, type ManagerBid } from "@/domain/manager-bid";
import { mayCloseMercato, mercatoCloseReason, type Recruiter } from "@/domain/manager-mercato";
import { awardBids, roundEndsAt, type RoundRules } from "@/domain/manager-round";
import type { MercatoCloseMode } from "@/domain/manager-rules";

const ROUNDS: RoundRules = { firstHours: 48, longRounds: 2, nextHours: 24 };

/**
 * Test double of the ManagerBidRepository port: one store of bids, a session per player, who sees
 * their own bids only. `prices` is the catalogue (athlete → reference price); `members` the
 * participants by league. `closeRound` does what the scheduled job does in the database (#423),
 * then closes the mercato when no participant can recruit any more, if the rules allow it (#424).
 */
export function createInMemoryManagerBidStore(input: {
  budget: number;
  prices: Record<string, number>;
  members: Record<string, string[]>;
  teamSize?: number;
  closeModes?: MercatoCloseMode[];
}) {
  const teamSize = input.teamSize ?? 12;
  const modes = input.closeModes ?? ["budgets_spent", "last_bidder", "scheduled"];
  const bids = new Map<string, ManagerBid[]>();
  /** League → athlete → its owner and what it cost. */
  const awards = new Map<string, Map<string, WonAthlete & { userId: string }>>();
  /** League → when its mercato opened, how many rounds are closed, whether it is closed. */
  const mercato = new Map<string, { openedAt: string; closed: number; over: boolean }>();
  // A clock that always moves on, like clock_timestamp() in the database.
  let tick = Date.parse("2027-01-01T00:00:00.000Z");
  const key = (leagueId: string, userId: string) => `${leagueId}/${userId}`;
  const wonBy = (leagueId: string, userId: string) =>
    [...(awards.get(leagueId)?.values() ?? [])]
      .filter((a) => a.userId === userId)
      .map(({ athleteId, amount, round }) => ({ athleteId, amount, round }));
  const members = (leagueId: string) => input.members[leagueId] ?? [];
  /** Every participant's situation and the cheapest athlete still free, as the close reads them. */
  const situation = (leagueId: string) => {
    const won = awards.get(leagueId);
    const free = Object.entries(input.prices)
      .filter(([athleteId]) => !won?.has(athleteId))
      .map(([, price]) => price);
    const players: Recruiter[] = members(leagueId).map((userId) => {
      const team = wonBy(leagueId, userId);
      return {
        userId,
        left: input.budget - team.reduce((sum, a) => sum + a.amount, 0),
        athletes: team.length,
      };
    });
    return {
      modes,
      teamSize,
      cheapestFree: free.length > 0 ? Math.min(...free) : null,
      players,
    };
  };
  const open = (leagueId: string) => {
    const state = mercato.get(leagueId);
    return state !== undefined && !state.over ? state : undefined;
  };
  /** The highest bid on each athlete wins, the other bids are freed. */
  const award = (leagueId: string) => {
    const state = mercato.get(leagueId)!;
    const won = awards.get(leagueId)!;
    state.closed += 1;
    const all = members(leagueId).flatMap((userId) =>
      (bids.get(key(leagueId, userId)) ?? []).map((b) => ({ ...b, userId })),
    );
    for (const a of awardBids(all)) won.set(a.athleteId, { ...a, round: state.closed });
    for (const userId of members(leagueId)) bids.delete(key(leagueId, userId));
  };
  /** The bids under way are resolved as a last round, then the mercato is closed. */
  const finish = (leagueId: string) => {
    if (members(leagueId).some((userId) => (bids.get(key(leagueId, userId)) ?? []).length > 0)) {
      award(leagueId);
    }
    mercato.get(leagueId)!.over = true;
  };
  return {
    openMercato(leagueId: string) {
      mercato.set(leagueId, { openedAt: new Date(tick).toISOString(), closed: 0, over: false });
      awards.set(leagueId, new Map());
    },
    /** Closes the open round of a league, then its mercato if nobody can recruit any more. */
    closeRound(leagueId: string) {
      if (!open(leagueId)) throw new Error("the mercato of the league is not open");
      award(leagueId);
      const now = new Date(tick).toISOString();
      if (mercatoCloseReason({ ...situation(leagueId), closesAt: null, now })) finish(leagueId);
    },
    session(userId: string): ManagerBidRepository {
      const member = (leagueId: string) => members(leagueId).includes(userId);
      const mayClose = (leagueId: string) =>
        open(leagueId) !== undefined && mayCloseMercato(userId, situation(leagueId));
      return {
        async mine(leagueId) {
          if (!member(leagueId)) return "not_member";
          const state = mercato.get(leagueId);
          return {
            budget: input.budget,
            mercatoOpen: open(leagueId) !== undefined,
            mercatoClosed: state?.over ?? false,
            canClose: mayClose(leagueId),
            roundEndsAt:
              state && !state.over ? roundEndsAt(state.openedAt, ROUNDS, state.closed + 1) : null,
            team: wonBy(leagueId, userId),
            bids: structuredClone(bids.get(key(leagueId, userId)) ?? []),
          };
        },
        async place(leagueId, athleteId, amount) {
          if (!member(leagueId)) return "not_member";
          if (!open(leagueId)) return "mercato_closed";
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
          if (!open(leagueId)) return "mercato_closed";
          const mine = bids.get(key(leagueId, userId)) ?? [];
          bids.set(
            key(leagueId, userId),
            mine.filter((b) => b.athleteId !== athleteId),
          );
          return "withdrawn";
        },
        async close(leagueId) {
          if (!member(leagueId)) return "not_member";
          if (!open(leagueId)) return "mercato_closed";
          if (!mayClose(leagueId)) return "not_last_bidder";
          finish(leagueId);
          return "closed";
        },
      };
    },
  };
}
