/** International or French. */
export type CompetitionScope = "international" | "france";
export const SCOPES: CompetitionScope[] = ["international", "france"];

const slugify = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** "Championnats de France Élite", 2027 → "championnats-de-france-elite-2027". */
export function competitionSlug(name: string, startsOn: string): string {
  return `${slugify(name)}-${startsOn.slice(0, 4)}`;
}

/** An event's address: competition, gender, discipline, and the round unless it is the final. */
export function eventSlug(
  competition: string,
  gender: string,
  discipline: string,
  round: string,
): string {
  return [competition, gender.toLowerCase(), slugify(discipline), round === "final" ? "" : round]
    .filter(Boolean)
    .join("-");
}

/** A name, a known type and dates in order (YYYY-MM-DD). */
export function isValidCompetition(c: {
  name: string;
  scope: string;
  startsOn: string;
  endsOn: string;
}): boolean {
  const date = /^\d{4}-\d{2}-\d{2}$/;
  return (
    c.name.trim() !== "" &&
    SCOPES.includes(c.scope as CompetitionScope) &&
    date.test(c.startsOn) &&
    date.test(c.endsOn) &&
    c.endsOn >= c.startsOn
  );
}

/**
 * The one time zone of the app (owner's decision, 11 Nov 2026, #501): every event time is typed
 * in the back-office and shown to players in Paris time, whatever the country of the competition.
 */
export const TIME_ZONE = "Europe/Paris";

/** The UTC offset of Paris time at an instant, in minutes. */
function offsetMinutes(instant: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return (asUtc - instant.getTime()) / 60000;
}

/** A time typed in Paris time ("2027-06-25T20:35"), as an ISO UTC instant. */
export function parisToUtc(local: string): string {
  const guess = new Date(`${local}:00Z`);
  const first = new Date(guess.getTime() - offsetMinutes(guess) * 60000);
  // Second pass for times near a change of offset (summer time).
  return new Date(guess.getTime() - offsetMinutes(first) * 60000).toISOString();
}

/** The Paris time ("YYYY-MM-DDTHH:mm") of an instant: the inverse of parisToUtc. */
export function utcToParis(iso: string): string {
  const instant = new Date(iso);
  return new Date(instant.getTime() + offsetMinutes(instant) * 60000).toISOString().slice(0, 16);
}

/**
 * The competition the app puts first: the one under way or the next to start; when all are over,
 * the latest one.
 */
export function nextCompetition<T extends { startsOn: string; endsOn: string }>(
  competitions: T[],
  today: string,
): T | null {
  const coming = competitions
    .filter((c) => c.endsOn >= today)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  if (coming[0]) return coming[0];
  return [...competitions].sort((a, b) => b.startsOn.localeCompare(a.startsOn))[0] ?? null;
}

/**
 * The competitions still to come or under way, in date order, split for the « Épreuves » picker
 * (#352): first those counted by one of the player's leagues, then the others.
 */
export function competitionsForPlayer<T extends { slug: string; startsOn: string; endsOn: string }>(
  competitions: T[],
  myLeagueSlugs: string[],
  today: string,
): { mine: T[]; others: T[] } {
  const mineSet = new Set(myLeagueSlugs);
  const coming = competitions
    .filter((c) => c.endsOn >= today)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.slug.localeCompare(b.slug));
  return {
    mine: coming.filter((c) => mineSet.has(c.slug)),
    others: coming.filter((c) => !mineSet.has(c.slug)),
  };
}

/** Whole days before a competition starts (dates as YYYY-MM-DD); 0 once it is under way. */
export function daysUntil(startsOn: string, today: string): number {
  const days =
    (Date.parse(`${startsOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
  return Math.max(0, Math.round(days));
}
