import { animalOrHare, BAND_ORDER, type Animal } from "./band";
import { competitionDay } from "./competition";
import type { DisciplineFamily } from "./discipline";
import { rankPlayers, totalsOf } from "./ranking";
import type { ScoreReason } from "./scoring";

/**
 * Season trophies (#822), rules of docs/decisions/badges-et-trophees.md (#807). A trophy is a
 * statuette: it rewards a final ranking (a predictions league, a Manager league, the general
 * ranking) or a feat, belongs to a season (the year of the competitions) and can be won again the
 * next one. Players still equal in a ranking share its rank, so they share its metal (1, 2, 2, 4:
 * gold, silver, silver, nothing). A player without any point never gets a trophy.
 */

export type Metal = "gold" | "silver" | "bronze";

/** Every kind of trophy, in the order of a shelf. */
export const TROPHY_KINDS = [
  "general",
  "league",
  "manager",
  "chrono",
  "record",
  "witness",
] as const;
export type TrophyKind = (typeof TROPHY_KINDS)[number];

export type Trophy = {
  userId: string;
  season: number;
  kind: TrophyKind;
  /** Null for a feat (Chrono figé, Record de ligue, Témoin d'or). */
  metal: Metal | null;
  /** The predictions or Manager league; null for the general ranking and the Témoin d'or. */
  leagueId: string | null;
  /** The league's name when the trophy was won: it stays if the league is renamed or deleted. */
  leagueName: string | null;
  /** The statuette's animal: the league's family for a predictions league, the hare for Manager. */
  animal: Animal | null;
};

/** A score line a trophy is drawn from. */
export type TrophyLine = {
  userId: string;
  points: number;
  reasons: ScoreReason[];
  /** ISO 8601: its competition day (« soirée ») is read from it. */
  eventStartsAt: string;
  eventFamily?: DisciplineFamily;
  competitionSlug?: string;
};

/** A competition known by its slug and its last day (YYYY-MM-DD). */
export type SeasonCompetition = { slug: string; endsOn: string };

/**
 * The animal of the family most played in a league: the one with the most score lines (an
 * animal carrying two families adds them up); a tie goes to the first animal of the list, no
 * line at all to the hare.
 */
export function mostPlayedAnimal(lines: Pick<TrophyLine, "eventFamily">[]): Animal {
  const count = new Map<Animal, number>();
  for (const l of lines) {
    if (!l.eventFamily) continue;
    const animal = animalOrHare(l.eventFamily);
    count.set(animal, (count.get(animal) ?? 0) + 1);
  }
  let best: Animal = "lievre";
  let most = 0;
  for (const animal of BAND_ORDER) {
    const n = count.get(animal) ?? 0;
    if (n > most) [best, most] = [animal, n];
  }
  return best;
}

/** Final podium of a league: gold, silver, bronze for the ranks 1, 2 and 3. */
export function podiumMetal(rank: number): Metal | null {
  return rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : null;
}

/** Laurel of the general ranking: gold for the 1st, silver for the 2nd and 3rd, bronze to the 10th. */
export function generalMetal(rank: number): Metal | null {
  return rank === 1 ? "gold" : rank <= 3 ? "silver" : rank <= 10 ? "bronze" : null;
}

/** The season of a day (YYYY-MM-DD) or an instant: its year. */
export function seasonOf(day: string): number {
  return Number(day.slice(0, 4));
}

/** A competition is over the day after its last day (`today`: YYYY-MM-DD, Paris time). */
export function competitionOver(competition: SeasonCompetition, today: string): boolean {
  return competition.endsOn < today;
}

/** A league is over once each of its competitions is; a league without any never is. */
export function leagueOver(competitions: SeasonCompetition[], today: string): boolean {
  return competitions.length > 0 && competitions.every((c) => competitionOver(c, today));
}

/** The season of a league: the year its last competition ends. */
export function leagueSeason(competitions: SeasonCompetition[]): number {
  return seasonOf(competitions.reduce((max, c) => (c.endsOn > max ? c.endsOn : max), ""));
}

/** The general ranking of a season is final once its year is over. */
export function seasonOver(season: number, today: string): boolean {
  return seasonOf(today) > season;
}

const ranked = (lines: TrophyLine[], userIds: string[] = []) =>
  rankPlayers(
    totalsOf(
      [...userIds.map((userId) => ({ userId, points: 0, reasons: [] })), ...lines],
      () => "",
    ),
  );

/** The players holding the best total of each group, when it is above 0. */
const bestOf = (totals: Map<string, number>): string[] => {
  const best = Math.max(0, ...totals.values());
  return best > 0 ? [...totals].filter(([, p]) => p === best).map(([userId]) => userId) : [];
};

const sumBy = (lines: TrophyLine[], key: (l: TrophyLine) => string) => {
  const groups = new Map<string, Map<string, number>>();
  for (const l of lines) {
    const group = groups.get(key(l)) ?? new Map<string, number>();
    group.set(l.userId, (group.get(l.userId) ?? 0) + l.points);
    groups.set(key(l), group);
  }
  return groups;
};

/** The minimum of players for the podium of a predictions league (#807). */
export const LEAGUE_PODIUM_MIN_PLAYERS = 4;

export type FinishedLeague = {
  id: string;
  name: string;
  season: number;
  memberIds: string[];
  /** The lines the league counts (its members, competitions, families and entry dates). */
  lines: TrophyLine[];
  competitions: SeasonCompetition[];
};

/**
 * The trophies of a finished predictions league: its podium (at least 4 players, the animal of
 * its most played family), the Chrono figé (the most points in one competition day, Paris time)
 * and the Record de ligue (beating the league's best total in one competition, set by an earlier
 * one: the first competition sets it, nobody beats it there).
 */
export function leagueTrophies(league: FinishedLeague): Trophy[] {
  const base = { season: league.season, leagueId: league.id, leagueName: league.name };
  const trophies: Trophy[] = [];

  if (league.memberIds.length >= LEAGUE_PODIUM_MIN_PLAYERS) {
    const animal = mostPlayedAnimal(league.lines);
    for (const p of ranked(league.lines, league.memberIds)) {
      const metal = podiumMetal(p.rank);
      if (metal && p.points > 0) {
        trophies.push({ ...base, userId: p.userId, kind: "league", metal, animal });
      }
    }
  }

  const days = sumBy(league.lines, (l) => competitionDay(l.eventStartsAt));
  const perDay = new Map<string, number>();
  for (const group of days.values()) {
    for (const [userId, points] of group) {
      perDay.set(userId, Math.max(perDay.get(userId) ?? 0, points));
    }
  }
  for (const userId of bestOf(perDay)) {
    trophies.push({ ...base, userId, kind: "chrono", metal: null, animal: null });
  }

  const byCompetition = sumBy(league.lines, (l) => l.competitionSlug ?? "");
  const order = [...league.competitions].sort(
    (a, b) => a.endsOn.localeCompare(b.endsOn) || a.slug.localeCompare(b.slug),
  );
  let record: number | null = null;
  const beaten = new Set<string>();
  for (const c of order) {
    const totals = byCompetition.get(c.slug);
    if (!totals) continue;
    const best = Math.max(0, ...totals.values());
    if (record !== null && best > record) bestOf(totals).forEach((id) => beaten.add(id));
    if (best > 0) record = Math.max(record ?? 0, best);
  }
  for (const userId of beaten) {
    trophies.push({ ...base, userId, kind: "record", metal: null, animal: null });
  }
  return trophies;
}

/** The frozen final standings of a Manager season (#434). */
export type FinishedManagerLeague = {
  leagueId: string;
  leagueName: string;
  /** ISO 8601: its year, Paris time, is the season. */
  endedAt: string;
  standings: { userId: string; rank: number }[];
};

/** The Manager trophies: the hare in gold, silver or bronze for the top 3 of the standings. */
export function managerTrophies(honours: FinishedManagerLeague): Trophy[] {
  const season = seasonOf(competitionDay(honours.endedAt));
  return honours.standings.flatMap((row) => {
    const metal = podiumMetal(row.rank);
    return metal
      ? [
          {
            userId: row.userId,
            season,
            kind: "manager" as const,
            metal,
            leagueId: honours.leagueId,
            leagueName: honours.leagueName,
            animal: "lievre" as const,
          },
        ]
      : [];
  });
}

/** The laurels of the general ranking of a season: the top 10 of its score lines. */
export function generalTrophies(season: number, lines: TrophyLine[]): Trophy[] {
  return ranked(lines).flatMap((p) => {
    const metal = generalMetal(p.rank);
    return metal && p.points > 0
      ? [
          {
            userId: p.userId,
            season,
            kind: "general" as const,
            metal,
            leagueId: null,
            leagueName: null,
            animal: null,
          },
        ]
      : [];
  });
}

/**
 * The Témoin d'or: finishing a competition ahead of the FrenchTrack account in its general
 * ranking, once a season. No account designated, or an account that did not play: nobody.
 */
export function witnessTrophies(
  season: number,
  witnessId: string | null,
  competitions: { lines: TrophyLine[] }[],
): Trophy[] {
  if (!witnessId) return [];
  const winners = new Set<string>();
  for (const c of competitions) {
    const rows = ranked(c.lines);
    const witness = rows.find((r) => r.userId === witnessId);
    if (!witness) continue;
    for (const r of rows) {
      if (r.rank < witness.rank && r.points > 0) winners.add(r.userId);
    }
  }
  return [...winners].map((userId) => ({
    userId,
    season,
    kind: "witness" as const,
    metal: null,
    leagueId: null,
    leagueName: null,
    animal: null,
  }));
}

const METALS: Metal[] = ["gold", "silver", "bronze"];

/** One shelf of the showcase: a season's trophies, the finest first. */
export type TrophyShelf = { season: number; trophies: Trophy[] };

/**
 * The showcase of a player: one shelf per season, the latest first; on a shelf, the kinds in the
 * order of TROPHY_KINDS, then gold, silver, bronze, then the league's name.
 */
export function trophyShelves(trophies: Trophy[]): TrophyShelf[] {
  const metalRank = (m: Metal | null) => (m ? METALS.indexOf(m) : METALS.length);
  const seasons = [...new Set(trophies.map((t) => t.season))].sort((a, b) => b - a);
  return seasons.map((season) => ({
    season,
    trophies: trophies
      .filter((t) => t.season === season)
      .sort(
        (a, b) =>
          TROPHY_KINDS.indexOf(a.kind) - TROPHY_KINDS.indexOf(b.kind) ||
          metalRank(a.metal) - metalRank(b.metal) ||
          (a.leagueName ?? "").localeCompare(b.leagueName ?? "", "fr"),
      ),
  }));
}

/** The identity of a trophy: one per player, season, kind and league (recomputing never adds). */
export function trophyKey(t: Pick<Trophy, "userId" | "season" | "kind" | "leagueId">): string {
  return `${t.userId}|${t.season}|${t.kind}|${t.leagueId ?? ""}`;
}
