import type {
  JoinOutcome,
  ManagerLeagueFile,
  ManagerLeagueRepository,
  ManagerParticipant,
} from "@/application/manager-leagues";
import type { ManagerRuleSet } from "@/application/manager-rules";
import { isBannedName } from "@/domain/banned-names";
import {
  countedCompetitions,
  duelDays,
  mercatoEndsAt,
  mercatoRounds,
  seasonShape,
  type LeagueCompetition,
} from "@/domain/manager-league";

/**
 * Test double of the ManagerLeagueRepository port: one store, a session per player. `rules` is
 * read at each creation, like the table of the rules: change it to test that leagues keep theirs.
 * `open` are the competitions open to the Manager and not over yet.
 */
export function createInMemoryManagerLeagueStore(
  rules: { current: ManagerRuleSet },
  open: LeagueCompetition[] = [],
) {
  const firstFirst = (competitions: LeagueCompetition[]) =>
    countedCompetitions(competitions, new Date(0).toISOString());
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
      return {
        async create(name, isPublic, competitionIds) {
          if (isBannedName(name)) return "banned";
          const ids = [...new Set(competitionIds)];
          const competitions = open.filter((c) => ids.includes(c.id));
          const season = seasonShape(ids.length);
          if (competitions.length !== ids.length || !season) return "competitions_refused";
          const id = `manager-league-${++next}`;
          leagues.push({
            id,
            name,
            isPublic,
            inviteCode: `MGR${String(next).padStart(3, "2")}`,
            ownerId: player.userId,
            rules: structuredClone(rules.current.rules),
            competitions: structuredClone(firstFirst(competitions)),
            mercato: {
              target: season.players,
              startsAt: null,
              openedAt: null,
              roundMode: "auto",
            },
            members: [{ ...player }],
          });
          return { id };
        },
        async openCompetitions() {
          return structuredClone(firstFirst(open));
        },
        async join(code) {
          const league = leagues.find((l) => l.inviteCode === code);
          return league ? enter(league) : { outcome: "unknown" };
        },
        async joinPublic(id) {
          const league = leagues.find((l) => l.id === id && l.isPublic);
          return league ? enter(league) : { outcome: "unknown" };
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
          const end = mercatoEndsAt(
            new Date().toISOString(),
            league.rules.rounds,
            league.rules.minTeamSize,
          );
          if (
            countedCompetitions(league.competitions, end).length < duelDays(league.mercato.target)
          ) {
            return "competitions_short";
          }
          league.mercato.openedAt = new Date().toISOString();
          return "launched";
        },
      };
    },
  };
}
