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

function isTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** A name, a known type, dates in order (YYYY-MM-DD) and a real time zone. */
export function isValidCompetition(c: {
  name: string;
  scope: string;
  startsOn: string;
  endsOn: string;
  timeZone: string;
}): boolean {
  const date = /^\d{4}-\d{2}-\d{2}$/;
  return (
    c.name.trim() !== "" &&
    SCOPES.includes(c.scope as CompetitionScope) &&
    date.test(c.startsOn) &&
    date.test(c.endsOn) &&
    c.endsOn >= c.startsOn &&
    isTimeZone(c.timeZone)
  );
}

/** The UTC offset of a time zone at an instant, in minutes. */
function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
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

/** A local time typed in the competition's time zone ("2027-06-25T20:35"), as an ISO UTC instant. */
export function zonedToUtc(local: string, timeZone: string): string {
  const guess = new Date(`${local}:00Z`);
  const first = new Date(guess.getTime() - offsetMinutes(guess, timeZone) * 60000);
  // Second pass for local times near a change of offset (summer time).
  return new Date(guess.getTime() - offsetMinutes(first, timeZone) * 60000).toISOString();
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
