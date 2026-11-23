import { UseCaseError } from "@/application/errors";
import type { SeasonFacts, TrophyRepository } from "@/application/trophies";
import { trophyKey, type Trophy, type TrophyMoment } from "@/domain/trophies";

/** What the fake knows: the facts of each season, the players, their leagues, the admins. */
export type TrophyFixture = {
  facts?: Record<number, Omit<SeasonFacts, "witnessId">>;
  /** Pseudo by player id. */
  players: Record<string, string>;
  /** The members of each league (predictions or Manager): they read each other's trophies. */
  leagues?: string[][];
  admins?: string[];
  trophies?: Trophy[];
};

/**
 * Test double of the TrophyRepository port, with the rules of the database: only an admin draws
 * the trophies and sets the FrenchTrack account; a player reads their trophies and those of the
 * players of their leagues, and celebrates their own once (#1135); one trophy per player, season, kind and league; the points of a feat
 * are told, not kept; an announcement made twice is kept once (#1134).
 */
export function createInMemoryTrophyStore(fixture: TrophyFixture) {
  let trophies: Trophy[] = structuredClone(fixture.trophies ?? []);
  let witnessId: string | null = null;
  // The trophies celebrated (#1135), as `trophyKey|metal`: those of the fixture were won before.
  const seen = new Set(trophies.map((t) => `${trophyKey(t)}|${t.metal ?? ""}`));
  const moments = new Map<string, TrophyMoment>();
  const news = new Map<string, Trophy>();
  return {
    /** Every trophy, as the database holds them. */
    all: () => structuredClone(trophies),
    /** The trophy moments published, once each. */
    moments: () => structuredClone([...moments.values()]),
    /** The fresh trophies to notify, once each. */
    news: () => structuredClone([...news.values()]),
    session(userId: string): TrophyRepository {
      const admin = () => {
        if (!fixture.admins?.includes(userId)) throw new UseCaseError("NOT_ADMIN");
      };
      const sees = (other: string) =>
        other === userId ||
        (fixture.leagues ?? []).some((l) => l.includes(userId) && l.includes(other));
      return {
        async seasonFacts(season) {
          admin();
          const facts = fixture.facts?.[season] ?? { competitions: [], leagues: [], manager: [] };
          return { ...structuredClone(facts), witnessId };
        },
        async seasonTrophies(season) {
          admin();
          return structuredClone(trophies.filter((t) => t.season === season));
        },
        async replaceSeason(season, next, announcements) {
          admin();
          const kept = new Map<string, Trophy>();
          for (const t of next) {
            if (t.season !== season || !(t.userId in fixture.players)) continue;
            // The points of a feat are told, not kept.
            const stored = structuredClone(t);
            delete stored.points;
            if (!kept.has(trophyKey(t))) kept.set(trophyKey(t), stored);
          }
          trophies = [...trophies.filter((t) => t.season !== season), ...kept.values()];
          for (const m of announcements.moments) {
            const key = `${m.feed}|${m.leagueId}|${m.key}`;
            if (!moments.has(key) && m.userId in fixture.players)
              moments.set(key, structuredClone(m));
          }
          for (const t of announcements.news) {
            const key = `${trophyKey(t)}|${t.metal ?? ""}`;
            if (!news.has(key) && t.userId in fixture.players) news.set(key, structuredClone(t));
          }
        },
        async ofPlayer(playerId) {
          return sees(playerId)
            ? structuredClone(trophies.filter((t) => t.userId === playerId))
            : [];
        },
        async unseen(playerId) {
          return playerId === userId
            ? structuredClone(
                trophies.filter(
                  (t) => t.userId === userId && !seen.has(`${trophyKey(t)}|${t.metal ?? ""}`),
                ),
              )
            : [];
        },
        async markSeen() {
          for (const t of trophies)
            if (t.userId === userId) seen.add(`${trophyKey(t)}|${t.metal ?? ""}`);
        },
        async witness() {
          admin();
          return witnessId ? (fixture.players[witnessId] ?? null) : null;
        },
        async setWitness(pseudo) {
          admin();
          if (pseudo.trim() === "") {
            witnessId = null;
            return "cleared";
          }
          const found = Object.entries(fixture.players).find(
            ([, p]) => p.toLowerCase() === pseudo.trim().toLowerCase(),
          );
          if (!found) return "unknown";
          witnessId = found[0];
          return "saved";
        },
      };
    },
  };
}
