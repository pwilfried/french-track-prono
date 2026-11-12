import type { CatalogueAthlete } from "@/domain/manager-catalogue";
import { unmetQuotas } from "@/domain/manager-team";

import { UseCaseError } from "./errors";
import type { ManagerBidRepository } from "./manager-bids";
import type { ManagerCatalogueRepository } from "./manager-catalogue";
import type { ManagerLeagueRepository } from "./manager-leagues";

/** An athlete of the player's team, with the price they paid for them. */
export type TeamAthlete = Omit<CatalogueAthlete, "price" | "available" | "pb" | "sb"> & {
  paid: number;
};

/**
 * The player's Manager team (#426): fixed for the season once the mercato is closed. In v1 no
 * athlete is bought, sold or swapped afterwards.
 */
export type MyManagerTeam = {
  mercatoClosed: boolean;
  teamSize: number;
  budget: number;
  spent: number;
  left: number;
  /** By athlete name. */
  athletes: TeamAthlete[];
  /** The quotas whose minimum the team does not reach: nothing was left to fill them. */
  unmet: ReturnType<typeof unmetQuotas>;
};

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, "fr", { sensitivity: "base" });

export function getMyManagerTeam(ports: {
  managerLeagues: Pick<ManagerLeagueRepository, "find">;
  bids: ManagerBidRepository;
  catalogue: ManagerCatalogueRepository;
}) {
  return {
    async execute(input: { leagueId: string }): Promise<MyManagerTeam> {
      const [league, mine, catalogue] = await Promise.all([
        ports.managerLeagues.find(input.leagueId),
        ports.bids.mine(input.leagueId),
        ports.catalogue.list(input.leagueId),
      ]);
      if (!league || mine === "not_member" || catalogue === "not_member") {
        throw new UseCaseError("LEAGUE_NOT_FOUND");
      }
      const byId = new Map(catalogue.map((a) => [a.athleteId, a]));
      const athletes = mine.team
        .flatMap(({ athleteId, amount }) => {
          const a = byId.get(athleteId);
          if (!a) return [];
          const { slug, name, countryCode, sex, discipline, family } = a;
          return [{ athleteId, slug, name, countryCode, sex, discipline, family, paid: amount }];
        })
        .sort(byName);
      const spent = mine.team.reduce((sum, a) => sum + a.amount, 0);
      return {
        mercatoClosed: mine.mercatoClosed,
        teamSize: league.rules.teamSize,
        budget: mine.budget,
        spent,
        left: mine.budget - spent,
        athletes,
        unmet: unmetQuotas(league.rules.quotas, athletes),
      };
    },
  };
}
