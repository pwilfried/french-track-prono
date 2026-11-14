import {
  seasonFits,
  type JoinOutcome,
  type ManagerLeagueFile,
  type ManagerLeagueRepository,
  type ManagerParticipant,
  type SeasonCompetition,
} from "@/application/manager-leagues";
import type { ManagerRuleSet } from "@/application/manager-rules";
import { isBannedName } from "@/domain/banned-names";
import { fitsMembers, mercatoRounds, seasonFormat } from "@/domain/manager-league";

/**
 * Test double of the ManagerLeagueRepository port: one store, a session per player. `rules` is
 * read at each creation, like the table of the rules: change it to test that leagues keep theirs.
 * `available` are the competitions a league can be created with (eligible, not finished).
 */
export function createInMemoryManagerLeagueStore(
  rules: { current: ManagerRuleSet },
  available: SeasonCompetition[] = [],
) {
  const leagues: (Omit<ManagerLeagueFile, "memberCount" | "participants" | "target"> & {
    members: ManagerParticipant[];
  })[] = [];
  let next = 0;
  const view = (league: (typeof leagues)[number]): ManagerLeagueFile => {
    const { members, ...rest } = structuredClone(league);
    return {
      ...rest,
      memberCount: members.length,
      target: rest.mercato.target,
      participants: members,
    };
  };
  const isOpen = (league: (typeof leagues)[number]) => league.mercato.openedAt !== null;
  return {
    /** Opens a mercato as the database would, whatever its players. */
    openMercato(id: string) {
      const league = leagues.find((l) => l.id === id);
      if (league) league.mercato.openedAt = new Date().toISOString();
    },
    session(player: ManagerParticipant): ManagerLeagueRepository {
      const enter = (league: (typeof leagues)[number]): JoinOutcome => {
        if (league.members.some((m) => m.userId === player.userId)) {
          return { outcome: "joined", leagueId: league.id };
        }
        if (isOpen(league)) return { outcome: "mercato_open" };
        if (league.members.length >= league.mercato.target) return { outcome: "full" };
        league.members.push({ ...player });
        return { outcome: "joined", leagueId: league.id };
      };
      const mine = () => leagues.filter((l) => l.members.some((m) => m.userId === player.userId));
      /** The league of this player, created by them, its mercato not open. */
      const own = (id: string) => {
        const league = leagues.find((l) => l.id === id);
        if (!league || league.ownerId !== player.userId) return "not_owner" as const;
        if (isOpen(league)) return "mercato_open" as const;
        return league;
      };
      /** The competitions chosen, first one first, or null if one is not available. */
      const pick = (ids: string[]) => {
        const chosen = available.filter((c) => ids.includes(c.id));
        if (chosen.length !== new Set(ids).size) return null;
        return [...chosen].sort((a, b) => a.firstEventAt.localeCompare(b.firstEventAt));
      };
      return {
        async availableCompetitions() {
          return pick(available.map((c) => c.id))!;
        },
        async create(name, isPublic, competitionIds) {
          if (isBannedName(name)) return "banned";
          const competitions = pick(competitionIds);
          const format = seasonFormat(competitions?.length ?? 0);
          if (!competitions || !format) return "competitions_refused";
          const id = `manager-league-${++next}`;
          leagues.push({
            id,
            name,
            isPublic,
            inviteCode: `MGR${String(next).padStart(3, "2")}`,
            ownerId: player.userId,
            rules: structuredClone(rules.current.rules),
            competitions,
            mercato: {
              target: format.players,
              startsAt: null,
              openedAt: null,
              roundMode: "auto",
            },
            members: [{ ...player }],
          });
          return { id };
        },
        async join(code) {
          const league = leagues.find((l) => l.inviteCode === code);
          return league ? enter(league) : { outcome: "unknown" };
        },
        async joinPublic(id) {
          const league = leagues.find((l) => l.id === id && l.isPublic);
          return league ? enter(league) : { outcome: "unknown" };
        },
        async inviteStatus(code) {
          const league = leagues.find((l) => l.inviteCode === code);
          if (!league) return "unknown";
          if (league.members.some((m) => m.userId === player.userId)) return "open";
          if (isOpen(league)) return "mercato_open";
          return league.members.length >= league.mercato.target ? "full" : "open";
        },
        async listPublic() {
          return leagues
            .filter(
              (l) =>
                l.isPublic &&
                !isOpen(l) &&
                l.members.length < l.mercato.target &&
                !l.members.some((m) => m.userId === player.userId),
            )
            .map((l) => ({
              id: l.id,
              name: l.name,
              memberCount: l.members.length,
              target: l.mercato.target,
            }));
        },
        async listMine() {
          return mine().map(({ id, name, isPublic, inviteCode, ownerId, members, mercato }) => ({
            id,
            name,
            isPublic,
            inviteCode,
            ownerId,
            memberCount: members.length,
            target: mercato.target,
          }));
        },
        async find(id) {
          const league = mine().find((l) => l.id === id);
          return league ? view(league) : null;
        },
        async setCompetitions(id, competitionIds) {
          const league = own(id);
          if (typeof league === "string") return league;
          const competitions = pick(competitionIds);
          if (!competitions || !fitsMembers(competitions.length, league.members.length)) {
            return "competitions_refused";
          }
          league.competitions = competitions;
          league.mercato.target = seasonFormat(competitions.length)!.players;
          return "set";
        },
        async setMercato(id, settings) {
          const league = own(id);
          if (typeof league === "string") return league;
          league.mercato = {
            ...league.mercato,
            startsAt: settings.startsAt,
            roundMode: settings.rounds.mode,
          };
          league.rules.rounds = mercatoRounds(settings.rounds, rules.current.rules.rounds);
          return "set";
        },
        async launchMercato(id) {
          const league = own(id);
          if (typeof league === "string") return league;
          if (league.members.length !== league.mercato.target) return "players_missing";
          const now = new Date().toISOString();
          if (!seasonFits(view(league), now)) return "competitions_missing";
          league.mercato.openedAt = now;
          return "launched";
        },
      };
    },
  };
}
