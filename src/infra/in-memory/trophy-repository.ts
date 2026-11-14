import { UseCaseError } from "@/application/errors";
import type { SeasonFacts, TrophyRepository } from "@/application/trophies";
import { trophyKey, type Trophy } from "@/domain/trophies";

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
 * players of their leagues; one trophy per player, season, kind and league.
 */
export function createInMemoryTrophyStore(fixture: TrophyFixture) {
  let trophies: Trophy[] = structuredClone(fixture.trophies ?? []);
  let witnessId: string | null = null;
  return {
    /** Every trophy, as the database holds them. */
    all: () => structuredClone(trophies),
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
        async replaceSeason(season, next) {
          admin();
          const kept = new Map<string, Trophy>();
          for (const t of next) {
            if (t.season !== season || !(t.userId in fixture.players)) continue;
            if (!kept.has(trophyKey(t))) kept.set(trophyKey(t), structuredClone(t));
          }
          trophies = [...trophies.filter((t) => t.season !== season), ...kept.values()];
        },
        async ofPlayer(playerId) {
          return sees(playerId)
            ? structuredClone(trophies.filter((t) => t.userId === playerId))
            : [];
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
