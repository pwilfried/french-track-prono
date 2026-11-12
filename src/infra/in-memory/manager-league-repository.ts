import type {
  JoinOutcome,
  ManagerLeagueFile,
  ManagerLeagueRepository,
  ManagerParticipant,
} from "@/application/manager-leagues";
import type { ManagerRuleSet } from "@/application/manager-rules";
import { isBannedName } from "@/domain/banned-names";
import { MANAGER_LEAGUE_MAX } from "@/domain/manager-league";

/**
 * Test double of the ManagerLeagueRepository port: one store, a session per player. `rules` is
 * read at each creation, like the table of the rules: change it to test that leagues keep theirs.
 */
export function createInMemoryManagerLeagueStore(rules: { current: ManagerRuleSet }) {
  const leagues: (Omit<ManagerLeagueFile, "memberCount" | "participants" | "mercatoOpensAt"> & {
    members: ManagerParticipant[];
  })[] = [];
  /** League → when its mercato opened. */
  const mercatoOpen = new Map<string, string>();
  let next = 0;
  const view = (league: (typeof leagues)[number]): ManagerLeagueFile => {
    const { members, ...rest } = structuredClone(league);
    return {
      ...rest,
      memberCount: members.length,
      participants: members,
      mercatoOpensAt: mercatoOpen.get(league.id) ?? null,
    };
  };
  return {
    /** What the mercato (v0.13) will do: nobody joins any more. */
    openMercato(id: string) {
      mercatoOpen.set(id, new Date().toISOString());
    },
    session(player: ManagerParticipant): ManagerLeagueRepository {
      const enter = (league: (typeof leagues)[number]): JoinOutcome => {
        if (league.members.some((m) => m.userId === player.userId)) {
          return { outcome: "joined", leagueId: league.id };
        }
        if (mercatoOpen.has(league.id)) return { outcome: "mercato_open" };
        if (league.members.length >= MANAGER_LEAGUE_MAX) return { outcome: "full" };
        league.members.push({ ...player });
        return { outcome: "joined", leagueId: league.id };
      };
      const mine = () => leagues.filter((l) => l.members.some((m) => m.userId === player.userId));
      return {
        async create(name, isPublic) {
          if (isBannedName(name)) return "banned";
          const id = `manager-league-${++next}`;
          leagues.push({
            id,
            name,
            isPublic,
            inviteCode: `MGR${String(next).padStart(3, "2")}`,
            ownerId: player.userId,
            rules: structuredClone(rules.current.rules),
            competitionCount: rules.current.competitionSlugs.length,
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
        async listPublic() {
          return leagues
            .filter(
              (l) =>
                l.isPublic &&
                !mercatoOpen.has(l.id) &&
                l.members.length < MANAGER_LEAGUE_MAX &&
                !l.members.some((m) => m.userId === player.userId),
            )
            .map((l) => ({ id: l.id, name: l.name, memberCount: l.members.length }));
        },
        async listMine() {
          return mine().map(({ id, name, isPublic, inviteCode, ownerId, members }) => ({
            id,
            name,
            isPublic,
            inviteCode,
            ownerId,
            memberCount: members.length,
          }));
        },
        async find(id) {
          const league = mine().find((l) => l.id === id);
          return league ? view(league) : null;
        },
      };
    },
  };
}
