/** International or French. */
export type CompetitionScope = "international" | "france";
export const SCOPES: CompetitionScope[] = ["international", "france"];

/** Indoor (« en salle ») or outdoor (« en plein air »): season bests and events differ (#642). */
export type CompetitionVenue = "indoor" | "outdoor";
export const VENUES: CompetitionVenue[] = ["outdoor", "indoor"];

/** The venue given, outdoor when none is; null for an unknown one. */
export function competitionVenue(value: string | undefined): CompetitionVenue | null {
  if (!value) return "outdoor";
  return VENUES.includes(value as CompetitionVenue) ? (value as CompetitionVenue) : null;
}

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

/** A name, a known type, a known venue (outdoor when none) and dates in order (YYYY-MM-DD). */
export function isValidCompetition(c: {
  name: string;
  scope: string;
  venue?: string;
  startsOn: string;
  endsOn: string;
}): boolean {
  const date = /^\d{4}-\d{2}-\d{2}$/;
  return (
    c.name.trim() !== "" &&
    SCOPES.includes(c.scope as CompetitionScope) &&
    competitionVenue(c.venue) !== null &&
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

/** Hour (Paris time) a competition day starts: a session overseas ending at 2 am stays « ce soir ». */
const DAY_STARTS_AT_HOUR = 6;

/**
 * The competition day (YYYY-MM-DD) an instant belongs to, in Paris time (#551): the Paris date,
 * except that the night until 6 am still belongs to the evening before.
 */
export function competitionDay(instant: string): string {
  // The Paris wall clock, read as if it were UTC, moved back to the start of the day.
  const wallClock = Date.parse(`${utcToParis(instant)}:00Z`);
  return new Date(wallClock - DAY_STARTS_AT_HOUR * 3_600_000).toISOString().slice(0, 10);
}

/**
 * While no competition has started yet: the day the first one starts and the days left (#551),
 * shown instead of an empty ranking. Null once one has started, or when there is none.
 */
export function rankingStart(
  competitions: { startsOn: string }[],
  today: string,
): { startsOn: string; days: number } | null {
  if (competitions.length === 0 || competitions.some((c) => c.startsOn <= today)) return null;
  const startsOn = competitions.map((c) => c.startsOn).sort()[0]!;
  return { startsOn, days: daysUntil(startsOn, today) };
}

/** Whole days before a competition starts (dates as YYYY-MM-DD); 0 once it is under way. */
export function daysUntil(startsOn: string, today: string): number {
  const days =
    (Date.parse(`${startsOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
  return Math.max(0, Math.round(days));
}
