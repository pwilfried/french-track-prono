import type {
  ManagerLeagueFile,
  ManagerLeagueRepository,
  ManagerParticipant,
} from "@/application/manager-leagues";
import type { ManagerRuleSet } from "@/application/manager-rules";
import { isBannedName } from "@/domain/banned-names";

/**
 * Test double of the ManagerLeagueRepository port: one store, a session per player. `rules` is
 * read at each creation, like the table of the rules: change it to test that leagues keep theirs.
 */
export function createInMemoryManagerLeagueStore(rules: { current: ManagerRuleSet }) {
  const leagues: (Omit<ManagerLeagueFile, "memberCount" | "participants"> & {
    members: ManagerParticipant[];
  })[] = [];
  let next = 0;
  const view = (league: (typeof leagues)[number]): ManagerLeagueFile => {
    const { members, ...rest } = structuredClone(league);
    return { ...rest, memberCount: members.length, participants: members };
  };
  return {
    session(player: ManagerParticipant): ManagerLeagueRepository {
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
