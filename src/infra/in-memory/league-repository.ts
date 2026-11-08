import type { League, LeagueMember, LeagueRepository } from "@/application/leagues";
import {
  INVITE_ALPHABET,
  INVITE_LENGTH,
  isBannedLeagueName,
  leagueCapacity,
} from "@/domain/league";
import { UseCaseError } from "@/application/errors";

type Stored = {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  members: string[];
  competitionSlugs: string[];
  isPublic: boolean;
};

/**
 * Test double of the LeagueRepository port, with the rules of the database. One store shared by
 * every player; `session(player)` acts as that player. `competitions` tells which competitions
 * exist and whether they have started (every competition is coming when it is not given).
 */
export function createInMemoryLeagueStore(competitions?: Record<string, "coming" | "started">) {
  const leagues = new Map<string, Stored>();
  const profiles = new Map<string, LeagueMember>();
  const newCode = () => {
    let code = "";
    for (let i = 0; i < INVITE_LENGTH; i += 1) {
      code += INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)];
    }
    return code;
  };
  const view = (l: Stored): League => ({
    id: l.id,
    name: l.name,
    inviteCode: l.inviteCode,
    ownerId: l.ownerId,
    memberCount: l.members.length,
    competitionSlugs: [...l.competitionSlugs],
    isPublic: l.isPublic,
  });

  return {
    session(player: LeagueMember): LeagueRepository {
      profiles.set(player.userId, player);
      const me = player.userId;
      return {
        async create(name, competitionSlugs, isPublic) {
          if (isPublic && isBannedLeagueName(name)) throw new UseCaseError("LEAGUE_NAME_BANNED");
          const league: Stored = {
            isPublic,
            competitionSlugs: [...new Set(competitionSlugs)].sort(),
            id: crypto.randomUUID(),
            name,
            inviteCode: newCode(),
            ownerId: me,
            members: [me],
          };
          leagues.set(league.id, league);
          return view(league);
        },
        async join(code) {
          const league = [...leagues.values()].find((l) => l.inviteCode === code);
          if (!league) return { outcome: "unknown_code" };
          if (league.members.includes(me))
            return { outcome: "already_member", leagueId: league.id };
          if (league.members.length >= leagueCapacity(league.isPublic)) return { outcome: "full" };
          league.members.push(me);
          return { outcome: "joined", leagueId: league.id };
        },
        async listMine() {
          return [...leagues.values()].filter((l) => l.members.includes(me)).map(view);
        },
        async members(leagueId) {
          const league = leagues.get(leagueId);
          if (!league || !league.members.includes(me)) return null;
          return league.members.map((id) => profiles.get(id)!);
        },
        async leave(leagueId) {
          const league = leagues.get(leagueId);
          if (!league) return "left";
          if (league.ownerId === me) {
            if (league.members.length > 1) return "must_hand_over";
            leagues.delete(leagueId);
            return "left";
          }
          league.members = league.members.filter((id) => id !== me);
          return "left";
        },
        async handOver(leagueId, newOwnerId) {
          const league = leagues.get(leagueId);
          if (!league || league.ownerId !== me) return "not_owner";
          if (newOwnerId === me || !league.members.includes(newOwnerId)) return "unknown_member";
          league.ownerId = newOwnerId;
          return "done";
        },
        async addCompetition(leagueId, competitionSlug) {
          const league = leagues.get(leagueId);
          if (!league || league.ownerId !== me) return "not_owner";
          const state = competitions ? competitions[competitionSlug] : "coming";
          if (!state) return "unknown";
          if (state === "started") return "started";
          if (!league.competitionSlugs.includes(competitionSlug)) {
            league.competitionSlugs = [...league.competitionSlugs, competitionSlug].sort();
          }
          return "added";
        },
        async listPublic() {
          return [...leagues.values()]
            .filter((l) => l.isPublic)
            .map((l) => ({
              id: l.id,
              name: l.name,
              memberCount: l.members.length,
              competitionSlugs: [...l.competitionSlugs],
            }));
        },
        async joinPublic(leagueId) {
          const league = leagues.get(leagueId);
          if (!league?.isPublic) return { outcome: "unknown_code" };
          if (league.members.includes(me)) return { outcome: "already_member", leagueId };
          if (league.members.length >= leagueCapacity(true)) return { outcome: "full" };
          league.members.push(me);
          return { outcome: "joined", leagueId };
        },
      };
    },
  };
}
