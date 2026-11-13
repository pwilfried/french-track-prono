import type { LeagueModerationRepository } from "@/application/league-moderation";
import type { League, LeagueMember, LeagueRepository } from "@/application/leagues";
import { INVITE_ALPHABET, INVITE_LENGTH, leagueCapacity } from "@/domain/league";
import { UseCaseError } from "@/application/errors";
import { isBannedName } from "@/domain/banned-names";
import { DEFAULT_BIB } from "@/domain/bib";
import { inScreenOrder, type LeagueFamilyRule } from "@/domain/league-families";

type Stored = {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  members: string[];
  competitionSlugs: string[];
  isPublic: boolean;
  /** Empty: a league on all events (#613). */
  families: LeagueFamilyRule[];
};

/** The families in the order of the screen; absent for a league on all events. */
const familiesOf = (rules: LeagueFamilyRule[]) =>
  rules.length > 0 ? { families: inScreenOrder(rules.map((r) => ({ ...r }))) } : {};

/**
 * Test double of the LeagueRepository port, with the rules of the database. One store shared by
 * every player; `session(player)` acts as that player. `competitions` tells which competitions
 * exist and whether they have started (every competition is coming when it is not given).
 */
export function createInMemoryLeagueStore(competitions?: Record<string, "coming" | "started">) {
  const leagues = new Map<string, Stored>();
  const reports = new Map<string, Set<string>>();
  /** Wrong invite codes per player (#155): after 10, joining with a code is refused. */
  const wrongCodes = new Map<string, number>();
  const profiles = new Map<string, LeagueMember>();
  /** When each player joined each league (`${leagueId}:${userId}`), for the league ranking. */
  const joinedAt = new Map<string, string>();
  const enter = (league: Stored, userId: string) => {
    league.members.push(userId);
    joinedAt.set(`${league.id}:${userId}`, new Date().toISOString());
  };
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
    ...familiesOf(l.families),
  });

  return {
    /** The admin's moderation of the same leagues (#321). */
    moderation(options: { isAdmin: boolean }): LeagueModerationRepository {
      return {
        async list() {
          if (!options.isAdmin) return "not_admin";
          return [...leagues.values()].reverse().map((l) => ({
            id: l.id,
            name: l.name,
            emoji: "🏆",
            isPublic: l.isPublic,
            owner: profiles.get(l.ownerId)?.pseudo ?? null,
            createdAt: joinedAt.get(`${l.id}:${l.ownerId}`) ?? new Date().toISOString(),
            memberCount: l.members.length,
            reportCount: reports.get(l.id)?.size ?? 0,
            competitions: [...l.competitionSlugs],
          }));
        },
        async members(leagueId) {
          if (!options.isAdmin) return "not_admin";
          const league = leagues.get(leagueId);
          if (!league) return [];
          // No points in this double: every member shares the first place.
          return league.members.map((id) => ({
            userId: id,
            pseudo: profiles.get(id)?.pseudo ?? id,
            bib: profiles.get(id)?.bib ?? DEFAULT_BIB,
            isOwner: id === league.ownerId,
            joinedAt: joinedAt.get(`${leagueId}:${id}`) ?? new Date().toISOString(),
            points: 0,
            rank: 1,
          }));
        },
        async dismissReports(leagueId) {
          if (!options.isAdmin) return "not_admin";
          if (!leagues.has(leagueId)) return "unknown";
          reports.delete(leagueId);
          return "done";
        },
        async removeMember(leagueId, userId) {
          if (!options.isAdmin) return "not_admin";
          const league = leagues.get(leagueId);
          if (!league || !league.members.includes(userId)) return "unknown";
          if (league.ownerId === userId) return "owner";
          league.members = league.members.filter((id) => id !== userId);
          return "done";
        },
        async rename(leagueId, name) {
          if (!options.isAdmin) return "not_admin";
          const league = leagues.get(leagueId);
          if (!league) return "unknown";
          league.name = name;
          reports.delete(leagueId);
          return "done";
        },
        async remove(leagueId) {
          if (!options.isAdmin) return "not_admin";
          if (!leagues.delete(leagueId)) return "unknown";
          reports.delete(leagueId);
          return "done";
        },
      };
    },
    session(player: LeagueMember): LeagueRepository {
      profiles.set(player.userId, player);
      const me = player.userId;
      return {
        async create(name, competitionSlugs, isPublic, families = []) {
          if (isPublic && isBannedName(name)) throw new UseCaseError("LEAGUE_NAME_BANNED");
          const league: Stored = {
            isPublic,
            families: [...new Set(families)].map((family) => ({ family, addedAt: null })),
            competitionSlugs: [...new Set(competitionSlugs)].sort(),
            id: crypto.randomUUID(),
            name,
            inviteCode: newCode(),
            ownerId: me,
            members: [],
          };
          enter(league, me);
          leagues.set(league.id, league);
          return view(league);
        },
        async join(code) {
          if ((wrongCodes.get(me) ?? 0) >= 10) return { outcome: "too_many" };
          const league = [...leagues.values()].find((l) => l.inviteCode === code);
          if (!league) {
            wrongCodes.set(me, (wrongCodes.get(me) ?? 0) + 1);
            return { outcome: "unknown_code" };
          }
          if (league.members.includes(me))
            return { outcome: "already_member", leagueId: league.id };
          if (league.members.length >= leagueCapacity(league.isPublic)) return { outcome: "full" };
          enter(league, me);
          return { outcome: "joined", leagueId: league.id };
        },
        async listMine() {
          return [...leagues.values()].filter((l) => l.members.includes(me)).map(view);
        },
        async members(leagueId) {
          const league = leagues.get(leagueId);
          if (!league || !league.members.includes(me)) return null;
          return league.members.map((id) => ({
            ...profiles.get(id)!,
            joinedAt: joinedAt.get(`${leagueId}:${id}`),
          }));
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
        async addFamily(leagueId, family) {
          const league = leagues.get(leagueId);
          if (!league || league.ownerId !== me) return "not_owner";
          if (league.families.length === 0) return "all_events";
          if (!league.families.some((f) => f.family === family)) {
            league.families.push({ family, addedAt: new Date().toISOString() });
          }
          return "added";
        },
        async listPublic() {
          return [...leagues.values()]
            .filter((l) => l.isPublic)
            .map((l) => {
              const families = familiesOf(l.families).families?.map((f) => f.family);
              return {
                id: l.id,
                name: l.name,
                memberCount: l.members.length,
                competitionSlugs: [...l.competitionSlugs],
                ...(families ? { families } : {}),
              };
            });
        },
        async joinPublic(leagueId) {
          const league = leagues.get(leagueId);
          if (!league?.isPublic) return { outcome: "unknown_code" };
          if (league.members.includes(me)) return { outcome: "already_member", leagueId };
          if (league.members.length >= leagueCapacity(true)) return { outcome: "full" };
          enter(league, me);
          return { outcome: "joined", leagueId };
        },
        async report(leagueId) {
          if (!leagues.get(leagueId)?.isPublic) return "unknown";
          reports.set(leagueId, (reports.get(leagueId) ?? new Set()).add(me));
          return "reported";
        },
      };
    },
  };
}
